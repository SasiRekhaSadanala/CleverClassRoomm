from typing import List, Optional
from datetime import datetime
from beanie import Document, Link
from pydantic import BaseModel, Field
from .course import Course
from .user import User


class Question(BaseModel):
    text: str
    options: List[str]
    correct_option_index: int
    topic_ids: List[str] = []


class Quiz(Document):
    title: str
    course: Link[Course]
    questions: List[Question]
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "quizzes"


class QuizResult(Document):
    quiz_id: str
    student_id: str
    score: int
    total: int
    answers: List[int]  # student's selected option indices
    submitted_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "quiz_results"
