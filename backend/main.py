import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()  # Load .env file
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from beanie import init_beanie
from contextlib import asynccontextmanager
from pymongo import AsyncMongoClient

from app.api import api_router
from app.models.user import User
from app.models.course import Course, Topic
from app.models.assignment import Assignment, Submission
from app.models.quiz import Quiz, QuizResult
from app.models.calendar_event import CalendarEvent
from app.models.enrollment import Enrollment

# MongoDB connection URL
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
PUBLIC_API_BASE_URL = os.getenv("PUBLIC_API_BASE_URL", "http://127.0.0.1:8001")
DATABASE_NAME = "asc_db"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    client = AsyncMongoClient(MONGO_URL)
    await init_beanie(database=client[DATABASE_NAME], document_models=[
        User, Course, Topic, Assignment, Submission, Quiz, QuizResult, Enrollment, CalendarEvent
    ])
    yield
    # Shutdown
    client.close()

app = FastAPI(title="CleverClassRoom API", lifespan=lifespan)

# CORS middleware
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://localhost:5173", # Common Vite port
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler to ensure CORS headers are present on errors
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    from fastapi.responses import JSONResponse
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
    )
    # Manually add CORS headers if the middleware didn't catch it
    origin = request.headers.get("origin")
    if origin in origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

app.include_router(api_router, prefix="/api/v1")

# Serve uploaded files from both current and legacy locations.
BACKEND_DIR = Path(__file__).resolve().parent
UPLOAD_DIR_PRIMARY = BACKEND_DIR / "uploads"
UPLOAD_DIR_LEGACY = BACKEND_DIR.parent / "uploads"
UPLOAD_DIR_PRIMARY.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR_LEGACY.mkdir(parents=True, exist_ok=True)


@app.get("/uploads/{file_path:path}")
async def serve_upload(file_path: str):
    candidates = [UPLOAD_DIR_PRIMARY / file_path, UPLOAD_DIR_LEGACY / file_path]
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return FileResponse(candidate)
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="File not found")


@app.get("/")
async def root():
    return {"message": "Welcome to CleverClassRoom API"}

# Triggering reload

