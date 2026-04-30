from datetime import datetime
from enum import Enum
from typing import Optional
from beanie import Document, Link
from .course import Course

class EventType(str, Enum):
    EXAM = "exam"
    SUBMISSION = "submission"
    HOLIDAY = "holiday"
    GENERAL = "general"

class CalendarEvent(Document):
    title: str
    description: Optional[str] = None
    date: datetime
    event_type: EventType = EventType.GENERAL
    course: Link[Course]
    course_id: str = ""  # Plain string copy for reliable querying
    creator_id: str  # User ID of the teacher who created it

    class Settings:
        name = "calendar_events"

