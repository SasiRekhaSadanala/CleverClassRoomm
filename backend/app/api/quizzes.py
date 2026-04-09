from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.models.quiz import Quiz, Question, QuizResult
from beanie import PydanticObjectId
from app.agents.quiz_agent import generate_quiz_questions
from app.agents.analytics import update_knowledge_profile

router = APIRouter()


class QuestionCreate(BaseModel):
    text: str
    options: List[str]
    correct_option_index: int
    topic_ids: List[str] = []


class QuizCreate(BaseModel):
    title: str
    course_id: PydanticObjectId
    questions: List[QuestionCreate]


class QuizSubmit(BaseModel):
    student_id: str
    answers: List[int]  # Indices of selected options


class AIQuizGenerate(BaseModel):
    course_id: PydanticObjectId
    topic: str
    title: Optional[str] = None


# ─── Create quiz manually ───────────────────────────────────────────────────
@router.post("/")
async def create_quiz(quiz_data: QuizCreate):
    questions = [
        Question(
            text=q.text,
            options=q.options,
            correct_option_index=q.correct_option_index,
            topic_ids=q.topic_ids,
        )
        for q in quiz_data.questions
    ]
    quiz = Quiz(
        title=quiz_data.title,
        course=quiz_data.course_id,
        questions=questions,
    )
    await quiz.insert()
    return quiz


# ─── AI-Generate a quiz ──────────────────────────────────────────────────────
@router.post("/ai-generate")
async def ai_generate_quiz(payload: AIQuizGenerate):
    """
    Calls the Quiz Agent (Gemini or mock) to generate 5 MCQ questions
    for the provided topic and saves the resulting Quiz to MongoDB.
    """
    raw_questions = await generate_quiz_questions(payload.topic)

    questions = [
        Question(
            text=q["text"],
            options=q["options"],
            correct_option_index=q["correct_option_index"],
            topic_ids=[payload.topic.strip().lower()],
        )
        for q in raw_questions
    ]

    title = payload.title or f"AI Quiz: {payload.topic}"
    quiz = Quiz(title=title, course=payload.course_id, questions=questions)
    await quiz.insert()

    return {
        "message": "AI quiz generated successfully",
        "quiz_id": str(quiz.id),
        "title": quiz.title,
        "question_count": len(questions),
    }


# ─── List quizzes for a course ───────────────────────────────────────────────
@router.get("/course/{course_id}")
async def list_quizzes_for_course(course_id: PydanticObjectId):
    quizzes = await Quiz.find(Quiz.course.id == course_id).to_list()
    return quizzes


# ─── Get a single quiz (for quiz-taking) ────────────────────────────────────
@router.get("/{quiz_id}")
async def get_quiz(quiz_id: PydanticObjectId):
    quiz = await Quiz.get(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


# ─── Submit a quiz (persists score) ─────────────────────────────────────────
@router.post("/{quiz_id}/submit")
async def submit_quiz(quiz_id: PydanticObjectId, submission: QuizSubmit):
    quiz = await Quiz.get(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # SINGLE SUBMISSION CHECK
    existing = await QuizResult.find_one(
        QuizResult.quiz_id == str(quiz_id),
        QuizResult.student_id == str(submission.student_id)
    )
    if existing:
        raise HTTPException(status_code=400, detail="You have already submitted this quiz.")

    # Calculate score
    score = 0
    total = len(quiz.questions)
    for i, q in enumerate(quiz.questions):
        if i < len(submission.answers) and submission.answers[i] == q.correct_option_index:
            score += 1

    # Persist quiz result to DB
    result = QuizResult(
        quiz_id=str(quiz_id),
        student_id=submission.student_id,
        score=score,
        total=total,
        answers=submission.answers,
    )
    await result.insert()

    # Feed topic-level analytics from question performance.
    topic_stats: dict[str, dict[str, int]] = {}
    for i, q in enumerate(quiz.questions):
        selected = submission.answers[i] if i < len(submission.answers) else -1
        is_correct = selected == q.correct_option_index
        raw_topics = q.topic_ids if getattr(q, "topic_ids", None) else [quiz.title]

        for raw_topic in raw_topics:
            topic = (raw_topic or "general").strip().lower()
            if not topic:
                topic = "general"
            stat = topic_stats.get(topic, {"correct": 0, "total": 0})
            stat["total"] += 1
            if is_correct:
                stat["correct"] += 1
            topic_stats[topic] = stat

    for topic, stat in topic_stats.items():
        if stat["total"] <= 0:
            continue
        topic_score = (stat["correct"] / stat["total"]) * 100
        await update_knowledge_profile(
            submission.student_id,
            [topic],
            topic_score,
            source="quiz",
        )

    # Build answer review (correct answers for each question)
    review = [
        {
            "question": q.text,
            "your_answer": submission.answers[i] if i < len(submission.answers) else -1,
            "correct_answer": q.correct_option_index,
            "options": q.options,
            "correct": (
                i < len(submission.answers)
                and submission.answers[i] == q.correct_option_index
            ),
        }
        for i, q in enumerate(quiz.questions)
    ]

    return {
        "message": "Quiz submitted",
        "result_id": str(result.id),
        "score": score,
        "total": total,
        "percentage": round(score / total * 100, 1) if total > 0 else 0,
        "review": review,
    }


# ─── Get quiz results for a student ─────────────────────────────────────────
@router.get("/student/{student_id}/results")
async def get_student_results(student_id: str):
    results = await QuizResult.find(QuizResult.student_id == student_id).to_list()
    return results
