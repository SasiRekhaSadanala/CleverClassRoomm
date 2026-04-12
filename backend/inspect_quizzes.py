import asyncio
import os
from beanie import init_beanie
from pymongo import AsyncMongoClient
from app.models.quiz import Quiz
from app.models.course import Course
from app.models.user import User
from app.models.assignment import Assignment, Submission
from app.models.quiz import QuizResult
from app.models.enrollment import Enrollment

async def inspect_quizzes():
    client = AsyncMongoClient(os.getenv('MONGO_URL', 'mongodb://localhost:27017'))
    await init_beanie(database=client['asc_db'], document_models=[
        User, Course, Assignment, Submission, Quiz, QuizResult, Enrollment
    ])
    
    quizzes = await Quiz.find_all().to_list()
    print(f"Total quizzes in DB: {len(quizzes)}")
    for q in quizzes:
        course_id = "N/A"
        if q.course:
             # Beanie Link handling
             course_id = str(q.course.ref.id) if hasattr(q.course, 'ref') else str(q.course)
        print(f"ID: {q.id} | Title: {q.title} | CourseID: {course_id} | Creator: {q.creator_id}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(inspect_quizzes())
