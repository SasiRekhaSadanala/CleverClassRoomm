from datetime import datetime
from enum import Enum
from typing import List, Optional
from beanie import Document, Link
from pydantic import Field
from .user import User
from .course import Course, Topic

class AssignmentType(str, Enum):
    THEORY = "theory"
    CODING = "coding"
    PROJECT = "project"

class Assignment(Document):
    title: str
    description: str
    type: AssignmentType
    course: Link[Course]
    topics: List[Link[Topic]] = []
    due_date: datetime
    test_cases: Optional[List[dict]] = None # For coding assignments
    
    class Settings:
        name = "assignments"

class SubmissionStatus(str, Enum):
    PENDING = "pending"
    EVALUATED = "evaluated"
    FAILED = "failed"

class Submission(Document):
    assignment: Link[Assignment]
    student: Link[User]
    code: Optional[str] = None
    theory_answer: Optional[str] = None
    submission_file_url: Optional[str] = None
    file_name: Optional[str] = None
    status: SubmissionStatus = SubmissionStatus.PENDING
    score: Optional[float] = None
    feedback: Optional[str] = None
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "submissions"
