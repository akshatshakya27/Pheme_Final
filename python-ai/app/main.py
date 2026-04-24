"""Desktop Exam Proctoring Service (FastAPI)."""

import base64
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Optional: MediaPipe for advanced detection
try:
    import mediapipe as mp
    HAS_MEDIAPIPE = True
except ImportError:
    HAS_MEDIAPIPE = False

# Optional: YOLO for object detection
try:
    import torch
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Pheme Proctoring AI Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load face detection models
try:
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    )
    logger.info("Loaded Haar Cascade for face detection")
except Exception as e:
    logger.error(f"Failed to load face cascade: {e}")
    face_cascade = None

# Initialize MediaPipe if available
if HAS_MEDIAPIPE:
    mp_face_detection = mp.solutions.face_detection
    face_detector = mp_face_detection.FaceDetection(min_detection_confidence=0.5)
    logger.info("Initialized MediaPipe face detection")
else:
    face_detector = None

# Session management with violation tracking
active_sessions: Dict[str, dict] = {}

class SessionData:
    """Track violations per session"""
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.violation_counts: Dict[str, int] = defaultdict(int)
        self.violations_list: List[Dict[str, Any]] = []
        self.frames_processed = 0
        self.last_face_detected = datetime.utcnow()
        self.no_face_frames = 0
        self.consecutive_no_face = 0

    def log_violation(self, violation_type: str, details: Optional[Dict] = None):
        """Log a violation and track counts"""
        self.violation_counts[violation_type] += 1
        self.violations_list.append({
            "type": violation_type,
            "timestamp": datetime.utcnow().isoformat(),
            "details": details or {}
        })

class AnalyzeFrameRequest(BaseModel):
    session_id: str
    frame: str
    audio_level: Optional[float] = None


@app.get('/health')
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "proctoring-ai"}


@app.post('/api/proctoring/analyze-frame')
def analyze_frame(payload: AnalyzeFrameRequest) -> Dict[str, Any]:
    """Analyze exam frame for visual and audio proctoring violations."""
    try:
        frame_data = payload.frame
        session_id = payload.session_id
        audio_level = payload.audio_level or 0.0

        if not frame_data or not session_id:
            raise HTTPException(status_code=400, detail="Missing frame or session_id")

        # Initialize session if new
        if session_id not in active_sessions:
            active_sessions[session_id] = SessionData(session_id)

        session = active_sessions[session_id]
        session.frames_processed += 1

        # Decode base64 frame
        frame_bytes = base64.b64decode(frame_data.split(',')[1] if ',' in frame_data else frame_data)
        nparr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid frame data")

        # Initialize violations list for this frame
        frame_violations: List[str] = []

        # Run detections
        results = {
            "session_id": session_id,
            "timestamp": datetime.utcnow().isoformat(),
            "face_count": 0,
            "faces": [],
            "phone_detected": False,
            "phone_confidence": 0.0,
            "document_detected": False,
                "multiple_people": False,
            "violations": [],
            "violation_counts": {},
            "audio_violation": False,
        }

        # Face detection with violation tracking
        face_count, faces = detect_faces(frame)
        results["face_count"] = face_count
        results["faces"] = faces

        if face_count == 0:
            frame_violations.append("no_face")
            session.consecutive_no_face += 1
            session.no_face_frames += 1
            session.log_violation("no_face", {"frame": session.frames_processed})
        else:
            session.consecutive_no_face = 0
            session.last_face_detected = datetime.utcnow()

        if face_count > 1:
            frame_violations.append("multiple_faces")
            results["multiple_people"] = True
            session.log_violation("multiple_faces", {"count": face_count})

        # Object detection (phone, documents)
        phone_detected, phone_conf = detect_phone(frame)
        if phone_detected:
            results["phone_detected"] = True
            results["phone_confidence"] = float(phone_conf)
            frame_violations.append("phone_detected")
            session.log_violation("phone_detected", {"confidence": phone_conf})

        document_detected = detect_document(frame)
        if document_detected:
            results["document_detected"] = True
            frame_violations.append("document_detected")
            session.log_violation("document_detected")

        # Audio violation detection
        audio_violation = detect_audio_violation(audio_level)
        if audio_violation:
            frame_violations.append("audio_violation")
            results["audio_violation"] = True
            session.log_violation("audio_violation", {"level": audio_level})

        results["violations"] = frame_violations
        results["violation_counts"] = dict(session.violation_counts)
        results["total_violations"] = len(session.violations_list)

        logger.info(f"Frame {session.frames_processed} for session {session_id}: {frame_violations} | Total: {results['violation_counts']}")
        return results

    except Exception as e:
        logger.error(f"Frame analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/api/proctoring/session/{session_id}')
def get_session_status(session_id: str) -> Dict[str, Any]:
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session: SessionData = active_sessions[session_id]
    return {
        "session_id": session_id,
        "violations_count": len(session.violations_list),
        "violation_counts": dict(session.violation_counts),
        "violations": session.violations_list[-20:],  # Last 20 violations
        "frames_processed": session.frames_processed,
        "no_face_frames": session.no_face_frames,
        "last_face_detected": session.last_face_detected.isoformat(),
    }


@app.delete('/api/proctoring/session/{session_id}')
def end_session(session_id: str) -> Dict[str, Any]:
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session: SessionData = active_sessions[session_id]
    summary = {
        "success": True,
        "session_id": session_id,
        "total_violations": len(session.violations_list),
        "violation_counts": dict(session.violation_counts),
        "frames_processed": session.frames_processed,
    }
    
    del active_sessions[session_id]
    logger.info(f"Ended session {session_id}: {summary['violation_counts']}")
    return summary


# Detection Functions
def detect_faces(frame) -> Tuple[int, List[dict]]:
    """Detect faces in frame using multiple methods"""
    faces = []

    # Try MediaPipe first for better accuracy
    if HAS_MEDIAPIPE and face_detector is not None:
        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_detector.process(rgb_frame)

            if results.detections:
                h, w, _ = frame.shape
                for detection in results.detections:
                    bbox = detection.location_data.relative_bounding_box
                    x = int(bbox.xmin * w)
                    y = int(bbox.ymin * h)
                    box_w = int(bbox.width * w)
                    box_h = int(bbox.height * h)

                    faces.append({
                        "x": x,
                        "y": y,
                        "width": box_w,
                        "height": box_h,
                        "confidence": float(detection.score[0]) if detection.score else 0.85,
                    })
            return len(faces), faces
        except Exception as e:
            logger.warning(f"MediaPipe detection failed: {e}")

    # Fallback to Haar Cascade
    if face_cascade is not None:
        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            detected = face_cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
            )

            for (x, y, w, h) in detected:
                faces.append({
                    "x": int(x),
                    "y": int(y),
                    "width": int(w),
                    "height": int(h),
                    "confidence": 0.7,
                })
        except Exception as e:
            logger.warning(f"Haar Cascade detection failed: {e}")

    return len(faces), faces


def detect_phone(frame) -> Tuple[bool, float]:
    """
    Detect if phone is present in frame
    Uses YOLO or simple color detection
    """
    # Simple heuristic: detect bright rectangular objects (like phone screens)
    # In production, use proper object detection model

    if not HAS_TORCH:
        # Fallback: basic shape detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 100, 200)
        contours, _ = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

        for contour in contours:
            area = cv2.contourArea(contour)
            x, y, w, h = cv2.boundingRect(contour)

            # Phone-like aspect ratio (6:10 to 10:6)
            if area > 5000 and (0.6 <= w / h <= 1.6 or 0.6 <= h / w <= 1.6):
                return True, 0.6

        return False, 0.0

    # TODO: Implement YOLOv5 phone detection
    return False, 0.0


def detect_document(frame) -> bool:
    """
    Detect if documents are visible in frame
    Looks for white/light colored rectangular objects
    """
    try:
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

        # Define range for white/light colors
        lower_white = np.array([0, 0, 200])
        upper_white = np.array([180, 30, 255])

        mask = cv2.inRange(hsv, lower_white, upper_white)
        contours, _ = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

        # Look for large white/light areas (documents)
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > 10000:  # Large light area like document
                return True
    except Exception as e:
        logger.warning(f"Document detection error: {e}")

    return False


def detect_audio_violation(audio_level: float) -> bool:
    """
    Detect audio violations based on sound level
    High audio levels indicate speaking/background noise
    """
    # Audio threshold: anything above 0.3 (normalized 0-1 scale) is considereda violation
    # This indicates speech or loud background noise
    return audio_level > 0.3


if __name__ == '__main__':
    import uvicorn

    port = int(os.getenv('PROCTORING_PORT', os.getenv('FLASK_PORT', '5050')))
    logger.info("Starting Pheme Proctoring AI Service (FastAPI)...")
    uvicorn.run(app, host='127.0.0.1', port=port)
