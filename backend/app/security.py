import os
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Optional, List, Callable, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .database import get_db
from . import models

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")


@dataclass
class AuthPrincipal:
    id: str
    role: str
    email: str
    institute_id: Optional[str] = None
    batch_id: Optional[str] = None
    name: Optional[str] = None
    password_hash: Optional[str] = None
    code: Optional[str] = None


def _get_jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET_KEY")
    if not secret:
        raise RuntimeError("JWT_SECRET_KEY is not set")
    return secret


def _get_access_token_expiry_minutes() -> int:
    raw = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    try:
        return int(raw)
    except ValueError:
        return 60


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=_get_access_token_expiry_minutes()))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, _get_jwt_secret(), algorithm=os.getenv("JWT_ALGORITHM", "HS256"))


def decode_access_token_payload(token: str) -> dict[str, Any]:
    return jwt.decode(token, _get_jwt_secret(), algorithms=[os.getenv("JWT_ALGORITHM", "HS256")])


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> AuthPrincipal:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token_payload(token)
        user_id = payload.get("sub")
        role = payload.get("role")
        if user_id is None or role is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    if role == "super_admin":
        user = db.query(models.SuperAdmin).filter(models.SuperAdmin.id == user_id).first()
        if user:
            return AuthPrincipal(id=str(user.id), role="super_admin", email=user.email, password_hash=user.password_hash)

    elif role in ("institute_admin", "admin"):
        user = db.query(models.InstituteAdmin).filter(models.InstituteAdmin.id == user_id).first()
        if user:
            return AuthPrincipal(
                id=str(user.id),
                role="institute_admin",
                email=user.email,
                institute_id=str(user.institute_id),
                name=user.name,
                password_hash=user.password_hash,
                code=user.admin_code,
            )

    elif role in ("exam_admin", "proctor", "faculty"):
        user = db.query(models.Faculty).filter(models.Faculty.id == user_id).first()
        if user:
            resolved_role = "proctor" if role == "proctor" else "exam_admin"
            return AuthPrincipal(
                id=str(user.id),
                role=resolved_role,
                email=user.email,
                institute_id=str(user.institute_id),
                name=user.name,
                password_hash=user.password_hash,
                code=user.faculty_code,
            )

    elif role in ("student", "student_legacy"):
        user = db.query(models.Student).filter(models.Student.id == user_id).first()
        if user:
            return AuthPrincipal(
                id=str(user.id),
                role="student",
                email=user.email,
                institute_id=str(user.institute_id),
                batch_id=str(user.batch_id),
                name=user.name,
                password_hash=user.password_hash,
                code=user.student_code,
            )

    raise credentials_exception


def require_role(roles: List[str]) -> Callable:
    def _role_guard(current_user: AuthPrincipal = Depends(get_current_user)) -> AuthPrincipal:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return _role_guard
