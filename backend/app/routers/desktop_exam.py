"""Desktop exam endpoints aligned to current database schema."""

import os
from datetime import datetime
from typing import Any, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..security import AuthPrincipal, get_current_user

router = APIRouter()

# Build-phase behavior: allow repeated attempts for the same student+exam.
ALLOW_UNLIMITED_RETAKES = os.getenv("DESKTOP_UNLIMITED_RETAKES", "true").lower() == "true"
TAB_SWITCH_LIMIT = max(1, int(os.getenv("DESKTOP_TAB_SWITCH_LIMIT", "3")))


class ExamResponse(BaseModel):
    id: str
    title: str
    description: str
    duration_minutes: int
    total_questions: int
    status: str


class ExamSessionStart(BaseModel):
    exam_id: str


class ExamAnswer(BaseModel):
    question_id: str
    answer: str
    time_spent_seconds: int = 0


class ExamSubmission(BaseModel):
    session_id: str
    answers: List[ExamAnswer]


class ProctoringEventIn(BaseModel):
    session_id: str
    event_type: str
    event_data: dict[str, Any] | None = None


def _require_student(current_user: AuthPrincipal) -> None:
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can access desktop exam endpoints",
        )


def _get_student_or_404(db: Session, student_id: str):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.get("/desktop-exam/my-exams", response_model=List[ExamResponse])
def get_student_exams(
    current_user: AuthPrincipal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_student(current_user)
    student = _get_student_or_404(db, current_user.id)

    assignments = db.query(models.ExamAssignment).filter(
        models.ExamAssignment.institute_id == student.institute_id,
        models.ExamAssignment.batch_id == student.batch_id,
    ).all()

    if not assignments:
        return []

    exam_ids = [a.exam_id for a in assignments]
    exams = db.query(models.Exam).filter(
        models.Exam.institute_id == student.institute_id,
        models.Exam.id.in_(exam_ids),
    ).all()

    result: List[ExamResponse] = []
    for exam in exams:
        total_questions = db.query(models.Question).filter(models.Question.exam_id == exam.id).count()
        result.append(
            ExamResponse(
                id=str(exam.id),
                title=exam.title,
                description=f"{exam.subject_code} | {exam.exam_type} | {exam.exam_year}",
                duration_minutes=exam.duration_minutes,
                total_questions=total_questions,
                status="available",
            )
        )
    return result


@router.post("/desktop-exam/start-session")
def start_exam_session(
    payload: ExamSessionStart,
    current_user: AuthPrincipal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from .proctoring import reset_session_messages

    _require_student(current_user)
    student = _get_student_or_404(db, current_user.id)

    exam = db.query(models.Exam).filter(
        models.Exam.id == payload.exam_id,
        models.Exam.institute_id == student.institute_id,
    ).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    assignment = db.query(models.ExamAssignment).filter(
        models.ExamAssignment.institute_id == student.institute_id,
        models.ExamAssignment.batch_id == student.batch_id,
        models.ExamAssignment.exam_id == exam.id,
    ).first()
    if not assignment:
        raise HTTPException(status_code=403, detail="Exam is not assigned to this student")

    def _resolve_existing_session(session: models.ExamSession) -> models.ExamSession:
        if session.session_status in ("not_started", "in_progress"):
            if session.session_status == "not_started":
                session.session_status = "in_progress"
                session.started_at = session.started_at or datetime.utcnow()
                db.commit()
                db.refresh(session)
            return session

        # Build-phase retakes: reopen completed sessions as a fresh in-progress attempt.
        if session.session_status == "completed" and ALLOW_UNLIMITED_RETAKES:
            session.session_status = "in_progress"
            session.started_at = datetime.utcnow()
            session.completed_at = None
            session.final_score = None
            session.violation_found = False
            session.violation_count = 0
            session.mongo_log_ref = None
            session.s3_media_prefix = None
            db.commit()
            db.refresh(session)
            return session

        # If a stale record is marked completed without a completed_at timestamp,
        # reopen it as in-progress for recovery.
        if session.session_status == "completed" and session.completed_at is None:
            session.session_status = "in_progress"
            session.started_at = datetime.utcnow()
            session.completed_at = None
            session.final_score = None
            db.commit()
            db.refresh(session)
            return session

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already submitted this exam.",
        )

    existing = db.query(models.ExamSession).filter(
        models.ExamSession.institute_id == student.institute_id,
        models.ExamSession.exam_id == exam.id,
        models.ExamSession.student_id == student.id,
    ).order_by(models.ExamSession.started_at.desc()).first()

    if existing:
        session = _resolve_existing_session(existing)
    else:
        session_code = f"DESKTOP-{str(student.id)[:8]}-{str(exam.id)[:8]}-{uuid4().hex[:8]}"
        session = models.ExamSession(
            institute_id=student.institute_id,
            exam_id=exam.id,
            student_id=student.id,
            session_code=session_code,
            session_status="in_progress",
            started_at=datetime.utcnow(),
        )
        db.add(session)
        try:
            db.commit()
            db.refresh(session)
        except IntegrityError:
            # Handle race/legacy duplicates gracefully by reusing existing in-progress session.
            db.rollback()
            recovered = db.query(models.ExamSession).filter(
                models.ExamSession.institute_id == student.institute_id,
                models.ExamSession.exam_id == exam.id,
                models.ExamSession.student_id == student.id,
            ).order_by(models.ExamSession.started_at.desc()).first()

            if recovered:
                session = _resolve_existing_session(recovered)
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An exam session already exists for this student.",
                )

    # Treat each start as a fresh attempt from chat perspective.
    reset_session_messages(str(session.id))

    questions = db.query(models.Question).filter(
        models.Question.institute_id == student.institute_id,
        models.Question.exam_id == exam.id,
    ).all()

    return {
        "session_id": str(session.id),
        "exam_id": str(exam.id),
        "title": exam.title,
        "duration_minutes": exam.duration_minutes,
        "questions": [
            {
                "id": str(q.id),
                "text": q.question_text,
                "options": q.options if isinstance(q.options, list) else [],
                "type": "MCQ",
            }
            for q in questions
        ],
    }


@router.post("/desktop-exam/submit")
def submit_exam(
    payload: ExamSubmission,
    current_user: AuthPrincipal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_student(current_user)
    student = _get_student_or_404(db, current_user.id)

    session = db.query(models.ExamSession).filter(
        models.ExamSession.id == payload.session_id,
        models.ExamSession.student_id == student.id,
        models.ExamSession.institute_id == student.institute_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.session_status != "in_progress":
        raise HTTPException(status_code=400, detail="Session is not in progress")

    answer_map = {str(a.question_id): str(a.answer) for a in payload.answers}
    questions = db.query(models.Question).filter(
        models.Question.institute_id == student.institute_id,
        models.Question.exam_id == session.exam_id,
    ).all()

    correct_count = 0
    for q in questions:
        if answer_map.get(str(q.id)) == str(q.correct_answer):
            correct_count += 1

    total_questions = len(questions)
    score = int(round((correct_count / total_questions) * 100)) if total_questions > 0 else 0

    session.session_status = "completed"
    session.completed_at = datetime.utcnow()
    session.final_score = score
    db.commit()

    return {
        "success": True,
        "score": score,
        "correct_answers": correct_count,
        "total_questions": total_questions,
        "message": "Exam submitted successfully",
    }


@router.post("/desktop-exam/proctor-event")
def log_proctor_event(
    payload: ProctoringEventIn,
    current_user: AuthPrincipal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_student(current_user)
    student = _get_student_or_404(db, current_user.id)

    session = db.query(models.ExamSession).filter(
        models.ExamSession.id == payload.session_id,
        models.ExamSession.student_id == student.id,
        models.ExamSession.institute_id == student.institute_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    violation = models.ViolationLog(
        institute_id=session.institute_id,
        session_id=session.id,
        violation_type=payload.event_type,
        extra_data=payload.event_data or {},
    )
    db.add(violation)
    db.flush()

    session.violation_found = True
    session.violation_count = (session.violation_count or 0) + 1

    restricted_event_types = ["tab_switch", "TAB_SWITCH", "exit_fullscreen", "EXIT_FULLSCREEN"]
    tab_switch_count = db.query(func.count(models.ViolationLog.id)).filter(
        models.ViolationLog.institute_id == session.institute_id,
        models.ViolationLog.session_id == session.id,
        models.ViolationLog.violation_type.in_(restricted_event_types),
    ).scalar() or 0

    exam_terminated = False
    if tab_switch_count >= TAB_SWITCH_LIMIT and session.session_status == "in_progress":
        session.session_status = "terminated"
        session.completed_at = datetime.utcnow()
        exam_terminated = True

    db.commit()

    return {
        "success": True,
        "message": f"Event '{payload.event_type}' logged",
        "tab_switch_count": int(tab_switch_count),
        "tab_switch_limit": TAB_SWITCH_LIMIT,
        "exam_terminated": exam_terminated,
    }


@router.get("/desktop-exam/session/{session_id}")
def get_session_status(
    session_id: str,
    current_user: AuthPrincipal = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_student(current_user)
    student = _get_student_or_404(db, current_user.id)

    session = db.query(models.ExamSession).filter(
        models.ExamSession.id == session_id,
        models.ExamSession.student_id == student.id,
        models.ExamSession.institute_id == student.institute_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    exam = db.query(models.Exam).filter(
        models.Exam.id == session.exam_id,
        models.Exam.institute_id == student.institute_id,
    ).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    elapsed = 0
    if session.started_at is not None:
        elapsed = int((datetime.utcnow() - session.started_at).total_seconds() / 60)

    return {
        "session_id": str(session.id),
        "status": session.session_status,
        "elapsed_minutes": elapsed,
        "time_remaining_minutes": max(0, int(exam.duration_minutes - elapsed)),
        "exam_title": exam.title,
    }
