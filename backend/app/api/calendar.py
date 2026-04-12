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
                # List-based link query fallback
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

    # 1. Fetch custom events
    print(f"DEBUG: Fetching calendar events for {len(course_ids)} courses and creator_id: {user_id}")
    
    # Try multiple query styles to be absolutely certain
    # Added: Search by creator_id OR course_ids to ensure user's own events always show up
    # Standardize IDs to match potential string/ObjectId mismatches
    course_id_strs = [str(cid) for cid in course_ids]
    
    custom_events = await CalendarEvent.find(
        {"$or": [
            {"course.$id": {"$in": course_ids}},
            {"course": {"$in": course_ids}},
            {"course.id": {"$in": course_ids}},
            {"course.$id": {"$in": course_id_strs}},
            {"course_id": {"$in": course_id_strs}},
            {"creator_id": str(user_id)}
        ]}, 
        fetch_links=True
    ).to_list()
    
    if not custom_events:
        print("DEBUG: Primary query returned nothing. Checking total events in DB for diagnostic...")
        total = await CalendarEvent.count()
        print(f"DEBUG: Total CalendarEvent count in system: {total}")
    
    print(f"DEBUG: Found {len(custom_events)} custom events")
    for ce in custom_events:
        print(f"DEBUG: Event: {ce.title} for course: {ce.course.id if hasattr(ce.course, 'id') else ce.course}")
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
    print(f"DEBUG: Fetching assignments for {len(course_ids)} courses")
    assignments = await Assignment.find(
        {"$or": [
            {"course.$id": {"$in": course_ids}},
            {"course": {"$in": course_ids}},
            {"course_id": {"$in": [str(cid) for cid in course_ids]}}
        ]}, 
        fetch_links=True
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
    # A bit more permissive: allow teachers, admins, or general staff roles
    allowed_roles = [UserRole.TEACHER, UserRole.ADMIN, UserRole.USER]
    if not current_user or current_user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Not authorized to create events")
    
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
