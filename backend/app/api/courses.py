from fastapi import APIRouter, HTTPException, UploadFile, File, Form
import shutil
import uuid
import os
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
from app.models.course import Course, Topic, Material
from app.models.enrollment import Enrollment
from app.models.user import User, UserRole
from beanie import PydanticObjectId

router = APIRouter()
BACKEND_DIR = Path(__file__).resolve().parents[2]
UPLOAD_DIR = BACKEND_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_API_BASE_URL = os.getenv("PUBLIC_API_BASE_URL", "http://127.0.0.1:8000")

class CourseCreate(BaseModel):
    title: str
    description: str
    teacher_id: PydanticObjectId

class TopicCreate(BaseModel):
    title: str
    description: Optional[str] = None
    parent_topic_id: Optional[PydanticObjectId] = None


class JoinCourseRequest(BaseModel):
    student_id: PydanticObjectId


class JoinByCodeRequest(BaseModel):
    user_id: PydanticObjectId
    join_code: str


async def _get_user(user_id: PydanticObjectId) -> User:
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def _serialize_course(course: Course) -> dict:
    teacher_id = ""
    # Extract ID from teacher Link
    t = getattr(course, "teacher", None)
    if t:
        if isinstance(t, PydanticObjectId):
            teacher_id = str(t)
        elif hasattr(t, "id"):
            teacher_id = str(t.id)
        elif hasattr(t, "ref") and hasattr(t.ref, "id"):
            teacher_id = str(t.ref.id)
    
    return {
        "_id": str(course.id),
        "title": course.title,
        "description": course.description,
        "teacher_id": teacher_id,
        "join_code": course.join_code,
    }


@router.post("")
async def create_course(course_data: CourseCreate):
    creator = await _get_user(course_data.teacher_id)
    
    course = Course(
        title=course_data.title,
        description=course_data.description,
        teacher=creator
    )
    await course.insert()
    return {"_id": str(course.id), "title": course.title, "description": course.description, "join_code": course.join_code}

@router.get("")
async def list_courses():
    courses = await Course.find_all().to_list()
    return [_serialize_course(c) for c in courses]


# NOTE: This MUST be registered before /{course_id} to avoid route shadowing
@router.get("/student/{student_id}")
async def get_student_courses(student_id: PydanticObjectId):
    # Support both string and ObjectId-shaped historic records.
    enrollments = await Enrollment.find(
        {
            "$or": [
                {"student_id": str(student_id)},
                {"student_id": student_id},
            ]
        }
    ).to_list()
    if not enrollments:
        return []

    course_ids = []
    for record in enrollments:
        try:
            course_ids.append(PydanticObjectId(record.course_id))
        except Exception:
            if isinstance(record.course_id, PydanticObjectId):
                course_ids.append(record.course_id)

    if not course_ids:
        return []

    courses = await Course.find({"_id": {"$in": course_ids}}).to_list()
    return [_serialize_course(c) for c in courses]


@router.get("/{course_id}")
async def get_course(course_id: PydanticObjectId):
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return _serialize_course(course)


@router.post("/{course_id}/topics")
async def add_topic(course_id: PydanticObjectId, topic_data: TopicCreate):
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    topic = Topic(
        title=topic_data.title,
        description=topic_data.description,
        parent_topic_id=str(topic_data.parent_topic_id) if topic_data.parent_topic_id else None,
        course_id=str(course_id)
    )
    await topic.insert()
    return topic

@router.post("/{course_id}/topics/{topic_id}/materials")
async def add_material(course_id: PydanticObjectId, topic_id: PydanticObjectId, material: Material):
    topic = await Topic.get(topic_id)
    if not topic or topic.course_id != str(course_id):
        raise HTTPException(status_code=404, detail="Topic not found or course mismatch")
    
    if not hasattr(topic, 'materials') or topic.materials is None:
        topic.materials = []
        
    topic.materials.append(material)
    await topic.save()
    return topic


@router.post("/{course_id}/topics/{topic_id}/upload-material")
async def upload_material(
    course_id: str,
    topic_id: PydanticObjectId,
    topic_title: str = Form(...),
    file: UploadFile = File(...)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    topic = await Topic.get(topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Save file
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    upload_path = UPLOAD_DIR / unique_filename
    
    with open(upload_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_url = f"{PUBLIC_API_BASE_URL}/uploads/{unique_filename}"
    
    if not hasattr(topic, 'materials') or topic.materials is None:
        topic.materials = []
        
    material = Material(title=topic_title or file.filename, url=file_url, type="pdf")
    topic.materials.append(material)
    await topic.save()
    
    return topic

@router.post("/{course_id}/materials/upload-by-topic")
async def upload_material_by_topic(
    course_id: str,
    topic_name: str = Form(...),
    file: UploadFile = File(...)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # Find or create the topic
    topic = await Topic.find_one(Topic.course_id == course_id, Topic.title == topic_name)
    if not topic:
        topic = Topic(
            title=topic_name,
            description="Automatically created during upload",
            course_id=course_id,
            materials=[]
        )
        await topic.insert()

    if not hasattr(topic, 'materials') or topic.materials is None:
        topic.materials = []

    # Save file
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    upload_path = UPLOAD_DIR / unique_filename
    
    with open(upload_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_url = f"{PUBLIC_API_BASE_URL}/uploads/{unique_filename}"
    
    material = Material(title=file.filename, url=file_url, type="pdf")
    topic.materials.append(material)
    await topic.save()
    
    return topic

@router.get("/{course_id}/topics")
async def get_course_topics(course_id: PydanticObjectId):
    topics = await Topic.find(Topic.course_id == str(course_id)).to_list()
    return topics


@router.post("/join/{course_id}")
async def join_course(course_id: PydanticObjectId, payload: JoinCourseRequest):
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    user = await _get_user(payload.student_id)
    existing = await Enrollment.find_one(
        Enrollment.course_id == str(course_id),
        Enrollment.student_id == str(user.id),
    )
    if existing:
        return {
            "message": "Already enrolled",
            "course_id": str(course_id),
            "student_id": str(user.id),
        }

    enrollment = Enrollment(course_id=str(course_id), student_id=str(user.id))
    await enrollment.insert()
    return {
        "message": "Joined course successfully",
        "course_id": str(course_id),
        "student_id": str(user.id),
    }


@router.post("/join-by-code")
async def join_course_by_code(payload: JoinByCodeRequest):
    course = await Course.find_one(Course.join_code == payload.join_code)
    if not course:
        raise HTTPException(status_code=404, detail="Invalid join code. No classroom found.")

    user = await _get_user(payload.user_id)
    existing = await Enrollment.find_one(
        Enrollment.course_id == str(course.id),
        Enrollment.student_id == str(user.id),
    )
    if existing:
        return {
            "message": "Already enrolled",
            "course_id": str(course.id),
            "course_title": course.title,
        }

    enrollment = Enrollment(course_id=str(course.id), student_id=str(user.id))
    await enrollment.insert()
    return {
        "message": "Joined classroom successfully",
        "course_id": str(course.id),
        "course_title": course.title,
    }


@router.get("/created-by/{user_id}")
async def get_created_courses(user_id: PydanticObjectId):
    user = await _get_user(user_id)
    courses = await Course.find(Course.teacher.id == user.id).to_list()
    return [_serialize_course(c) for c in courses]



# (Moved above /{course_id} to fix route matching order — kept here as reference)


@router.delete("/{course_id}")
async def delete_course(course_id: PydanticObjectId):
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Delete all topics belonging to this course
    await Topic.find(Topic.course_id == str(course_id)).delete()
    # Delete all enrollments for this course
    await Enrollment.find(Enrollment.course_id == str(course_id)).delete()
    await course.delete()
    return {"message": "Course deleted successfully"}


@router.delete("/{course_id}/topics/{topic_id}")
async def delete_topic(course_id: PydanticObjectId, topic_id: PydanticObjectId):
    topic = await Topic.get(topic_id)
    if not topic or topic.course_id != str(course_id):
        raise HTTPException(status_code=404, detail="Topic not found")
    await topic.delete()
    return {"message": "Topic deleted successfully"}


@router.put("/{course_id}/topics/{topic_id}")
async def update_topic(course_id: PydanticObjectId, topic_id: PydanticObjectId, topic_data: TopicCreate):
    topic = await Topic.get(topic_id)
    if not topic or topic.course_id != str(course_id):
        raise HTTPException(status_code=404, detail="Topic not found")
    
    topic.title = topic_data.title
    topic.description = topic_data.description
    await topic.save()
    return topic


@router.delete("/{course_id}/topics/{topic_id}/materials/{material_index}")
async def delete_material(course_id: PydanticObjectId, topic_id: PydanticObjectId, material_index: int):
    topic = await Topic.get(topic_id)
    if not topic or topic.course_id != str(course_id):
        raise HTTPException(status_code=404, detail="Topic not found")
    
    if not topic.materials or material_index >= len(topic.materials):
        raise HTTPException(status_code=404, detail="Material not found")
    
    deleted = topic.materials.pop(material_index)
    await topic.save()
    return {"message": f"Material '{deleted.title}' deleted", "topic": topic}

