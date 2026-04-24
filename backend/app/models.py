from sqlalchemy import Boolean, Column, DateTime, ForeignKey, ForeignKeyConstraint, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from .database import Base


class Institute(Base):
    __tablename__ = "institutes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    institute_code = Column(String(50), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    address = Column(Text, nullable=True)
    contact_email = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.current_timestamp())


class SuperAdmin(Base):
    __tablename__ = "super_admins"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.current_timestamp())


class InstituteAdmin(Base):
    __tablename__ = "institute_admins"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    institute_id = Column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), primary_key=True)
    emp_id = Column(String(50), nullable=False)
    admin_code = Column(String(100), nullable=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.current_timestamp())


class Faculty(Base):
    __tablename__ = "faculties"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    institute_id = Column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), primary_key=True)
    dept_code = Column(String(50), nullable=False)
    emp_id = Column(String(50), nullable=False)
    faculty_code = Column(String(100), nullable=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.current_timestamp())


class Batch(Base):
    __tablename__ = "batches"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    institute_id = Column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), primary_key=True)
    course_code = Column(String(50), nullable=False)
    batch_year = Column(String(10), nullable=False)
    batch_code = Column(String(100), nullable=True)
    course_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.current_timestamp())

    @property
    def name(self) -> str:
        return self.course_name

    @property
    def members(self) -> list[str]:
        return []


class Student(Base):
    __tablename__ = "students"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    institute_id = Column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), primary_key=True)
    batch_id = Column(UUID(as_uuid=True), nullable=False)
    section = Column(String(10), nullable=False)
    roll_no = Column(String(50), nullable=False)
    student_code = Column(String(150), nullable=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.current_timestamp())


class Exam(Base):
    __tablename__ = "exams"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    institute_id = Column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), primary_key=True)
    faculty_id = Column(UUID(as_uuid=True), nullable=False)
    subject_code = Column(String(50), nullable=False)
    exam_type = Column(String(50), nullable=False)
    exam_year = Column(String(10), nullable=False)
    exam_code = Column(String(100), nullable=True)
    title = Column(String(255), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    passing_marks = Column(Integer, nullable=False)
    scheduled_time = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.current_timestamp())

    @property
    def duration(self) -> int:
        return self.duration_minutes


class Question(Base):
    __tablename__ = "ques_ans"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    institute_id = Column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), primary_key=True)
    exam_id = Column(UUID(as_uuid=True), nullable=False)
    question_text = Column(Text, nullable=False)
    options = Column(JSONB, nullable=False)
    correct_answer = Column(String(255), nullable=False)
    marks = Column(Integer, default=1)

    @property
    def text(self) -> str:
        return self.question_text

    @property
    def data(self) -> dict:
        return {
            "options": self.options,
            "correct_answer": self.correct_answer,
        }

    @property
    def type(self) -> str:
        return "MCQ"


class ExamAssignment(Base):
    __tablename__ = "exam_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    institute_id = Column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), primary_key=True)
    exam_id = Column(UUID(as_uuid=True), nullable=False)
    batch_id = Column(UUID(as_uuid=True), nullable=False)
    assigned_at = Column(DateTime(timezone=True), server_default=func.current_timestamp())


class ExamSession(Base):
    __tablename__ = "exam_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    institute_id = Column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), primary_key=True)
    exam_id = Column(UUID(as_uuid=True), nullable=False)
    student_id = Column(UUID(as_uuid=True), nullable=False)
    session_code = Column(String(255), nullable=True)
    session_status = Column(String(50), default="not_started")
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    final_score = Column(Integer, nullable=True)
    violation_found = Column(Boolean, default=False)
    violation_count = Column(Integer, default=0)
    mongo_log_ref = Column(String(255), nullable=True)
    s3_media_prefix = Column(String(255), nullable=True)

    @property
    def status(self) -> str:
        return self.session_status

    @property
    def score(self) -> int | None:
        return self.final_score

    @property
    def integrity(self) -> int | None:
        return None


class ViolationLog(Base):
    __tablename__ = "violation_logs"

    __table_args__ = (
        ForeignKeyConstraint(
            ["institute_id", "session_id"],
            ["exam_sessions.institute_id", "exam_sessions.id"],
            ondelete="CASCADE",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    institute_id = Column(UUID(as_uuid=True), ForeignKey("institutes.id", ondelete="CASCADE"), primary_key=True)
    session_id = Column(UUID(as_uuid=True), nullable=False)
    violation_type = Column(String(100), nullable=False)  # e.g., face_not_detected, multiple_faces, looking_away, speech_detected
    timestamp = Column(DateTime(timezone=True), server_default=func.current_timestamp())
    screenshot_path = Column(String(500), nullable=True)  # relative path to saved screenshot
    video_clip_path = Column(String(500), nullable=True)  # relative path to video clip (optional)
    extra_data = Column(JSONB, nullable=True)  # additional data: pitch, yaw, audio levels, etc.