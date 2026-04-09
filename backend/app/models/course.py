from typing import List, Optional
import random
import string
from pydantic import BaseModel, Field
from beanie import Document, Link
from .user import User


def _generate_join_code(length: int = 6) -> str:
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))


class Material(BaseModel):
    title: str
    url: str
    type: str = "link" # "link", "pdf", etc.

class Topic(Document):
    title: str
    description: Optional[str] = None
    parent_topic_id: Optional[str] = None # For hierarchy
    course_id: str
    materials: List[Material] = []
    
    class Settings:
        name = "topics"

class Course(Document):
    title: str
    description: str
    teacher: Link[User]
    join_code: str = Field(default_factory=_generate_join_code)
    topics: List[Link[Topic]] = []
    enrolled_students: List[Link[User]] = []
    
    class Settings:
        name = "courses"

