from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
from beanie import Link, PydanticObjectId, operators
from beanie.operators import In
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
async def get_calendar(user_id: str, course_id: Optional[str] = None):
    """
    Returns an aggregated list of events:
    1. Custom teacher-created events for all courses user is in (or one specific course).
    2. Assignment due dates for all courses user is in (or one specific course).
    """
    try:
        user_poid = PydanticObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user_id format")

    current_user = await User.get(user_poid)
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Determine which courses to fetch events for
    course_ids = []
    if course_id:
        # Filter for a specific classroom (Local Calendar)
        try:
            course_ids = [PydanticObjectId(course_id)]
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid course_id format")
    else:
        # Fetch for all classrooms (Global Calendar) - Inclusive aggregation
        # 1. Courses they teach
        courses_taught = await Course.find({
            "$or": [
                {"teacher.id": current_user.id},
                {"teacher.$id": current_user.id},
                {"teacher.id": user_id},
                {"teacher_id": str(user_id)}
            ]
        }).to_list()
        course_ids.extend([c.id for c in courses_taught])
        
        # 2. Courses they are enrolled in (via specialized Enrollment model)
        enrollments = await Enrollment.find({
            "$or": [
                {"student_id": str(user_id)},
                {"student_id": user_poid}
            ]
        }).to_list()
        for e in enrollments:
            try:
                eid = PydanticObjectId(e.course_id) if isinstance(e.course_id, str) else e.course_id
                if eid not in course_ids:
                    course_ids.append(eid)
            except Exception:
                pass

        # 3. Courses they are enrolled in (via Course.enrolled_students list)
        courses_enrolled = await Course.find({
            "$or": [
                {"enrolled_students.id": current_user.id},
                {"enrolled_students.$id": current_user.id},
                {"enrolled_students.id": user_id},
                {"enrolled_students": {"$elemMatch": {"$id": current_user.id}}},
                {"enrolled_students": current_user.id}
            ]
        }).to_list()
        for c in courses_enrolled:
            if c.id not in course_ids:
                course_ids.append(c.id)
    
    if not course_ids:
        print(f"DEBUG: No courses found for {current_user.email} ({user_id})")

    all_events = []

    # Build the string list of course IDs for the simple course_id field query
    course_id_strs = [str(cid) for cid in course_ids]
    
    # Query using the plain string course_id field (most reliable)
    # Also fall back to Link-based queries and creator_id for backwards compatibility
    custom_events = await CalendarEvent.find(
        {"$or": [
            {"course_id": {"$in": course_id_strs}},
            {"course.$id": {"$in": course_ids}},
            {"creator_id": str(user_id)}
        ]}, 
        fetch_links=True
    ).to_list()
    
    # Deduplicate by event ID (in case multiple $or branches match the same event)
    seen_ids = set()
    for ce in custom_events:
        if str(ce.id) in seen_ids:
            continue
        seen_ids.add(str(ce.id))
        
        # Determine course name - from fetched link or look up by course_id
        course_name = "Unknown"
        event_course_id = ""
        try:
            if ce.course and hasattr(ce.course, 'title'):
                course_name = ce.course.title
                event_course_id = str(ce.course.id)
            elif ce.course_id:
                event_course_id = ce.course_id
                # Try to resolve the course name
                try:
                    c = await Course.get(PydanticObjectId(ce.course_id))
                    if c:
                        course_name = c.title
                except Exception:
                    pass
        except Exception:
            pass
            
        all_events.append(CalendarResponse(
            id=str(ce.id),
            title=ce.title,
            description=ce.description,
            date=ce.date,
            type=ce.event_type,
            course_name=course_name,
            course_id=event_course_id
        ))

    # Also filter out events not belonging to user's courses (from creator_id match)
    # Only keep events whose course_id is in the user's course list
    if course_id_strs:
        all_events = [e for e in all_events if e.course_id in course_id_strs]

    # Fetch Assignment deadlines
    assignments = await Assignment.find(
        {"$or": [
            {"course.$id": {"$in": course_ids}},
            {"course": {"$in": course_ids}},
            {"course_id": {"$in": course_id_strs}}
        ]}, 
        fetch_links=True
    ).to_list()

    for ass in assignments:
        ass_id = str(ass.id)
        if ass_id in seen_ids:
            continue
        seen_ids.add(ass_id)
        all_events.append(CalendarResponse(
            id=ass_id,
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
    if not current_user:
        raise HTTPException(status_code=403, detail="User not found")
    
    course = await Course.get(PydanticObjectId(req.course_id))
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Allow if user has teacher/admin role OR is the owner (teacher) of this course
    allowed_roles = [UserRole.TEACHER, UserRole.ADMIN]
    is_course_owner = False
    try:
        teacher_ref = course.teacher
        if hasattr(teacher_ref, 'id'):
            is_course_owner = teacher_ref.id == current_user.id
        elif hasattr(teacher_ref, 'ref') and hasattr(teacher_ref.ref, 'id'):
            is_course_owner = teacher_ref.ref.id == current_user.id
        elif isinstance(teacher_ref, PydanticObjectId):
            is_course_owner = teacher_ref == current_user.id
    except Exception:
        pass

    if current_user.role not in allowed_roles and not is_course_owner:
        raise HTTPException(status_code=403, detail="Only course teachers can create calendar events")

    new_event = CalendarEvent(
        title=req.title,
        description=req.description,
        date=req.date,
        event_type=req.event_type,
        course=course,
        course_id=str(course.id),  # Store plain string for reliable querying
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
    if not current_user:
        raise HTTPException(status_code=403, detail="User not found")
    
    event = await CalendarEvent.get(PydanticObjectId(event_id))
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Allow deletion by teacher role, admin, or the event creator
    allowed_roles = [UserRole.TEACHER, UserRole.ADMIN]
    is_creator = event.creator_id == str(current_user.id)
    if current_user.role not in allowed_roles and not is_creator:
        raise HTTPException(status_code=403, detail="Not authorized to delete this event")
        
    await event.delete()
    return {"message": "Event deleted"}
