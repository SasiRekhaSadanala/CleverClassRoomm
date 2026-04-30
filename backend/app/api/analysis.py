from fastapi import APIRouter, HTTPException
from typing import Optional, List, Dict, Any
from beanie import PydanticObjectId
from beanie.operators import In

from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.user import User
from app.models.assignment import Assignment, Submission
from app.agents.classroom_analysis_agent import generate_classroom_analysis

router = APIRouter()

@router.get("/{course_id}/analysis")
async def get_course_analysis(course_id: str, user_id: str, role: str):
    try:
        course = await Course.get(PydanticObjectId(course_id))
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        if role == "teacher":
            # --- TEACHER VIEW (Class-wide) ---
            enrollments = await Enrollment.find(Enrollment.course_id == course_id).to_list()
            student_ids = [e.student_id for e in enrollments]
            students = await User.find(In(User.id, [PydanticObjectId(sid) for sid in student_ids])).to_list()

            topic_mastery = {}
            for student in students:
                profile = student.knowledge_profile or {}
                for topic, score in profile.items():
                    if topic not in topic_mastery: topic_mastery[topic] = []
                    topic_mastery[topic].append(score)
            
            avg_topic_mastery = {k: round(sum(v)/len(v), 2) for k, v in topic_mastery.items() if v}

            assignments = await Assignment.find(Assignment.course.id == PydanticObjectId(course_id)).to_list()
            assignment_ids = [a.id for a in assignments]
            
            # Query submissions for these assignments
            submissions = await Submission.find(In(Submission.assignment.id, assignment_ids)).to_list()
            
            scores = [s.score for s in submissions if s.score is not None]
            avg_score = round(sum(scores)/len(scores), 2) if scores else 0
            max_score = max(scores) if scores else 0
            min_score = min(scores) if scores else 0
            
            score_distribution = {
                "0-20": len([s for s in scores if s < 20]),
                "20-40": len([s for s in scores if 20 <= s < 40]),
                "40-60": len([s for s in scores if 40 <= s < 60]),
                "60-80": len([s for s in scores if 60 <= s < 80]),
                "80-100": len([s for s in scores if s >= 80]),
            }

            class_data = {
                "role": "teacher",
                "course_name": course.title,
                "total_students": len(students),
                "total_assignments": len(assignments),
                "average_score": avg_score,
                "highest_score": max_score,
                "lowest_score": min_score,
                "topic_mastery": avg_topic_mastery,
                "score_distribution": score_distribution,
                "engagement_rate": round(len(submissions) / (len(students) * len(assignments)) * 100, 2) if students and assignments else 0
            }

            report = await generate_classroom_analysis(class_data)

            return {
                "role": "teacher",
                "metrics": {
                    "avg_score": avg_score,
                    "max_score": max_score,
                    "min_score": min_score,
                    "student_count": len(students),
                    "completion_rate": class_data["engagement_rate"],
                    "score_dist": score_distribution
                },
                "top_topics": sorted(avg_topic_mastery.items(), key=lambda x: x[1], reverse=True)[:5],
                "bottom_topics": sorted(avg_topic_mastery.items(), key=lambda x: x[1])[:5],
                "ai_report": report
            }
        else:
            # --- STUDENT VIEW (Personal) ---
            user = await User.get(PydanticObjectId(user_id))
            if not user: raise HTTPException(status_code=404, detail="Student not found")

            assignments = await Assignment.find(Assignment.course.id == PydanticObjectId(course_id)).to_list()
            assignment_ids = [a.id for a in assignments]
            
            submissions = await Submission.find(
                Submission.student.id == PydanticObjectId(user_id),
                In(Submission.assignment.id, assignment_ids)
            ).to_list()

            personal_scores = [s.score for s in submissions if s.score is not None]
            avg_p_score = round(sum(personal_scores)/len(personal_scores), 2) if personal_scores else 0
            
            gpa = round(avg_p_score / 25, 2) if avg_p_score else 0

            score_trend = [{"name": f"Task {i+1}", "score": s.score} for i, s in enumerate(submissions[-5:])]

            personal_data = {
                "role": "student",
                "student_name": user.name,
                "course_name": course.title,
                "average_score": avg_p_score,
                "gpa_estimate": gpa,
                "topic_mastery": user.knowledge_profile or {},
                "total_completed": len(submissions),
                "total_assignments": len(assignments)
            }

            report = await generate_classroom_analysis(personal_data)

            return {
                "role": "student",
                "metrics": {
                    "avg_score": avg_p_score,
                    "gpa": gpa,
                    "completion": len(submissions),
                    "total": len(assignments),
                    "trend": score_trend
                },
                "mastery": sorted((user.knowledge_profile or {}).items(), key=lambda x: x[1], reverse=True),
                "ai_report": report
            }

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
