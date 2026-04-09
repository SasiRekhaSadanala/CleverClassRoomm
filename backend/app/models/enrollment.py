from datetime import datetime

from beanie import Document
from pydantic import Field


class Enrollment(Document):
    course_id: str
    student_id: str
    joined_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "enrollments"
