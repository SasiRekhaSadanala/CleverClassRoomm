from fastapi import APIRouter
from . import auth, courses, assignments, quizzes, analytics, planner, chatbot, evaluator, calendar

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(assignments.router, prefix="/assignments", tags=["assignments"])
api_router.include_router(quizzes.router, prefix="/quizzes", tags=["quizzes"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(planner.router, prefix="/planner", tags=["planner"])
api_router.include_router(chatbot.router, prefix="/chatbot", tags=["chatbot"])
api_router.include_router(evaluator.router, prefix="/evaluator", tags=["evaluator"])
api_router.include_router(calendar.router, prefix="/calendar", tags=["calendar"])

