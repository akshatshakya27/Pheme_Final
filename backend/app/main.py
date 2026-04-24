from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # <--- IMPORT THIS
from .routers import exams, auth, questions, batches, assignments, institutes, users, sessions, departments, faculties, proctoring, desktop_exam

# Partitioned schema is provisioned through SQL migrations.

app = FastAPI(title="AI Proctor Admin")

# --- ADD THIS BLOCK TO FIX THE ERROR ---
origins = [
    "http://localhost:5173", # The address of your React Frontend
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allow all methods (POST, GET, etc.)
    allow_headers=["*"],
)
# ---------------------------------------

# Include the Exam router
app.include_router(exams.router, prefix="/api", tags=["Exams"])
app.include_router(auth.router, prefix="/api", tags=["Auth"])
app.include_router(questions.router, prefix="/api", tags=["Questions"])
app.include_router(batches.router, prefix="/api", tags=["Batches"])
app.include_router(assignments.router, prefix="/api", tags=["Assignments"])
app.include_router(institutes.router, prefix="/api", tags=["Institutes"])
app.include_router(departments.router, prefix="/api", tags=["Departments"])
app.include_router(faculties.router, prefix="/api", tags=["Faculties"])
app.include_router(users.router, prefix="/api", tags=["Users"])
app.include_router(sessions.router, prefix="/api", tags=["Sessions"])
app.include_router(proctoring.router, prefix="/api", tags=["Proctoring"])
app.include_router(desktop_exam.router, prefix="/api", tags=["Desktop Exam"])


@app.on_event("startup")
def _startup_proctoring() -> None:
    proctoring.warmup_proctoring_engines()


@app.on_event("shutdown")
def _shutdown_proctoring() -> None:
    proctoring.shutdown_proctoring_engines()

@app.get("/")
def health_check():
    return {"status": "System is running"}