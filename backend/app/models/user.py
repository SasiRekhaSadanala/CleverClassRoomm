from enum import Enum
from typing import Optional
from beanie import Document
from pydantic import Field

class UserRole(str, Enum):
    USER = "user"
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"

class User(Document):
    email: str
    hashed_password: str
    name: str
    role: UserRole = UserRole.STUDENT
    
    # knowledge_profile maps string topic tags to float scores (0-100)
    knowledge_profile: dict[str, float] = Field(default_factory=dict)
    # topic_activity stores per-topic historical events for trend/attempt analysis
    topic_activity: dict[str, list[dict]] = Field(default_factory=dict)
    
    class Settings:
        name = "users"
