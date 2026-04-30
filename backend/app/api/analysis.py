from fastapi import APIRouter, HTTPException
from typing import Optional, List, Dict, Any
from beanie import PydanticObjectId

from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.user import User
from app.models.assignment import Assignment, Submission
from app.agents.classroom_analysis_agent import generate_classroom_analysis

router = APIRouter()

@router.get("/{course_id}/analysis")
async def get_course_analysis(course_id: str):
    try:
        course = await Course.get(PydanticObjectId(course_id))
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        # 1. Get all students in the course
        enrollments = await Enrollment.find(Enrollment.course_id == course_id).to_list()
        student_ids = [e.student_id for e in enrollments]
        students = await User.find({"_id": {"$in": [PydanticObjectId(sid) for sid in student_ids]}}).to_list()

        # 2. Aggregated Knowledge Profile
        topic_mastery = {}
        for student in students:
            profile = student.knowledge_profile or {}
            for topic, score in profile.items():
                if topic not in topic_mastery:
                    topic_mastery[topic] = []
                topic_mastery[topic].append(score)
        
        avg_topic_mastery = {k: round(sum(v)/len(v), 2) for k, v in topic_mastery.items() if v}

        # 3. Aggregated Scores
        assignments = await Assignment.find(Assignment.course_id == course_id).to_list()
        assignment_ids = [str(a.id) for a in assignments]
        
        submissions = await Submission.find({"assignment_id": {"$in": assignment_ids}}).to_list()
        
        scores = [s.score for s in submissions if s.score is not None]
        avg_score = round(sum(scores)/len(scores), 2) if scores else 0
        
        score_distribution = {
            "0-20": len([s for s in scores if s < 20]),
            "20-40": len([s for s in scores if 20 <= s < 40]),
            "40-60": len([s for s in scores if 40 <= s < 60]),
            "60-80": len([s for s in scores if 60 <= s < 80]),
            "80-100": len([s for s in scores if s >= 80]),
        }

        # 4. Aggregate Class Data for AI
        class_data = {
            "course_name": course.title,
            "total_students": len(students),
            "total_assignments": len(assignments),
            "average_class_score": avg_score,
            "topic_mastery": avg_topic_mastery,
            "score_distribution": score_distribution,
            "engagement_rate": round(len(submissions) / (len(students) * len(assignments)) * 100, 2) if students and assignments else 0
        }

        # 5. Generate AI Report
        report = await generate_classroom_analysis(class_data)

        return {
            "metrics": {
                "avg_score": avg_score,
                "student_count": len(students),
                "assignment_count": len(assignments),
                "completion_rate": class_data["engagement_rate"],
                "score_dist": score_distribution
            },
            "top_topics": sorted(avg_topic_mastery.items(), key=lambda x: x[1], reverse=True)[:5],
            "bottom_topics": sorted(avg_topic_mastery.items(), key=lambda x: x[1])[:5],
            "ai_report": report
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
