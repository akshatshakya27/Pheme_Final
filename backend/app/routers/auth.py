from fastapi import APIRouter, Depends, Form, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from .. import database, models, schemas
from ..security import create_access_token, get_current_user, get_password_hash, require_role, verify_password

router = APIRouter()
require_admin = require_role(["super_admin", "institute_admin", "exam_admin"])


def _resolve_admin_by_email(db: Session, email: str):
    super_admin = db.query(models.SuperAdmin).filter(models.SuperAdmin.email == email).first()
    if super_admin:
        return super_admin, "super_admin"

    institute_admin = db.query(models.InstituteAdmin).filter(models.InstituteAdmin.email == email).first()
    if institute_admin:
        return institute_admin, "institute_admin"

    faculty = db.query(models.Faculty).filter(models.Faculty.email == email).first()
    if faculty:
        return faculty, "exam_admin"

    return None, None


@router.post("/login", response_model=schemas.Token)
async def login(
    email: str = Form(...),
    password: str = Form(...),
    role: str = Form(...),
    db: Session = Depends(database.get_db),
):
    if role not in ("admin", "proctor", "student"):
        raise HTTPException(status_code=400, detail="Role must be 'admin', 'proctor', or 'student'")

    if role == "student":
        user = db.query(models.Student).filter(
            or_(models.Student.email == email, models.Student.student_code == email)
        ).first()
        resolved_role = "student"
    elif role == "proctor":
        user = db.query(models.Faculty).filter(models.Faculty.email == email).first()
        resolved_role = "proctor"
    else:
        user, resolved_role = _resolve_admin_by_email(db, email)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password")

    access_token = create_access_token({"sub": str(user.id), "role": resolved_role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": str(user.id),
        "role": resolved_role,
    }


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user=Depends(get_current_user)):
    return schemas.UserOut(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        institute_id=current_user.institute_id,
        batch_id=current_user.batch_id,
        code=current_user.code,
    )


@router.post("/users/", response_model=schemas.UserOut, status_code=201)
def create_user(
    user: schemas.UserCreate,
    db: Session = Depends(database.get_db),
    current_user=Depends(require_admin),
):
    role_value = user.role

    institute_id = user.institute_id
    if current_user.role != "super_admin":
        institute_id = current_user.institute_id

    if role_value != "super_admin" and institute_id is None:
        raise HTTPException(status_code=400, detail="institute_id is required")

    if role_value == "super_admin":
        existing = db.query(models.SuperAdmin).filter(models.SuperAdmin.email == user.email).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")
        entity = models.SuperAdmin(email=user.email, password_hash=get_password_hash(user.password))
        db.add(entity)
        db.commit()
        db.refresh(entity)
        return schemas.UserOut(id=str(entity.id), email=entity.email, role="super_admin", name=user.name)

    if role_value == "institute_admin":
        if not user.emp_id:
            raise HTTPException(status_code=400, detail="emp_id is required for institute_admin")
        existing = db.query(models.InstituteAdmin).filter(models.InstituteAdmin.email == user.email).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")
        entity = models.InstituteAdmin(
            institute_id=institute_id,
            emp_id=user.emp_id,
            name=user.name,
            email=user.email,
            password_hash=get_password_hash(user.password),
        )
        db.add(entity)
        db.commit()
        db.refresh(entity)
        return schemas.UserOut(
            id=str(entity.id),
            institute_id=str(entity.institute_id),
            email=entity.email,
            role="institute_admin",
            name=entity.name,
            code=entity.admin_code,
        )

    if role_value in ("exam_admin", "proctor"):
        if not user.emp_id or not user.dept_code:
            raise HTTPException(status_code=400, detail="emp_id and dept_code are required for exam_admin/proctor")
        existing = db.query(models.Faculty).filter(models.Faculty.email == user.email).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")
        entity = models.Faculty(
            institute_id=institute_id,
            dept_code=user.dept_code.upper(),
            emp_id=user.emp_id,
            name=user.name,
            email=user.email,
            password_hash=get_password_hash(user.password),
        )
        db.add(entity)
        db.commit()
        db.refresh(entity)
        return schemas.UserOut(
            id=str(entity.id),
            institute_id=str(entity.institute_id),
            email=entity.email,
            role=role_value,
            name=entity.name,
            code=entity.faculty_code,
        )

    if role_value == "student":
        if not user.batch_id or not user.section or not user.roll_no:
            raise HTTPException(status_code=400, detail="batch_id, section, and roll_no are required for student")
        batch = db.query(models.Batch).filter(models.Batch.id == user.batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        if str(batch.institute_id) != str(institute_id):
            raise HTTPException(status_code=400, detail="Batch does not belong to institute")

        existing = db.query(models.Student).filter(models.Student.email == user.email).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        entity = models.Student(
            institute_id=institute_id,
            batch_id=user.batch_id,
            section=user.section,
            roll_no=user.roll_no,
            name=user.name,
            email=user.email,
            password_hash=get_password_hash(user.password),
        )
        db.add(entity)
        db.commit()
        db.refresh(entity)
        return schemas.UserOut(
            id=str(entity.id),
            institute_id=str(entity.institute_id),
            batch_id=str(entity.batch_id),
            email=entity.email,
            role="student",
            name=entity.name,
            code=entity.student_code,
        )

    raise HTTPException(status_code=400, detail="Unsupported role")
