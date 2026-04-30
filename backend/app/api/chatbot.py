import json
import os
import uuid
from pathlib import Path
from typing import Optional, List

from beanie import PydanticObjectId
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field

from app.agents.student_chatbot_agent import generate_personalized_student_answer
from app.models.course import Course, Topic
from app.models.enrollment import Enrollment
from app.models.user import User
from app.utils.file_utils import extract_text_from_file

BACKEND_DIR = Path(__file__).resolve().parents[2]
UPLOAD_DIR = BACKEND_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter()


class ChatTurn(BaseModel):
    role: str
    content: str


class StudentChatRequest(BaseModel):
    student_id: str
    question: str
    course_id: Optional[str] = None
    history: List[ChatTurn] = Field(default_factory=list)


async def _resolve_course_for_student(student_id: str, course_id: Optional[str]) -> Optional[str]:
    if course_id:
        # First check enrollment (for students)
        enrollment = await Enrollment.find_one(
            Enrollment.student_id == student_id,
            Enrollment.course_id == str(course_id),
        )
        if enrollment:
            return str(course_id)

        # If not enrolled, check if the user is the teacher of this course
        course = await Course.get(PydanticObjectId(course_id))
        if course and str(course.teacher.ref.id) == student_id:
            return str(course_id)

        raise HTTPException(status_code=403, detail="Student is not enrolled in this course")

    enrollments = await Enrollment.find(Enrollment.student_id == student_id).to_list()
    if not enrollments:
        return None
    return str(enrollments[0].course_id)


async def _build_class_context(course_id: Optional[str]) -> tuple[str, list[dict]]:
    if not course_id:
        return (
            "No enrolled course context found for this student.",
            [],
        )

    course = await Course.get(PydanticObjectId(course_id))
    if not course:
        return ("Course context not found.", [])

    topics = await Topic.find(Topic.course_id == str(course_id)).to_list()

    topic_payload = []
    sources: list[dict] = []
    for t in topics[:10]:
        materials = []
        for m in (t.materials or [])[:5]:
            materials.append(
                {
                    "title": m.title,
                    "url": m.url,
                    "type": m.type,
                }
            )
            sources.append(
                {
                    "topic": t.title,
                    "title": m.title,
                    "url": m.url,
                    "type": m.type,
                }
            )

        topic_payload.append(
            {
                "title": t.title,
                "description": t.description,
                "materials": materials,
            }
        )

    context = {
        "course": {
            "id": str(course.id),
            "title": course.title,
            "description": course.description,
        },
        "topics": topic_payload,
    }
    return (json.dumps(context, ensure_ascii=True)[:4000], sources)


async def _build_student_snapshot(student_id: str) -> str:
    user = await User.get(PydanticObjectId(student_id))
    if not user:
        raise HTTPException(status_code=404, detail="Student not found")

    profile = user.knowledge_profile or {}
    sorted_topics = sorted(profile.items(), key=lambda x: x[1])
    weak = [t for t, s in sorted_topics if s < 60][:5]
    strong = [t for t, s in sorted(profile.items(), key=lambda x: x[1], reverse=True)[:3]]
    overall = round(sum(profile.values()) / len(profile), 1) if profile else None

    snapshot = {
        "name": user.name,
        "email": user.email,
        "overall_mastery": overall,
        "weak_topics": weak,
        "strong_topics": strong,
        "tracked_topics": len(profile),
    }
    return json.dumps(snapshot, ensure_ascii=True)


@router.post("/ask")
async def ask_student_chatbot(payload: StudentChatRequest):
    try:
        student_id = payload.student_id.strip()
        if not student_id:
            raise HTTPException(status_code=400, detail="student_id is required")

        question = payload.question.strip()
        if not question:
            raise HTTPException(status_code=400, detail="question is required")

        try:
            PydanticObjectId(student_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid student_id")

        course_id = await _resolve_course_for_student(student_id, payload.course_id)
        class_context, sources = await _build_class_context(course_id)
        student_snapshot = await _build_student_snapshot(student_id)

        history_text = "\n".join([
            f"{turn.role}: {turn.content}" for turn in payload.history[-6:]
        ])

        result = await generate_personalized_student_answer(
            question=question,
            student_snapshot=student_snapshot,
            class_context=class_context,
            history=history_text or "No prior turns",
        )

        return {
            "answer": result["answer"],
            "mode": result.get("mode", "fallback"),
            "course_id": course_id,
            "sources": sources[:10],
        }
    except HTTPException as e:
        raise e
    except Exception as err:
        import traceback
        with open("backend_chatbot_error.log", "w") as f:
            f.write(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(err))


@router.post("/ask-with-file")
async def ask_student_chatbot_with_file(
    student_id: str = Form(...),
    question: str = Form(...),
    course_id: Optional[str] = Form(None),
    history: str = Form("[]"),  # JSON stringified history
    file: Optional[UploadFile] = File(None)
):
    try:
        student_id = student_id.strip()
        question = question.strip()
        if not student_id or not question:
            raise HTTPException(status_code=400, detail="student_id and question are required")

        try:
            PydanticObjectId(student_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid student_id")

        # Parse history
        try:
            history_list = json.loads(history)
            history_text = "\n".join([
                f"{turn.get('role', 'user')}: {turn.get('content', '')}" 
                for turn in history_list[-6:]
            ])
        except Exception:
            history_text = "No prior turns"

        resolved_course_id = await _resolve_course_for_student(student_id, course_id)
        class_context, sources = await _build_class_context(resolved_course_id)
        student_snapshot = await _build_student_snapshot(student_id)

        document_text = ""
        if file:
            unique_filename = f"{uuid.uuid4()}_{file.filename}"
            upload_path = UPLOAD_DIR / unique_filename
            with open(upload_path, "wb") as buffer:
                buffer.write(await file.read())
            # Extract text
            document_text = extract_text_from_file(str(upload_path))
            
            # Limit the size just in case it's huge
            if len(document_text) > 15000:
                document_text = document_text[:15000] + "... [Text truncated due to length]"

        result = await generate_personalized_student_answer(
            question=question,
            student_snapshot=student_snapshot,
            class_context=class_context,
            history=history_text or "No prior turns",
            document_text=document_text
        )

        return {
            "answer": result["answer"],
            "mode": result.get("mode", "fallback"),
            "course_id": resolved_course_id,
            "sources": sources[:10],
            "extracted_text_length": len(document_text) if document_text else 0
        }
    except HTTPException as e:
        raise e
    except Exception as err:
        import traceback
        with open("backend_chatbot_error.log", "w") as f:
            f.write(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(err))

