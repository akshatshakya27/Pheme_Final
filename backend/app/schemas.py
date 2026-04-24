from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class Token(BaseModel):
	access_token: str
	token_type: str
	user_id: str
	role: str


class InstituteCreate(BaseModel):
	institute_code: str
	name: str
	address: Optional[str] = None
	contact_email: Optional[str] = None


class InstituteOut(BaseModel):
	id: str
	institute_code: str
	name: str
	address: Optional[str] = None
	contact_email: Optional[str] = None
	created_at: Optional[datetime] = None

	class Config:
		from_attributes = True


class UserOut(BaseModel):
	id: str
	institute_id: Optional[str] = None
	batch_id: Optional[str] = None
	name: Optional[str] = None
	email: str
	role: str
	profile_image: Optional[str] = None
	code: Optional[str] = None

	class Config:
		from_attributes = True


class AdminOut(BaseModel):
	id: str
	institute_id: Optional[str] = None
	email: str
	role: str
	profile_image: Optional[str] = None

	class Config:
		from_attributes = True


class StudentOut(BaseModel):
	id: str
	institute_id: str
	batch_id: str
	email: str
	role: str
	profile_image: Optional[str] = None

	class Config:
		from_attributes = True


class UserCreate(BaseModel):
	institute_id: Optional[str] = None
	batch_id: Optional[str] = None
	name: str
	email: str
	password: str
	role: str
	emp_id: Optional[str] = None
	dept_code: Optional[str] = None
	section: Optional[str] = None
	roll_no: Optional[str] = None


class FacultyCreate(BaseModel):
	institute_id: str
	name: str
	dept_code: str
	emp_id: str
	email: str


class FacultyOut(BaseModel):
	id: str
	institute_id: str
	name: str
	dept_code: str
	emp_id: str
	faculty_code: Optional[str] = None
	email: str

	class Config:
		from_attributes = True


class DepartmentOut(BaseModel):
	id: str
	institute_id: str
	name: str
	code: str

	class Config:
		from_attributes = True


class ExamCreate(BaseModel):
	faculty_id: str
	subject_code: str
	exam_type: str
	exam_year: str
	title: str
	duration_minutes: int = Field(alias="duration")
	passing_marks: int
	scheduled_time: Optional[datetime] = None

	class Config:
		populate_by_name = True


class ExamOut(BaseModel):
	id: str
	institute_id: str
	faculty_id: str
	subject_code: str
	exam_type: str
	exam_year: str
	exam_code: Optional[str] = None
	title: str
	duration_minutes: int
	passing_marks: int
	scheduled_time: Optional[datetime] = None
	created_at: Optional[datetime] = None
	duration: int

	class Config:
		from_attributes = True


class QuestionCreate(BaseModel):
	exam_id: str
	type: Optional[str] = "MCQ"
	text: str
	marks: int = 1
	data: Dict[str, Any] = {}


class QuestionOut(BaseModel):
	id: UUID | str
	institute_id: Optional[str] = None
	exam_id: str
	type: str
	text: str
	marks: int
	data: Dict[str, Any]

	class Config:
		from_attributes = True


class BatchCreate(BaseModel):
	institute_id: Optional[str] = None
	course_code: str
	batch_year: str
	course_name: str
	members: List[str] = []


class BatchOut(BaseModel):
	id: str
	institute_id: str
	course_code: str
	batch_year: str
	batch_code: Optional[str] = None
	course_name: str
	name: str
	members: List[str]
	created_at: Optional[datetime] = None

	class Config:
		from_attributes = True


class ExamAssignmentCreate(BaseModel):
	exam_id: str
	batch_id: str


class ExamAssignmentOut(BaseModel):
	id: UUID | str
	institute_id: Optional[str] = None
	exam_id: str
	batch_id: str
	student_id: Optional[str] = None
	assigned_at: Optional[datetime] = None

	class Config:
		from_attributes = True


class ExamAssignmentWithExam(BaseModel):
	id: UUID | str
	exam_id: str
	batch_id: Optional[str] = None
	student_id: Optional[str] = None
	exam: ExamOut

	class Config:
		from_attributes = True


class ExamSessionCreate(BaseModel):
	student_id: str
	exam_id: str
	score: Optional[int] = None
	integrity: Optional[int] = None
	status: Optional[str] = "completed"


class ExamSessionComplete(BaseModel):
	score: Optional[int] = None
	integrity: Optional[int] = None
	status: Optional[str] = "submitted"


class ExamSessionOut(BaseModel):
	id: str
	institute_id: Optional[str] = None
	student_id: str
	exam_id: str
	status: str
	score: Optional[int] = None
	integrity: Optional[int] = None
	started_at: Optional[datetime] = None
	completed_at: Optional[datetime] = None
	violation_found: Optional[bool] = False
	mongo_log_ref: Optional[str] = None
	s3_media_prefix: Optional[str] = None

	class Config:
		from_attributes = True


class StudentInfo(BaseModel):
	id: str
	email: str
	profile_image: Optional[str] = None

	class Config:
		from_attributes = True


class ExamSessionWithDetails(BaseModel):
	id: str
	student_id: str
	student: StudentInfo
	exam_id: str
	status: str
	score: Optional[int] = None
	integrity: Optional[int] = None
	violation_logs_id: Optional[str] = None
	attempted_at: Optional[datetime] = None
	submitted_at: Optional[datetime] = None

	class Config:
		from_attributes = True


class DesktopLaunchTokenRequest(BaseModel):
	exam_id: str


class DesktopLaunchTokenOut(BaseModel):
	launch_token: str
	deep_link: str
	expires_in_seconds: int


class DesktopLaunchValidateRequest(BaseModel):
	launch_token: str


class DesktopLaunchValidateOut(BaseModel):
	exam_id: str
	exam_title: str
	student_id: str
	student_name: str
	exam_duration_minutes: int
	exam_api_token: str
	backend_base_url: str


class DesktopSessionStartRequest(BaseModel):
	exam_id: str


class DesktopSessionStartOut(BaseModel):
	session_id: str
	started_at: datetime


class DesktopAnswerItem(BaseModel):
	question_id: str
	selected_option: Optional[int] = None


class DesktopSubmitAnswersRequest(BaseModel):
	session_id: str
	answers: List[DesktopAnswerItem]


class DesktopSubmitAnswersOut(BaseModel):
	score: int


class DesktopProctoringLogItem(BaseModel):
	timestamp: datetime
	event_type: str
	severity: str
	score: int = Field(default=0, ge=0, le=100)
	metadata: Dict[str, Any] = Field(default_factory=dict)


class DesktopProctoringLogsUploadRequest(BaseModel):
	session_id: str
	logs: List[DesktopProctoringLogItem]


class DesktopSessionEndRequest(BaseModel):
	session_id: str
