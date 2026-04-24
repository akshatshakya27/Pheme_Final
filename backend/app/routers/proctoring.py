from __future__ import annotations

import base64
import os
import uuid
import wave
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import cv2
import numpy as np
from pydantic import BaseModel
from jose import JWTError

from .. import database, models
from ..security import require_role, decode_access_token_payload, AuthPrincipal

# Evidence storage directory
EVIDENCE_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "evidence"
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)


def _sanitize(obj: Any) -> Any:
	"""Convert numpy types to native Python types for JSON serialization."""
	if isinstance(obj, dict):
		return {k: _sanitize(v) for k, v in obj.items()}
	if isinstance(obj, list):
		return [_sanitize(v) for v in obj]
	if isinstance(obj, (np.integer,)):
		return int(obj)
	if isinstance(obj, (np.floating,)):
		return float(obj)
	if isinstance(obj, np.ndarray):
		return obj.tolist()
	return obj


def _save_screenshot(session_id: str, frame: np.ndarray, violations: list[str]) -> str | None:
	"""Save screenshot evidence and return the relative path."""
	try:
		session_dir = EVIDENCE_DIR / session_id
		session_dir.mkdir(parents=True, exist_ok=True)

		timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
		violation_tag = "_".join(violations[:2]) if violations else "unknown"
		filename = f"{timestamp}_{violation_tag}.jpg"
		filepath = session_dir / filename

		cv2.imwrite(str(filepath), frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
		# Return relative path from uploads dir
		return f"evidence/{session_id}/{filename}"
	except Exception:
		return None


# Frame buffer for video clip generation (stores last N frames per session)
_frame_buffers: dict[str, list[tuple[datetime, np.ndarray]]] = {}
FRAME_BUFFER_SIZE = 30  # Store enough history for smooth clips
CLIP_FRAME_COUNT = 10  # Use last 10 frames for evidence clip


def _add_to_frame_buffer(session_id: str, frame: np.ndarray) -> None:
	"""Add frame to the rolling buffer for video clip generation."""
	if session_id not in _frame_buffers:
		_frame_buffers[session_id] = []
	
	buffer = _frame_buffers[session_id]
	buffer.append((datetime.utcnow(), frame.copy()))
	
	# Keep only last N frames
	if len(buffer) > FRAME_BUFFER_SIZE:
		_frame_buffers[session_id] = buffer[-FRAME_BUFFER_SIZE:]


def _save_video_clip(session_id: str, violations: list[str]) -> str | None:
	"""Save a short video clip from buffered frames."""
	try:
		if session_id not in _frame_buffers or len(_frame_buffers[session_id]) < 2:
			return None
		
		session_dir = EVIDENCE_DIR / session_id
		session_dir.mkdir(parents=True, exist_ok=True)
		
		timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
		violation_tag = "_".join(violations[:2]) if violations else "unknown"
		filename = f"{timestamp}_{violation_tag}_clip.mp4"
		filepath = session_dir / filename
		
		# Get frames from buffer
		frames = _frame_buffers[session_id][-CLIP_FRAME_COUNT:]
		if not frames:
			return None
		
		# Get frame dimensions from first frame
		h, w = frames[0][1].shape[:2]
		
		# Create video writer (use mp4v codec)
		fourcc = cv2.VideoWriter_fourcc(*'mp4v')
		if len(frames) >= 2:
			time_deltas = [
				(frames[index][0] - frames[index - 1][0]).total_seconds()
				for index in range(1, len(frames))
			]
			avg_delta = max(0.2, sum(time_deltas) / len(time_deltas))
			fps = float(min(5.0, max(1.0, 1.0 / avg_delta)))
		else:
			fps = 1.0
		writer = cv2.VideoWriter(str(filepath), fourcc, fps, (w, h))
		
		for _, frame in frames:
			writer.write(frame)
		
		writer.release()
		return f"evidence/{session_id}/{filename}"
	except Exception:
		return None


def _save_audio_clip(session_id: str, audio_analyzer: Any, violations: list[str]) -> str | None:
	"""Save a short WAV clip from rolling audio buffer."""
	try:
		pcm16, sample_rate = audio_analyzer.get_recent_audio_pcm16(seconds=8)
		if pcm16 is None or sample_rate is None:
			return None

		session_dir = EVIDENCE_DIR / session_id
		session_dir.mkdir(parents=True, exist_ok=True)

		timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
		violation_tag = "_".join(violations[:2]) if violations else "audio"
		filename = f"{timestamp}_{violation_tag}.wav"
		filepath = session_dir / filename

		with wave.open(str(filepath), "wb") as wav_file:
			wav_file.setnchannels(1)
			wav_file.setsampwidth(2)
			wav_file.setframerate(int(sample_rate))
			wav_file.writeframes(pcm16.tobytes())

		return f"evidence/{session_id}/{filename}"
	except Exception:
		return None


def cleanup_frame_buffer(session_id: str) -> None:
	"""Clean up frame buffer when session ends."""
	if session_id in _frame_buffers:
		del _frame_buffers[session_id]
	if session_id in _latest_live_frames:
		del _latest_live_frames[session_id]
	if session_id in _session_messages:
		del _session_messages[session_id]


def reset_session_messages(session_id: str) -> None:
	"""Clear in-memory chat history for a fresh exam attempt."""
	_session_messages.pop(str(session_id), None)


class AnalyzeFrameJsonIn(BaseModel):
	session_id: str
	frame: str
	exam_id: str | None = None


class FacePrecheckIn(BaseModel):
	frame: str


class ProctorMessageIn(BaseModel):
	session_id: str
	message: str

try:
	from ai_proctoring.vision.face_analyzer import FaceAnalyzer
except Exception:  # pragma: no cover
	FaceAnalyzer = None

try:
	from ai_proctoring.audio.audio_analyzer import AudioAnalyzer
except Exception:  # pragma: no cover
	AudioAnalyzer = None

try:
	from ai_proctoring.vision.object_analyzer import ObjectAnalyzer
except Exception:  # pragma: no cover
	ObjectAnalyzer = None

router = APIRouter()

_face_analyzer: Any = None
_audio_analyzer: Any = None
_audio_started = False
_object_analyzer: Any = None
_latest_live_frames: dict[str, dict[str, Any]] = {}
_session_messages: dict[str, list[dict[str, Any]]] = {}
_webrtc_clients: dict[str, dict[str, WebSocket]] = {}


def _get_face_analyzer() -> Any:
	global _face_analyzer
	if _face_analyzer is None:
		if FaceAnalyzer is None:
			raise RuntimeError("FaceAnalyzer import failed")
		_face_analyzer = FaceAnalyzer(max_faces=5)
	return _face_analyzer


def _get_audio_analyzer() -> Any:
	global _audio_analyzer, _audio_started
	if _audio_analyzer is None:
		if AudioAnalyzer is None:
			raise RuntimeError("AudioAnalyzer import failed")
		_audio_analyzer = AudioAnalyzer(
			noise_tolerance=3,
			speech_threshold=0.3,
			gain_multiplier=6.0,
			speech_consecutive_frames=2,
		)

	if not _audio_started:
		_audio_analyzer.start()
		_audio_started = True

	return _audio_analyzer


def _get_object_analyzer() -> Any:
	global _object_analyzer
	if _object_analyzer is None:
		if ObjectAnalyzer is None:
			raise RuntimeError("ObjectAnalyzer import failed")
		model_path = os.getenv("PROCTOR_OBJECT_MODEL", "yolov8n.pt")
		confidence = float(os.getenv("PROCTOR_OBJECT_CONF", "0.35"))
		imgsz = int(os.getenv("PROCTOR_OBJECT_IMGSZ", "640"))
		_object_analyzer = ObjectAnalyzer(model_path=model_path, conf=confidence, imgsz=imgsz)
	return _object_analyzer


def warmup_proctoring_engines() -> None:
	try:
		_get_face_analyzer()
	except Exception:
		pass

	try:
		_get_audio_analyzer()
	except Exception:
		pass

	try:
		_get_object_analyzer()
	except Exception:
		pass


def shutdown_proctoring_engines() -> None:
	global _audio_started
	if _audio_analyzer is not None and _audio_started:
		try:
			_audio_analyzer.stop()
		except Exception:
			pass
		_audio_started = False


def _frame_to_data_url(frame: np.ndarray) -> str:
	_, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
	encoded = base64.b64encode(buffer.tobytes()).decode("utf-8")
	return f"data:image/jpeg;base64,{encoded}"


def _resolve_principal_from_token(token: str, db: Session) -> AuthPrincipal:
	credentials_exception = HTTPException(status_code=401, detail="Could not validate credentials")
	try:
		payload = decode_access_token_payload(token)
		user_id = payload.get("sub")
		role = payload.get("role")
		if user_id is None or role is None:
			raise credentials_exception
	except JWTError as exc:
		raise credentials_exception from exc

	if role == "super_admin":
		user = db.query(models.SuperAdmin).filter(models.SuperAdmin.id == user_id).first()
		if user:
			return AuthPrincipal(id=str(user.id), role="super_admin", email=user.email)

	if role in ("institute_admin", "admin"):
		user = db.query(models.InstituteAdmin).filter(models.InstituteAdmin.id == user_id).first()
		if user:
			return AuthPrincipal(
				id=str(user.id),
				role="institute_admin",
				email=user.email,
				institute_id=str(user.institute_id),
			)

	if role in ("exam_admin", "proctor", "faculty"):
		user = db.query(models.Faculty).filter(models.Faculty.id == user_id).first()
		if user:
			resolved_role = "proctor" if role == "proctor" else "exam_admin"
			return AuthPrincipal(
				id=str(user.id),
				role=resolved_role,
				email=user.email,
				institute_id=str(user.institute_id),
			)

	if role in ("student", "student_legacy"):
		user = db.query(models.Student).filter(models.Student.id == user_id).first()
		if user:
			return AuthPrincipal(
				id=str(user.id),
				role="student",
				email=user.email,
				institute_id=str(user.institute_id),
				batch_id=str(user.batch_id),
			)

	raise credentials_exception


def _validate_session_access(
	session_id: str,
	exam_id: str | None,
	current_user: Any,
	db: Session,
) -> models.ExamSession:
	session = db.query(models.ExamSession).filter(models.ExamSession.id == session_id).first()
	if not session:
		raise HTTPException(status_code=404, detail="Session not found")

	resolved_institute_id = getattr(session, "institute_id", None)
	if not resolved_institute_id:
		exam = db.query(models.Exam).filter(models.Exam.id == session.exam_id).first()
		if exam and getattr(exam, "institute_id", None):
			resolved_institute_id = exam.institute_id
		else:
			student = db.query(models.Student).filter(models.Student.id == session.student_id).first()
			if student and getattr(student, "institute_id", None):
				resolved_institute_id = student.institute_id

	if exam_id is not None and str(session.exam_id) != str(exam_id):
		raise HTTPException(status_code=400, detail="Session exam mismatch")

	if current_user.role == "student" and str(session.student_id) != str(current_user.id):
		raise HTTPException(status_code=403, detail="Unauthorized to analyze this session")

	if current_user.role != "super_admin" and resolved_institute_id is not None and str(resolved_institute_id) != str(current_user.institute_id):
		raise HTTPException(status_code=403, detail="Unauthorized institute access")

	if session.session_status not in ("in_progress", "not_started"):
		raise HTTPException(status_code=400, detail="Session is not active")

	return session


def _run_proctoring_analysis(
	session: models.ExamSession,
	frame: np.ndarray,
	db: Session,
) -> dict[str, Any]:
	try:
		analyzer = _get_face_analyzer()
	except Exception as exc:
		raise HTTPException(status_code=503, detail=f"Proctoring engine unavailable: {exc}") from exc

	audio_analyzer = None
	try:
		audio_analyzer = _get_audio_analyzer()
		audio = audio_analyzer.get_audio_data()
	except Exception:
		audio = {
			"volume": 0.0,
			"baseline": 0.0,
			"noise_alert": False,
			"speech_alert": False,
			"speech_conf": 0.0,
		}

	# Add frame to buffer for video clip generation
	_add_to_frame_buffer(str(session.id), frame)
	_latest_live_frames[str(session.id)] = {
		"session_id": str(session.id),
		"exam_id": str(session.exam_id),
		"frame": _frame_to_data_url(frame),
		"updated_at": datetime.utcnow().isoformat() + "Z",
	}

	vision = analyzer.analyze(frame)
	face_count = int(vision.get("face_count", 0))
	primary = vision.get("faces", [{}])[0] if vision.get("faces") else {}
	pitch = float(primary.get("pitch", 0.0))
	yaw = float(primary.get("yaw", 0.0))

	object_counts: dict[str, int] = {}
	detected_objects: list[str] = []
	try:
		object_analyzer = _get_object_analyzer()
		object_data = object_analyzer.analyze(frame)
		object_counts = {str(k): int(v) for k, v in (object_data.get("counts") or {}).items()}
		detected_objects = [str(item) for item in (object_data.get("detected_labels") or [])]
	except Exception:
		object_counts = {}
		detected_objects = []

	violations: list[str] = []
	if face_count == 0:
		violations.append("face_not_detected")
	elif face_count > 1:
		violations.append("multiple_faces")

	# Tuned for 15.6-inch screen setups to detect looking-away earlier.
	if face_count >= 1 and (abs(yaw) > 12 or abs(pitch) > 12):
		violations.append("looking_away")

	if bool(audio.get("speech_alert", False)):
		violations.append("speech_detected")
	if bool(audio.get("noise_alert", False)):
		violations.append("audio_anomaly")

	if detected_objects:
		violations.append("prohibited_object_detected")

	violation_counts: dict[str, int] = {}
	for code in violations:
		if code == "face_not_detected":
			key = "no_face"
		elif code in ("speech_detected", "audio_anomaly"):
			key = "audio_violation"
		elif code == "prohibited_object_detected":
			key = "object_violation"
		else:
			key = code
		violation_counts[key] = violation_counts.get(key, 0) + 1

	if violations:
		session.violation_found = True
		# Increment violation count
		session.violation_count = (session.violation_count or 0) + len(violations)

		# Save screenshot evidence
		screenshot_path = _save_screenshot(str(session.id), frame, violations)

		# Save video clip (from buffered frames)
		video_clip_path = _save_video_clip(str(session.id), violations)

		# Save audio clip for audio-related violations
		audio_clip_path = None
		if ("speech_detected" in violations or "audio_anomaly" in violations) and audio_analyzer is not None:
			audio_clip_path = _save_audio_clip(str(session.id), audio_analyzer, violations)

		# Log each violation to the database
		for v_type in violations:
			violation_log = models.ViolationLog(
				institute_id=session.institute_id,
				session_id=session.id,
				violation_type=v_type,
				screenshot_path=screenshot_path,
				video_clip_path=video_clip_path,
				extra_data={
					"face_count": face_count,
					"pitch": pitch,
					"yaw": yaw,
					"audio_volume": float(audio.get("volume", 0.0)),
					"speech_conf": float(audio.get("speech_conf", 0.0)),
						"object_counts": object_counts,
						"detected_objects": detected_objects,
					"audio_clip_path": audio_clip_path,
				}
			)
			db.add(violation_log)

		db.commit()

	return _sanitize({
		"session_id": str(session.id),
		"exam_id": str(session.exam_id),
		"face_count": face_count,
		"pitch": pitch,
		"yaw": yaw,
		"audio": audio,
		"object_counts": object_counts,
		"detected_objects": detected_objects,
		"violations": violations,
		"violation_counts": violation_counts,
		"has_violation": len(violations) > 0,
		"total_violations": session.violation_count or 0,
		"violation_count": session.violation_count or 0,
	})


@router.post("/proctoring/analyze/frame")
async def analyze_proctoring_frame(
	session_id: str = Form(...),
	exam_id: str = Form(...),
	file: UploadFile = File(...),
	db: Session = Depends(database.get_db),
	current_user=Depends(require_role(["student", "super_admin", "institute_admin", "exam_admin", "proctor"])),
):
	session = _validate_session_access(session_id, exam_id, current_user, db)

	image_bytes = await file.read()
	nparr = np.frombuffer(image_bytes, np.uint8)
	frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
	if frame is None:
		raise HTTPException(status_code=400, detail="Invalid image")

	return _run_proctoring_analysis(session, frame, db)


@router.post("/proctoring/analyze-frame")
async def analyze_proctoring_frame_json(
	payload: AnalyzeFrameJsonIn,
	db: Session = Depends(database.get_db),
	current_user=Depends(require_role(["student", "super_admin", "institute_admin", "exam_admin", "proctor"])),
):
	session = _validate_session_access(payload.session_id, payload.exam_id, current_user, db)

	# Accept data URLs from desktop app: data:image/jpeg;base64,...
	try:
		encoded = payload.frame.split(",", 1)[1] if "," in payload.frame else payload.frame
		image_bytes = __import__("base64").b64decode(encoded)
	except Exception as exc:
		raise HTTPException(status_code=400, detail=f"Invalid frame encoding: {exc}") from exc

	nparr = np.frombuffer(image_bytes, np.uint8)
	frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
	if frame is None:
		raise HTTPException(status_code=400, detail="Invalid image")

	return _run_proctoring_analysis(session, frame, db)


@router.post("/proctoring/precheck-face")
async def precheck_face(
	payload: FacePrecheckIn,
	current_user=Depends(require_role(["student", "super_admin", "institute_admin", "exam_admin", "proctor"])),
):
	# Pre-exam face verification without requiring an active exam session.
	try:
		analyzer = _get_face_analyzer()
	except Exception as exc:
		raise HTTPException(status_code=503, detail=f"Proctoring engine unavailable: {exc}") from exc

	try:
		encoded = payload.frame.split(",", 1)[1] if "," in payload.frame else payload.frame
		image_bytes = __import__("base64").b64decode(encoded)
	except Exception as exc:
		raise HTTPException(status_code=400, detail=f"Invalid frame encoding: {exc}") from exc

	nparr = np.frombuffer(image_bytes, np.uint8)
	frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
	if frame is None:
		raise HTTPException(status_code=400, detail="Invalid image")

	vision = analyzer.analyze(frame)
	face_count = int(vision.get("face_count", 0))

	return _sanitize({
		"face_count": face_count,
		"faces": vision.get("faces", []),
		"is_valid": face_count == 1,
	})


@router.get("/proctoring/live-frame/{session_id}")
async def get_live_frame(
	session_id: str,
	db: Session = Depends(database.get_db),
	current_user=Depends(require_role(["student", "super_admin", "institute_admin", "exam_admin", "proctor"])),
):
	session = _validate_session_access(session_id, None, current_user, db)
	frame = _latest_live_frames.get(str(session.id))
	return {
		"session_id": str(session.id),
		"exam_id": str(session.exam_id),
		"frame": frame.get("frame") if frame else None,
		"updated_at": frame.get("updated_at") if frame else None,
	}


@router.get("/proctoring/messages/{session_id}")
async def get_proctor_messages(
	session_id: str,
	db: Session = Depends(database.get_db),
	current_user=Depends(require_role(["student", "super_admin", "institute_admin", "exam_admin", "proctor"])),
):
	session = _validate_session_access(session_id, None, current_user, db)
	return {
		"session_id": str(session.id),
		"messages": _session_messages.get(str(session.id), []),
	}


@router.post("/proctoring/messages")
async def send_proctor_message(
	payload: ProctorMessageIn,
	db: Session = Depends(database.get_db),
	current_user=Depends(require_role(["super_admin", "institute_admin", "proctor"])),
):
	session = _validate_session_access(payload.session_id, None, current_user, db)
	message_text = payload.message.strip()
	if not message_text:
		raise HTTPException(status_code=400, detail="Message cannot be empty")

	message = {
		"id": str(uuid.uuid4()),
		"session_id": str(session.id),
		"sender": current_user.role,
		"message": message_text,
		"timestamp": datetime.utcnow().isoformat() + "Z",
	}
	_session_messages.setdefault(str(session.id), []).append(message)
	return message


@router.get("/proctoring/violations/{session_id}")
async def get_session_violations(
	session_id: str,
	db: Session = Depends(database.get_db),
	current_user=Depends(require_role(["super_admin", "institute_admin", "faculty", "proctor"])),
):
	"""Get all violations logged for a session."""
	session = db.query(models.ExamSession).filter(models.ExamSession.id == session_id).first()
	if not session:
		raise HTTPException(status_code=404, detail="Session not found")
	
	if current_user.role != "super_admin" and str(session.institute_id) != str(current_user.institute_id):
		raise HTTPException(status_code=403, detail="Unauthorized institute access")
	
	violations = db.query(models.ViolationLog).filter(
		models.ViolationLog.session_id == session_id
	).order_by(models.ViolationLog.timestamp.desc()).all()
	
	return {
		"session_id": str(session.id),
		"violation_count": session.violation_count or 0,
		"violations": [
			{
				"id": str(v.id),
				"type": v.violation_type,
				"timestamp": v.timestamp.isoformat() if v.timestamp else None,
				"screenshot_path": v.screenshot_path,
				"video_clip_path": v.video_clip_path,
				"metadata": v.extra_data,
			}
			for v in violations
		]
	}


@router.get("/proctoring/evidence/{session_id}/{filename:path}")
async def get_violation_evidence(
	session_id: str,
	filename: str,
	db: Session = Depends(database.get_db),
	current_user=Depends(require_role(["super_admin", "institute_admin", "faculty", "proctor"])),
):
	"""Serve evidence files (screenshots/video clips)."""
	from fastapi.responses import FileResponse
	
	session = db.query(models.ExamSession).filter(models.ExamSession.id == session_id).first()
	if not session:
		raise HTTPException(status_code=404, detail="Session not found")
	
	if current_user.role != "super_admin" and str(session.institute_id) != str(current_user.institute_id):
		raise HTTPException(status_code=403, detail="Unauthorized institute access")
	
	filepath = EVIDENCE_DIR / session_id / filename
	if not filepath.exists() or not filepath.is_file():
		raise HTTPException(status_code=404, detail="Evidence file not found")
	
	# Security: ensure path doesn't escape evidence directory
	try:
		filepath.resolve().relative_to(EVIDENCE_DIR.resolve())
	except ValueError:
		raise HTTPException(status_code=403, detail="Invalid file path")
	
	if filename.endswith(".jpg"):
		media_type = "image/jpeg"
	elif filename.endswith(".wav"):
		media_type = "audio/wav"
	else:
		media_type = "video/mp4"
	return FileResponse(filepath, media_type=media_type)


@router.websocket("/proctoring/ws/{session_id}")
async def proctoring_webrtc_signaling(websocket: WebSocket, session_id: str):
	db = database.SessionLocal()
	ws_role = ""
	client_key = ""
	try:
		token = websocket.query_params.get("token")
		requested_role = (websocket.query_params.get("role") or "").strip().lower()
		if not token or requested_role not in {"student", "proctor"}:
			await websocket.close(code=1008)
			return

		principal = _resolve_principal_from_token(token, db)
		if requested_role == "student" and principal.role != "student":
			await websocket.close(code=1008)
			return
		if requested_role == "proctor" and principal.role not in {"proctor", "exam_admin", "institute_admin", "super_admin"}:
			await websocket.close(code=1008)
			return

		_validate_session_access(session_id, None, principal, db)

		await websocket.accept()
		ws_role = requested_role
		client_key = f"{ws_role}:{principal.id}"
		_webrtc_clients.setdefault(session_id, {})[client_key] = websocket

		await websocket.send_json({
			"type": "signaling-ready",
			"role": ws_role,
			"session_id": session_id,
		})

		while True:
			message = await websocket.receive_json()
			msg_type = message.get("type")
			
			# Handle heartbeat ping
			if msg_type == "ping":
				try:
					await websocket.send_json({"type": "pong"})
				except Exception:
					pass
				continue
			
			if msg_type == "rtc-ready":
				target_role = "proctor" if ws_role == "student" else "student"
				for key, peer_ws in _webrtc_clients.get(session_id, {}).items():
					if key.startswith(f"{target_role}:"):
						await peer_ws.send_json({
                "type": "webrtc-ready",
                "from_role": ws_role,
                "from_user_id": principal.id,
            })
				continue

			target_role = "proctor" if ws_role == "student" else "student"
			clients = _webrtc_clients.get(session_id, {})
			for key, peer_ws in clients.items():
				if not key.startswith(f"{target_role}:"):
					continue
				try:
					await peer_ws.send_json({
						"type": msg_type,
						"from_role": ws_role,
						"from_user_id": principal.id,
						"payload": message.get("payload"),
					})
				except Exception:
					continue
	except WebSocketDisconnect:
		pass
	except Exception:
		try:
			await websocket.close(code=1011)
		except Exception:
			pass
	finally:
		if client_key:
			clients = _webrtc_clients.get(session_id)
			if clients and client_key in clients:
				del clients[client_key]
			if clients is not None and len(clients) == 0:
				_webrtc_clients.pop(session_id, None)
		db.close()
