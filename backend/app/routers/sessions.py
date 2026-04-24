from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import database, models, schemas
from ..security import require_role

router = APIRouter()
require_admin = require_role(["super_admin", "institute_admin", "exam_admin", "proctor"])


def _map_status(status: str | None) -> str:
    if not status:
        return "completed"
    value = status.lower()
    if value in {"ongoing", "active", "not_started", "started"}:
        return "in_progress"
    if value in {"submitted", "completed"}:
        return "completed"
    if value in {"disqualified", "terminated", "flagged"}:
        return "terminated"
    if value in {"missed"}:
        return "missed"
    return value


@router.post("/sessions/", response_model=schemas.ExamSessionOut, status_code=201)
def create_session(
    payload: schemas.ExamSessionCreate,
    db: Session = Depends(database.get_db),
    current_user=Depends(require_role(["super_admin", "institute_admin", "exam_admin", "proctor", "student"])),
):
    student = db.query(models.Student).filter(models.Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    exam = db.query(models.Exam).filter(models.Exam.id == payload.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    if str(student.institute_id) != str(exam.institute_id):
        raise HTTPException(status_code=400, detail="Student and exam belong to different institutes")

    status = _map_status(payload.status)
    now = datetime.now(timezone.utc)
    session = models.ExamSession(
        institute_id=exam.institute_id,
        student_id=student.id,
        exam_id=exam.id,
        session_status=status,
        started_at=now if status in ("in_progress", "completed", "terminated") else None,
        completed_at=now if status in ("completed", "terminated", "missed") else None,
        final_score=payload.score,
        violation_found=status == "terminated",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return schemas.ExamSessionOut(
        id=str(session.id),
        institute_id=str(session.institute_id),
        student_id=str(session.student_id),
        exam_id=str(session.exam_id),
        status=session.session_status,
        score=session.final_score,
        integrity=payload.integrity,
        started_at=session.started_at,
        completed_at=session.completed_at,
        violation_found=session.violation_found,
        mongo_log_ref=session.mongo_log_ref,
        s3_media_prefix=session.s3_media_prefix,
    )


@router.get("/sessions/", response_model=list[schemas.ExamSessionOut])
def list_sessions(
    db: Session = Depends(database.get_db),
    current_user=Depends(require_admin),
):
    if current_user.role == "super_admin":
        rows = db.query(models.ExamSession).all()
    else:
        rows = db.query(models.ExamSession).filter(models.ExamSession.institute_id == current_user.institute_id).all()

    return [
        schemas.ExamSessionOut(
            id=str(row.id),
            institute_id=str(row.institute_id),
            student_id=str(row.student_id),
            exam_id=str(row.exam_id),
            status=row.session_status,
            score=row.final_score,
            integrity=None,
            started_at=row.started_at,
            completed_at=row.completed_at,
            violation_found=row.violation_found,
            mongo_log_ref=row.mongo_log_ref,
            s3_media_prefix=row.s3_media_prefix,
        )
        for row in rows
    ]


@router.get("/sessions/me", response_model=list[schemas.ExamSessionOut])
def list_my_sessions(
    db: Session = Depends(database.get_db),
    current_user=Depends(require_role(["student", "proctor", "exam_admin", "institute_admin", "super_admin"])),
):
    if current_user.role == "student":
        rows = db.query(models.ExamSession).filter(models.ExamSession.student_id == current_user.id).all()
    elif current_user.role == "super_admin":
        rows = db.query(models.ExamSession).all()
    else:
        rows = db.query(models.ExamSession).filter(models.ExamSession.institute_id == current_user.institute_id).all()

    return [
        schemas.ExamSessionOut(
            id=str(row.id),
            institute_id=str(row.institute_id),
            student_id=str(row.student_id),
            exam_id=str(row.exam_id),
            status=row.session_status,
            score=row.final_score,
            integrity=None,
            started_at=row.started_at,
            completed_at=row.completed_at,
            violation_found=row.violation_found,
            mongo_log_ref=row.mongo_log_ref,
            s3_media_prefix=row.s3_media_prefix,
        )
        for row in rows
    ]


@router.get("/sessions/exam/{exam_id}", response_model=list[schemas.ExamSessionOut])
def list_exam_attempts(
    exam_id: str,
    db: Session = Depends(database.get_db),
    current_user=Depends(require_role(["super_admin", "institute_admin", "exam_admin", "proctor"])),
):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    if current_user.role != "super_admin" and str(current_user.institute_id) != str(exam.institute_id):
        raise HTTPException(status_code=403, detail="Unauthorized to view this exam's attempts")

    rows = db.query(models.ExamSession).filter(models.ExamSession.exam_id == exam_id).all()
    return [
        schemas.ExamSessionOut(
            id=str(row.id),
            institute_id=str(row.institute_id),
            student_id=str(row.student_id),
            exam_id=str(row.exam_id),
            status=row.session_status,
            score=row.final_score,
            integrity=None,
            started_at=row.started_at,
            completed_at=row.completed_at,
            violation_found=row.violation_found,
            mongo_log_ref=row.mongo_log_ref,
            s3_media_prefix=row.s3_media_prefix,
        )
        for row in rows
    ]


@router.get("/sessions/exam/{exam_id}/details", response_model=list[dict])
def list_exam_attempts_with_details(
    exam_id: str,
    db: Session = Depends(database.get_db),
    current_user=Depends(require_role(["super_admin", "institute_admin", "exam_admin", "proctor"])),
):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    if current_user.role != "super_admin" and str(current_user.institute_id) != str(exam.institute_id):
        raise HTTPException(status_code=403, detail="Unauthorized to view this exam's attempts")

    rows = db.query(models.ExamSession).filter(models.ExamSession.exam_id == exam_id).all()
    result = []
    for row in rows:
        student = db.query(models.Student).filter(models.Student.id == row.student_id).first()
        if not student:
            continue
        result.append(
            {
                "id": str(row.id),
                "student_id": str(row.student_id),
                "student_email": student.email,
                "student_name": student.name,
                "exam_id": str(row.exam_id),
                "status": row.session_status,
                "score": row.final_score,
                "integrity": None,
            }
        )
    return result


@router.post("/sessions/exam/{exam_id}/missed", response_model=schemas.ExamSessionOut)
def mark_exam_missed(
    exam_id: str,
    db: Session = Depends(database.get_db),
    current_user=Depends(require_role(["student"])),
):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    student = db.query(models.Student).filter(models.Student.id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    assignment = db.query(models.ExamAssignment).filter(
        models.ExamAssignment.institute_id == student.institute_id,
        models.ExamAssignment.exam_id == exam.id,
        models.ExamAssignment.batch_id == student.batch_id,
    ).first()
    if not assignment:
        raise HTTPException(status_code=403, detail="Exam not assigned")

    existing = db.query(models.ExamSession).filter(
        models.ExamSession.institute_id == student.institute_id,
        models.ExamSession.student_id == student.id,
        models.ExamSession.exam_id == exam.id,
    ).first()
    if existing:
        return schemas.ExamSessionOut(
            id=str(existing.id),
            institute_id=str(existing.institute_id),
            student_id=str(existing.student_id),
            exam_id=str(existing.exam_id),
            status=existing.session_status,
            score=existing.final_score,
            integrity=None,
            started_at=existing.started_at,
            completed_at=existing.completed_at,
            violation_found=existing.violation_found,
            mongo_log_ref=existing.mongo_log_ref,
            s3_media_prefix=existing.s3_media_prefix,
        )

    now = datetime.now(timezone.utc)
    session = models.ExamSession(
        institute_id=student.institute_id,
        student_id=student.id,
        exam_id=exam.id,
        session_status="missed",
        completed_at=now,
        final_score=0,
        violation_found=False,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return schemas.ExamSessionOut(
        id=str(session.id),
        institute_id=str(session.institute_id),
        student_id=str(session.student_id),
        exam_id=str(session.exam_id),
        status=session.session_status,
        score=session.final_score,
        integrity=None,
        started_at=session.started_at,
        completed_at=session.completed_at,
        violation_found=session.violation_found,
        mongo_log_ref=session.mongo_log_ref,
        s3_media_prefix=session.s3_media_prefix,
    )


@router.post("/sessions/exam/{exam_id}/start", response_model=schemas.ExamSessionOut)
def start_exam_session(
    exam_id: str,
    db: Session = Depends(database.get_db),
    current_user=Depends(require_role(["student"])),
):
    from .proctoring import reset_session_messages

    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    student = db.query(models.Student).filter(models.Student.id == current_user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    assignment = db.query(models.ExamAssignment).filter(
        models.ExamAssignment.institute_id == student.institute_id,
        models.ExamAssignment.exam_id == exam.id,
        models.ExamAssignment.batch_id == student.batch_id,
    ).first()
    if not assignment:
        raise HTTPException(status_code=403, detail="Exam not assigned")

    now = datetime.now(timezone.utc)
    existing = db.query(models.ExamSession).filter(
        models.ExamSession.institute_id == student.institute_id,
        models.ExamSession.student_id == student.id,
        models.ExamSession.exam_id == exam.id,
    ).order_by(models.ExamSession.started_at.desc()).first()

    if existing:
        existing.session_status = "in_progress"
        existing.started_at = now
        existing.completed_at = None
        existing.final_score = None
        existing.violation_found = False
        existing.mongo_log_ref = None
        existing.s3_media_prefix = None
        db.commit()
        db.refresh(existing)
        reset_session_messages(str(existing.id))
        return schemas.ExamSessionOut(
            id=str(existing.id),
            institute_id=str(existing.institute_id),
            student_id=str(existing.student_id),
            exam_id=str(existing.exam_id),
            status=existing.session_status,
            score=existing.final_score,
            integrity=None,
            started_at=existing.started_at,
            completed_at=existing.completed_at,
            violation_found=existing.violation_found,
            mongo_log_ref=existing.mongo_log_ref,
            s3_media_prefix=existing.s3_media_prefix,
        )

    session = models.ExamSession(
        institute_id=student.institute_id,
        student_id=student.id,
        exam_id=exam.id,
        session_status="in_progress",
        started_at=now,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    reset_session_messages(str(session.id))

    return schemas.ExamSessionOut(
        id=str(session.id),
        institute_id=str(session.institute_id),
        student_id=str(session.student_id),
        exam_id=str(session.exam_id),
        status=session.session_status,
        score=session.final_score,
        integrity=None,
        started_at=session.started_at,
        completed_at=session.completed_at,
        violation_found=session.violation_found,
        mongo_log_ref=session.mongo_log_ref,
        s3_media_prefix=session.s3_media_prefix,
    )


@router.post("/sessions/{session_id}/complete", response_model=schemas.ExamSessionOut)
def complete_exam_session(
    session_id: str,
    payload: schemas.ExamSessionComplete,
    db: Session = Depends(database.get_db),
    current_user=Depends(require_role(["student", "super_admin", "institute_admin", "exam_admin", "proctor"])),
):
    session = db.query(models.ExamSession).filter(models.ExamSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user.role == "student" and str(session.student_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Unauthorized to complete this session")

    if current_user.role != "super_admin" and str(session.institute_id) != str(current_user.institute_id):
        raise HTTPException(status_code=403, detail="Unauthorized institute access")

    normalized_status = (payload.status or "submitted").lower()
    if normalized_status in {"submitted", "completed"}:
        session.session_status = "completed"
    elif normalized_status in {"terminated", "disqualified", "flagged"}:
        session.session_status = "terminated"
        session.violation_found = True
    elif normalized_status == "missed":
        session.session_status = "missed"
    else:
        session.session_status = "completed"

    session.final_score = payload.score
    session.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(session)

    return schemas.ExamSessionOut(
        id=str(session.id),
        institute_id=str(session.institute_id),
        student_id=str(session.student_id),
        exam_id=str(session.exam_id),
        status=session.session_status,
        score=session.final_score,
        integrity=payload.integrity,
        started_at=session.started_at,
        completed_at=session.completed_at,
        violation_found=session.violation_found,
        mongo_log_ref=session.mongo_log_ref,
        s3_media_prefix=session.s3_media_prefix,
    )
