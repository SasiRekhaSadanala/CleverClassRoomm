from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
from beanie import Link, PydanticObjectId
from app.models.calendar_event import CalendarEvent, EventType
from app.models.assignment import Assignment
from app.models.enrollment import Enrollment
from app.models.course import Course
from app.models.user import User, UserRole
from pydantic import BaseModel

router = APIRouter()

class EventCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    date: datetime
    event_type: EventType
    course_id: str

class CalendarResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    date: datetime
    type: str  # 'exam', 'submission', 'holiday', 'assignment_deadline', etc.
    course_name: str
    course_id: str

@router.get("/", response_model=List[CalendarResponse])
async def get_calendar(user_id: str):
    """
    Returns an aggregated list of events:
    1. Custom teacher-created events for all courses user is in.
    2. Assignment due dates for all courses user is in.
    """
    try:
        user_poid = PydanticObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user_id format")

    current_user = await User.get(user_poid)
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    # 1. Get all courses the user is part of (as student or teacher)
    if current_user.role == UserRole.TEACHER:
        # For teachers, show courses they created
        courses = await Course.find(Course.teacher.id == current_user.id).to_list()
        course_ids = [c.id for c in courses]
    else:
        # For students, show enrolled courses
        enrollments = await Enrollment.find(
            {"$or": [{"student_id": str(user_id)}, {"student_id": user_poid}]}
        ).to_list()
        course_ids = []
        for e in enrollments:
            try:
                course_ids.append(PydanticObjectId(e.course_id))
            except Exception:
                pass

    all_events = []
    if not course_ids:
        return []

    # 2. Fetch custom events
    custom_events = await CalendarEvent.find(
        {"course.$id": {"$in": course_ids}}, fetch_links=True
    ).to_list()
    
    for ce in custom_events:
        all_events.append(CalendarResponse(
            id=str(ce.id),
            title=ce.title,
            description=ce.description,
            date=ce.date,
            type=ce.event_type,
            course_name=ce.course.title if ce.course else "Unknown",
            course_id=str(ce.course.id) if ce.course else ""
        ))

    # 3. Fetch Assignment deadlines
    assignments = await Assignment.find(
        {"course.$id": {"$in": course_ids}}, fetch_links=True
    ).to_list()

    for ass in assignments:
        all_events.append(CalendarResponse(
            id=str(ass.id),
            title=f"DEADLINE: {ass.title}",
            description=ass.description,
            date=ass.due_date,
            type="assignment_deadline",
            course_name=ass.course.title if ass.course else "Unknown",
            course_id=str(ass.course.id) if ass.course else ""
        ))

    # Sort by date
    all_events.sort(key=lambda x: x.date)
    return all_events

@router.post("/")
async def create_event(req: EventCreateRequest, creator_id: str):
    try:
        creator_poid = PydanticObjectId(creator_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid creator_id format")

    current_user = await User.get(creator_poid)
    if not current_user or current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can create calendar events")
    
    course = await Course.get(PydanticObjectId(req.course_id))
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    new_event = CalendarEvent(
        title=req.title,
        description=req.description,
        date=req.date,
        event_type=req.event_type,
        course=course,
        creator_id=str(current_user.id)
    )
    await new_event.insert()
    return {"message": "Event created", "id": str(new_event.id)}

@router.delete("/{event_id}")
async def delete_event(event_id: str, teacher_id: str):
    try:
        teacher_poid = PydanticObjectId(teacher_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid teacher_id format")

    current_user = await User.get(teacher_poid)
    if not current_user or current_user.role != UserRole.TEACHER:
        raise HTTPException(status_code=403, detail="Only teachers can delete calendar events")
    
    event = await CalendarEvent.get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    await event.delete()
    return {"message": "Event deleted"}
