from fastapi import APIRouter, HTTPException, Response
from app.models.user import User
from app.models.quiz import QuizResult, Quiz
from app.models.enrollment import Enrollment
from app.models.assignment import Assignment, Submission
from app.models.course import Course
from beanie import PydanticObjectId
from typing import Optional
from datetime import datetime
from io import BytesIO

router = APIRouter()


def _link_to_id(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, PydanticObjectId):
        return str(value)
    if hasattr(value, "id") and getattr(value, "id") is not None:
        return str(value.id)
    ref = getattr(value, "ref", None)
    if ref is not None and hasattr(ref, "id"):
        return str(ref.id)
    return str(value)


async def _compute_student_progress(user: User) -> dict:
    student_id = str(user.id)
    profile = user.knowledge_profile or {}
    activity = getattr(user, "topic_activity", {}) or {}

    quiz_results = await QuizResult.find(QuizResult.student_id == student_id).to_list()
    quizzes_by_id: dict[str, Quiz] = {}

    quiz_attempts: dict[str, int] = {}
    quiz_avg_accumulator: dict[str, list[float]] = {}

    for result in quiz_results:
        if result.quiz_id not in quizzes_by_id:
            try:
                q = await Quiz.get(PydanticObjectId(result.quiz_id))
                if q:
                    quizzes_by_id[result.quiz_id] = q
            except Exception:
                continue

        quiz = quizzes_by_id.get(result.quiz_id)
        if not quiz:
            continue

        for idx, question in enumerate(quiz.questions):
            selected = result.answers[idx] if idx < len(result.answers) else -1
            correct = selected == question.correct_option_index
            raw_topics = question.topic_ids if question.topic_ids else [quiz.title]
            for raw_topic in raw_topics:
                topic = (raw_topic or "general").strip().lower()
                if not topic:
                    topic = "general"
                quiz_attempts[topic] = quiz_attempts.get(topic, 0) + 1
                scores = quiz_avg_accumulator.get(topic, [])
                scores.append(100.0 if correct else 0.0)
                quiz_avg_accumulator[topic] = scores

    topics = sorted(set(list(profile.keys()) + list(activity.keys()) + list(quiz_attempts.keys())))
    topic_progress = []
    for topic in topics:
        score = float(profile.get(topic, 50.0))
        events = activity.get(topic, [])
        recent = events[-5:] if events else []

        trend = "stable"
        if len(recent) >= 2:
            delta = float(recent[-1].get("resulting_score", score)) - float(recent[0].get("resulting_score", score))
            if delta > 3:
                trend = "up"
            elif delta < -3:
                trend = "down"

        quiz_scores = quiz_avg_accumulator.get(topic, [])
        quiz_avg = round(sum(quiz_scores) / len(quiz_scores), 1) if quiz_scores else None

        mastery = "strong" if score >= 75 else "developing" if score >= 50 else "weak"
        topic_progress.append(
            {
                "topic": topic,
                "mastery_score": round(score, 1),
                "mastery_level": mastery,
                "trend": trend,
                "activity_count": len(events),
                "quiz_attempts": quiz_attempts.get(topic, 0),
                "quiz_accuracy": quiz_avg,
                "last_activity": events[-1].get("timestamp") if events else None,
            }
        )

    topic_progress.sort(key=lambda x: x["mastery_score"])
    weak_topics = [item["topic"] for item in topic_progress if item["mastery_score"] < 60][:5]

    overall_mastery = (
        round(sum(item["mastery_score"] for item in topic_progress) / len(topic_progress), 1)
        if topic_progress
        else 0.0
    )

    return {
        "student_id": student_id,
        "name": user.name,
        "knowledge_profile": profile,
        "topic_progress": topic_progress,
        "overall_mastery": overall_mastery,
        "weak_topics": weak_topics,
        "insights": {
            "tracked_topics": len(topic_progress),
            "total_quiz_results": len(quiz_results),
        },
    }


@router.get("/student/{student_id}/progress")
async def get_student_progress(student_id: PydanticObjectId):
    user = await User.get(student_id)
    if not user:
        raise HTTPException(status_code=404, detail="Student not found")
    return await _compute_student_progress(user)


@router.get("/teacher/students-progress")
async def get_teacher_students_progress(course_id: Optional[str] = None):
    """
    Returns per-student progress summary for teacher dashboards.
    If course_id is provided, only includes students enrolled in that course.
    """
    try:
        students: list[User] = []
        if course_id:
            enrollments = await Enrollment.find(Enrollment.course_id == str(course_id)).to_list()
            student_ids = list({e.student_id for e in enrollments if e.student_id})
            if student_ids:
                object_ids = []
                for sid in student_ids:
                    try:
                        object_ids.append(PydanticObjectId(sid))
                    except Exception:
                        continue
                students = await User.find(
                    {
                        "$and": [
                            {"_id": {"$in": object_ids}},
                            {"role": "student"},
                        ]
                    }
                ).to_list()
            else:
                students = []
        else:
            students = await User.find(User.role == "student").to_list()

        rows = []
        for student in students:
            progress = await _compute_student_progress(student)
            rows.append(
                {
                    "student_id": progress["student_id"],
                    "name": progress["name"],
                    "overall_mastery": progress["overall_mastery"],
                    "tracked_topics": progress["insights"]["tracked_topics"],
                    "quiz_submissions": progress["insights"]["total_quiz_results"],
                    "weak_topics": progress["weak_topics"],
                }
            )

        rows.sort(key=lambda row: row["overall_mastery"])
        return {"students": rows, "count": len(rows), "course_id": course_id}
    except Exception as e:
        print(f"Error in get_teacher_students_progress: {e}")
        return {"students": [], "count": 0, "course_id": course_id, "error": str(e)}


@router.get("/teacher/weaknesses")
async def get_global_weaknesses():
    """
    Aggregates knowledge profiles across all students to find
    topics where average score < 60 (areas of weakness).
    """
    try:
        users = await User.find(User.role == "student").to_list()

        topic_aggregates: dict[str, float] = {}
        topic_counts: dict[str, int] = {}

        for u in users:
            # Safely handle missing or empty knowledge profiles
            profile = getattr(u, "knowledge_profile", {}) or {}
            for topic, score in profile.items():
                topic_aggregates[topic] = topic_aggregates.get(topic, 0) + score
                topic_counts[topic] = topic_counts.get(topic, 0) + 1

        result = []
        for topic, total_score in topic_aggregates.items():
            count = topic_counts[topic]
            if count > 0:
                avg = total_score / count
                result.append({
                    "topic": topic,
                    "average_score": round(avg, 1),
                    "student_count": count,
                })

        # Sort by average score ascending (weakest first)
        result.sort(key=lambda x: x["average_score"])
        return {"weaknesses": result}
    except Exception as e:
        print(f"Error in get_global_weaknesses: {e}")
        return {"weaknesses": [], "error": str(e)}


@router.get("/class/overview")
async def get_class_overview():
    """
    High-level stats for the teacher analytics dashboard.
    """
    try:
        all_students = await User.find(User.role == "student").to_list()
        student_count = len(all_students)

        # Average knowledge score across all student profiles
        all_scores = []
        for u in all_students:
            profile = getattr(u, "knowledge_profile", {}) or {}
            if profile:
                all_scores.extend(profile.values())
        
        avg_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0

        # Quiz result stats
        all_results = await QuizResult.find_all().to_list()
        quiz_count = len(all_results)

        # Enrollment count
        all_enrollments = await Enrollment.find_all().to_list()

        return {
            "total_students": student_count,
            "average_knowledge_score": avg_score,
            "total_quiz_submissions": quiz_count,
            "total_enrollments": len(all_enrollments),
        }
    except Exception as e:
        print(f"Error in get_class_overview: {e}")
        return {
            "total_students": 0,
            "average_knowledge_score": 0,
            "total_quiz_submissions": 0,
            "total_enrollments": 0,
            "error": str(e)
        }


@router.get("/teacher/dashboard-summary")
async def get_teacher_dashboard_summary():
    """
    Aggregated dashboard payload to avoid many frontend round trips.
    Returns stats, top weaknesses, and recent evaluations in one response.
    """
    try:
        courses = await Course.find_all().to_list()
        assignments = await Assignment.find_all().to_list()
        quizzes = await Quiz.find_all().to_list()
        submissions = await Submission.find_all(fetch_links=True).to_list()
        students = await User.find(User.role == "student").to_list()

        assignment_title_by_id: dict[str, str] = {}
        for a in assignments:
            assignment_title_by_id[str(a.id)] = a.title

        course_title_by_id: dict[str, str] = {}
        for c in courses:
            course_title_by_id[str(c.id)] = c.title

        assignment_course_by_id: dict[str, str] = {}
        for a in assignments:
            assignment_course_by_id[str(a.id)] = _link_to_id(a.course) or ""

        today = datetime.utcnow().date()
        submissions_today = 0
        needs_review = 0
        pending_over_24h = 0
        evaluated_ages_hours: list[float] = []
        review_queue: list[dict] = []

        for s in submissions:
            if s.submitted_at and s.submitted_at.date() == today:
                submissions_today += 1

            status = s.status.value if hasattr(s.status, "value") else str(s.status)
            if status in ["pending", "failed"]:
                needs_review += 1
                age_hours = max(0.0, (datetime.utcnow() - s.submitted_at).total_seconds() / 3600) if s.submitted_at else 0.0
                if status == "pending" and age_hours > 24:
                    pending_over_24h += 1

                assignment_id = _link_to_id(s.assignment)
                student_name = "Student"
                try:
                    if s.student and hasattr(s.student, "name") and s.student.name:
                        student_name = s.student.name
                except Exception:
                    pass

                course_id = assignment_course_by_id.get(assignment_id or "", "")
                review_queue.append(
                    {
                        "submission_id": str(s.id),
                        "assignment_id": assignment_id,
                        "assignment_title": assignment_title_by_id.get(assignment_id or "", "Untitled Assignment"),
                        "course_id": course_id,
                        "course_title": course_title_by_id.get(course_id, "Unknown Course"),
                        "student_name": student_name,
                        "status": status,
                        "score": float(s.score) if s.score is not None else None,
                        "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
                        "age_hours": round(age_hours, 1),
                    }
                )

            if status == "evaluated" and s.submitted_at:
                evaluated_ages_hours.append(max(0.0, (datetime.utcnow() - s.submitted_at).total_seconds() / 3600))

        sorted_submissions = sorted(
            submissions,
            key=lambda x: x.submitted_at or datetime.min,
            reverse=True,
        )

        recent_evaluations = []
        for s in sorted_submissions[:8]:
            assignment_id = _link_to_id(s.assignment)
            assignment_title = assignment_title_by_id.get(assignment_id or "", "Untitled Assignment")

            student_name = "Student"
            try:
                if s.student and hasattr(s.student, "name") and s.student.name:
                    student_name = s.student.name
                else:
                    sid = _link_to_id(s.student)
                    if sid:
                        student = await User.get(PydanticObjectId(sid))
                        if student and student.name:
                            student_name = student.name
            except Exception:
                pass

            score = float(s.score) if s.score is not None else None
            status_raw = s.status.value if hasattr(s.status, "value") else str(s.status)
            if status_raw == "evaluated":
                status_label = "Passed" if (score is not None and score >= 60) else "Failed"
            elif status_raw == "failed":
                status_label = "Failed"
            else:
                status_label = "Pending"

            recent_evaluations.append(
                {
                    "id": str(s.id),
                    "name": student_name,
                    "task": assignment_title,
                    "score": score,
                    "status": status_label,
                    "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
                }
            )

        # Reuse existing overview + weaknesses logic for consistency.
        overview = await get_class_overview()
        weaknesses_payload = await get_global_weaknesses()
        weaknesses = weaknesses_payload.get("weaknesses", []) if isinstance(weaknesses_payload, dict) else []

        at_risk_students = []
        for u in students:
            profile = getattr(u, "knowledge_profile", {}) or {}
            if not profile:
                continue
            overall = round(sum(profile.values()) / len(profile), 1)
            weak_count = len([v for v in profile.values() if float(v) < 60])
            risk_score = min(100.0, round((max(0.0, 65 - overall) * 1.2) + (weak_count * 6), 1))
            if overall < 60 or weak_count >= 3:
                at_risk_students.append(
                    {
                        "student_id": str(u.id),
                        "name": u.name,
                        "overall_mastery": overall,
                        "weak_topic_count": weak_count,
                        "risk_score": risk_score,
                    }
                )
        at_risk_students.sort(key=lambda x: x["risk_score"], reverse=True)

        course_breakdown = []
        quiz_course_counts: dict[str, int] = {}
        for q in quizzes:
            cid = _link_to_id(q.course)
            if cid:
                quiz_course_counts[cid] = quiz_course_counts.get(cid, 0) + 1

        submissions_by_course: dict[str, int] = {}
        pending_by_course: dict[str, int] = {}
        for s in submissions:
            aid = _link_to_id(s.assignment)
            cid = assignment_course_by_id.get(aid or "", "")
            if not cid:
                continue
            submissions_by_course[cid] = submissions_by_course.get(cid, 0) + 1
            s_status = s.status.value if hasattr(s.status, "value") else str(s.status)
            if s_status in ["pending", "failed"]:
                pending_by_course[cid] = pending_by_course.get(cid, 0) + 1

        for c in courses:
            cid = str(c.id)
            assignment_count = len([a for a in assignments if (_link_to_id(a.course) or "") == cid])
            course_breakdown.append(
                {
                    "course_id": cid,
                    "course_title": c.title,
                    "assignments": assignment_count,
                    "quizzes": quiz_course_counts.get(cid, 0),
                    "submissions": submissions_by_course.get(cid, 0),
                    "needs_review": pending_by_course.get(cid, 0),
                }
            )

        review_queue.sort(key=lambda x: x.get("age_hours", 0), reverse=True)
        avg_evaluation_hours = round(sum(evaluated_ages_hours) / len(evaluated_ages_hours), 1) if evaluated_ages_hours else 0.0

        return {
            "active_courses": len(courses),
            "submissions_today": submissions_today,
            "needs_review": needs_review,
            "sla": {
                "avg_evaluation_age_hours": avg_evaluation_hours,
                "pending_over_24h": pending_over_24h,
                "evaluated_count": len(evaluated_ages_hours),
            },
            "overview": overview,
            "weaknesses": weaknesses[:8],
            "recent_evaluations": recent_evaluations,
            "review_queue": review_queue[:20],
            "at_risk_students": at_risk_students[:10],
            "course_breakdown": course_breakdown,
        }
    except Exception as e:
        print(f"Error in get_teacher_dashboard_summary: {e}")
        return {
            "active_courses": 0,
            "submissions_today": 0,
            "needs_review": 0,
            "sla": {
                "avg_evaluation_age_hours": 0.0,
                "pending_over_24h": 0,
                "evaluated_count": 0,
            },
            "overview": {
                "total_students": 0,
                "average_knowledge_score": 0,
                "total_quiz_submissions": 0,
                "total_enrollments": 0,
            },
            "weaknesses": [],
            "recent_evaluations": [],
            "review_queue": [],
            "at_risk_students": [],
            "course_breakdown": [],
            "error": str(e),
        }


@router.get("/teacher/dashboard-report.csv")
async def get_teacher_dashboard_report_csv():
    summary = await get_teacher_dashboard_summary()

    rows = [
        "section,key,value",
        f"overview,active_courses,{summary.get('active_courses', 0)}",
        f"overview,total_students,{(summary.get('overview') or {}).get('total_students', 0)}",
        f"overview,average_knowledge_score,{(summary.get('overview') or {}).get('average_knowledge_score', 0)}",
        f"overview,submissions_today,{summary.get('submissions_today', 0)}",
        f"overview,needs_review,{summary.get('needs_review', 0)}",
        f"sla,avg_evaluation_age_hours,{(summary.get('sla') or {}).get('avg_evaluation_age_hours', 0)}",
        f"sla,pending_over_24h,{(summary.get('sla') or {}).get('pending_over_24h', 0)}",
    ]

    for idx, item in enumerate(summary.get("weaknesses", [])[:10], start=1):
        rows.append(f"weakness_{idx},topic,{item.get('topic', '')}")
        rows.append(f"weakness_{idx},average_score,{item.get('average_score', 0)}")
        rows.append(f"weakness_{idx},student_count,{item.get('student_count', 0)}")

    for idx, item in enumerate(summary.get("at_risk_students", [])[:10], start=1):
        rows.append(f"risk_{idx},name,{item.get('name', '')}")
        rows.append(f"risk_{idx},overall_mastery,{item.get('overall_mastery', 0)}")
        rows.append(f"risk_{idx},risk_score,{item.get('risk_score', 0)}")

    content = "\n".join(rows)
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=teacher-dashboard-report.csv"},
    )


def _build_agent_oriented_recommendations(summary: dict) -> list[str]:
    weaknesses = summary.get("weaknesses", []) or []
    risks = summary.get("at_risk_students", []) or []
    queue = summary.get("review_queue", []) or []
    sla = summary.get("sla", {}) or {}

    recs: list[str] = []

    if weaknesses:
        top = weaknesses[0]
        recs.append(
            f"Intervention Agent: Create a remedial quiz set for '{top.get('topic', 'top weak topic')}' and assign it this week."
        )
    else:
        recs.append("Intervention Agent: No severe weak topic detected; run reinforcement quiz for top 2 medium-score topics.")

    if risks:
        names = ", ".join([r.get("name", "Student") for r in risks[:3]])
        recs.append(
            f"At-Risk Agent: Schedule focused support sessions for {names}; target +8 mastery points by next week."
        )
    else:
        recs.append("At-Risk Agent: No critical risk cohort detected this week.")

    pending_over_24h = int(sla.get("pending_over_24h", 0) or 0)
    if pending_over_24h > 0:
        recs.append(
            f"Evaluation Agent: Clear {pending_over_24h} pending submissions older than 24h to reduce grading lag."
        )

    if queue:
        top_item = queue[0]
        recs.append(
            "Queue Agent: Prioritize oldest queue item "
            f"'{top_item.get('assignment_title', 'assignment')}' ({top_item.get('age_hours', 0)}h old)."
        )

    recs.append("Planning Agent: Publish weekly target metrics (review queue < 5, avg mastery +3, pending>24h = 0).")
    return recs[:6]


@router.get("/teacher/dashboard-report.pdf")
async def get_teacher_dashboard_report_pdf():
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="PDF export dependency missing. Install 'reportlab' in backend requirements.",
        )

    summary = await get_teacher_dashboard_summary()

    today = datetime.utcnow().date()
    week_start = today.fromordinal(today.toordinal() - today.weekday())
    week_end = week_start.fromordinal(week_start.toordinal() + 6)

    overview = summary.get("overview", {}) or {}
    weaknesses = summary.get("weaknesses", []) or []
    risks = summary.get("at_risk_students", []) or []
    course_breakdown = summary.get("course_breakdown", []) or []
    recs = _build_agent_oriented_recommendations(summary)

    buf = BytesIO()
    p = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    x_margin = 18 * mm
    y = height - 18 * mm

    def line(text: str, size: int = 10, leading: int = 14):
        nonlocal y
        if y < 20 * mm:
            p.showPage()
            y = height - 18 * mm
        p.setFont("Helvetica", size)
        p.drawString(x_margin, y, text)
        y -= leading

    p.setTitle("Teacher Weekly Agent Report")
    p.setFont("Helvetica-Bold", 16)
    p.drawString(x_margin, y, "Teacher Weekly Agent-Oriented Report")
    y -= 18
    line(f"Reporting Window: {week_start.isoformat()} to {week_end.isoformat()}", 10, 14)
    line(f"Generated At (UTC): {datetime.utcnow().isoformat(timespec='seconds')}", 9, 14)
    y -= 4

    line("1) Executive Summary", 12, 16)
    line(f"- Active Courses: {summary.get('active_courses', 0)}")
    line(f"- Total Students: {overview.get('total_students', 0)}")
    line(f"- Average Knowledge Score: {overview.get('average_knowledge_score', 0)}%")
    line(f"- Submissions Today: {summary.get('submissions_today', 0)}")
    line(f"- Needs Review: {summary.get('needs_review', 0)}")
    y -= 4

    line("2) Agent Insights", 12, 16)
    for item in recs:
        line(f"- {item}")
    y -= 4

    line("3) Top Weak Topics", 12, 16)
    if not weaknesses:
        line("- No weak topic data available.")
    else:
        for w in weaknesses[:5]:
            line(
                f"- {w.get('topic', 'topic')}: {w.get('average_score', 0)}% avg across {w.get('student_count', 0)} students"
            )
    y -= 4

    line("4) At-Risk Cohort", 12, 16)
    if not risks:
        line("- No high-risk students flagged this week.")
    else:
        for s in risks[:8]:
            line(
                f"- {s.get('name', 'Student')} | mastery {s.get('overall_mastery', 0)}% | risk {s.get('risk_score', 0)}"
            )
    y -= 4

    line("5) Course Drill-down Snapshot", 12, 16)
    if not course_breakdown:
        line("- No course breakdown data available.")
    else:
        for c in course_breakdown[:8]:
            line(
                "- "
                f"{c.get('course_title', 'Course')} | assignments {c.get('assignments', 0)} | "
                f"quizzes {c.get('quizzes', 0)} | submissions {c.get('submissions', 0)} | "
                f"needs review {c.get('needs_review', 0)}"
            )

    y -= 8
    line("6) Recommended Weekly Targets", 12, 16)
    line("- Bring pending-over-24h to 0")
    line("- Close review queue to under 5")
    line("- Improve class average mastery by at least 3 points")
    line("- Run one remedial quiz for top weak topic")

    p.showPage()
    p.save()
    pdf_data = buf.getvalue()
    buf.close()

    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=teacher-weekly-agent-report.pdf"},
    )
