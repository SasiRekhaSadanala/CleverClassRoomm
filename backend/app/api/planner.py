from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.agents.planner_agent import create_short_term_plan, create_long_term_plan
from app.models.user import User
from app.models.assignment import Submission
from app.models.quiz import Quiz, QuizResult
from beanie import PydanticObjectId
import hashlib
import json
import time

router = APIRouter()
PLAN_CACHE_TTL_SECONDS = 15 * 60
_PLAN_CACHE: dict[str, dict] = {}

class PlanRequest(BaseModel):
    subject: str
    goal: str
    style: Optional[str] = "Balanced"
    plan_type: str  # "short_term" or "long_term"
    student_id: str


async def _build_progress_context(student_id: str) -> tuple[str, list[str], dict]:
    try:
        user = await User.get(PydanticObjectId(student_id))
    except Exception:
        user = None

    if not user:
        raise HTTPException(status_code=404, detail="Student not found")

    profile: dict[str, float] = user.knowledge_profile or {}

    # If profile is empty, derive a lightweight topic map from quiz performance.
    if not profile:
        quiz_results = await QuizResult.find(QuizResult.student_id == student_id).to_list()
        quizzes_by_id: dict[str, Quiz] = {}
        derived_topic_scores: dict[str, list[float]] = {}

        for result in quiz_results:
            if result.quiz_id not in quizzes_by_id:
                try:
                    quiz = await Quiz.get(PydanticObjectId(result.quiz_id))
                    if quiz:
                        quizzes_by_id[result.quiz_id] = quiz
                except Exception:
                    continue

            quiz = quizzes_by_id.get(result.quiz_id)
            if not quiz:
                continue

            for idx, question in enumerate(quiz.questions):
                answer = result.answers[idx] if idx < len(result.answers) else -1
                correct = answer == question.correct_option_index
                topics = question.topic_ids if question.topic_ids else [quiz.title]
                for raw_topic in topics:
                    topic = (raw_topic or "general").strip().lower()
                    if not topic:
                        topic = "general"
                    bucket = derived_topic_scores.get(topic, [])
                    bucket.append(100.0 if correct else 0.0)
                    derived_topic_scores[topic] = bucket

        profile = {
            topic: round(sum(scores) / len(scores), 1)
            for topic, scores in derived_topic_scores.items()
            if scores
        }

    sorted_topics = sorted(profile.items(), key=lambda x: x[1])
    weak_topics = [topic for topic, score in sorted_topics if score < 60][:5]
    strong_topics = [topic for topic, score in sorted(profile.items(), key=lambda x: x[1], reverse=True)[:3]]

    overall_mastery = round(sum(profile.values()) / len(profile), 1) if profile else 50.0
    readiness_band = "beginner" if overall_mastery < 50 else "intermediate" if overall_mastery < 75 else "advanced"

    quiz_results = await QuizResult.find(QuizResult.student_id == student_id).to_list()
    quiz_percentages = [round((r.score / r.total) * 100, 1) for r in quiz_results if r.total > 0]
    avg_quiz_score = round(sum(quiz_percentages) / len(quiz_percentages), 1) if quiz_percentages else None

    recent_quiz_trend = "stable"
    if len(quiz_percentages) >= 2:
        delta = quiz_percentages[-1] - quiz_percentages[0]
        if delta > 5:
            recent_quiz_trend = "improving"
        elif delta < -5:
            recent_quiz_trend = "declining"

    submissions = await Submission.find(Submission.student.id == PydanticObjectId(student_id)).to_list()
    evaluated_scores = [float(s.score) for s in submissions if s.score is not None]
    assignment_avg = round(sum(evaluated_scores) / len(evaluated_scores), 1) if evaluated_scores else None

    snapshot = {
        "student_id": student_id,
        "student_name": user.name,
        "overall_mastery": overall_mastery,
        "readiness_band": readiness_band,
        "weak_topics": weak_topics,
        "strong_topics": strong_topics,
        "quiz_attempts": len(quiz_results),
        "avg_quiz_score": avg_quiz_score,
        "recent_quiz_trend": recent_quiz_trend,
        "assignment_submissions": len(submissions),
        "avg_assignment_score": assignment_avg,
        "topic_scores": [{"topic": t, "score": s} for t, s in sorted_topics[:8]],
    }

    context = json.dumps(snapshot, ensure_ascii=True)
    return (context[:1200], weak_topics, snapshot)


def _cache_key(payload: dict) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _get_cached_plan(key: str) -> Optional[dict]:
    entry = _PLAN_CACHE.get(key)
    if not entry:
        return None
    if time.time() - entry["created_at"] > PLAN_CACHE_TTL_SECONDS:
        _PLAN_CACHE.pop(key, None)
        return None
    return entry


def _set_cached_plan(key: str, response: dict) -> None:
    _PLAN_CACHE[key] = {
        "created_at": time.time(),
        "response": response,
    }

@router.post("/generate")
async def generate_plan(request: PlanRequest):
    progress_context, weak_topics, snapshot = await _build_progress_context(request.student_id)

    key = _cache_key(
        {
            "subject": request.subject.strip().lower(),
            "goal": request.goal.strip().lower(),
            "style": (request.style or "Balanced").strip().lower(),
            "plan_type": request.plan_type,
            "student_id": request.student_id or "",
            "progress_context": progress_context,
        }
    )
    cached = _get_cached_plan(key)
    if cached:
        response = dict(cached["response"])
        response["cached"] = True
        return response

    if request.plan_type == "short_term":
        plan = await create_short_term_plan(
            request.subject,
            request.goal,
            request.style,
            progress_context,
        )
    elif request.plan_type == "long_term":
        plan = await create_long_term_plan(
            request.subject,
            request.goal,
            request.style,
            progress_context,
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid plan_type. Use 'short_term' or 'long_term'.")
    
    response = {
        "plan": plan,
        "plan_type": request.plan_type,
        "personalization": {
            "student_id": request.student_id,
            "weak_topics": weak_topics,
            "readiness_band": snapshot.get("readiness_band"),
            "overall_mastery": snapshot.get("overall_mastery"),
        },
        "cached": False,
    }
    _set_cached_plan(key, response)
    return response
