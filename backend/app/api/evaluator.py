from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from beanie import PydanticObjectId
from app.models.assignment import Assignment, Submission, SubmissionStatus
from app.models.course import Course
from app.agents.evaluator_agent import evaluate_submission
from app.models.user import User

router = APIRouter()

@router.post("/{assignment_id}/{submission_id}/evaluate")
async def evaluate_single_submission(assignment_id: PydanticObjectId, submission_id: PydanticObjectId):
    assignment = await Assignment.get(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    submission = await Submission.get(submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    # In a real system, we'd extract text from the PDF if submission_file_url exists.
    # For now, we'll pass an empty string for file_text or a mock if it exists.
    # The evaluator_agent handles the rest.
    
    result = await evaluate_submission(assignment, submission)
    
    submission.score = result.get("score", 0)
    submission.feedback = result.get("feedback", "No feedback provided.")
    submission.status = SubmissionStatus.EVALUATED
    await submission.save()
    
    return {"message": "Submission evaluated", "score": submission.score, "feedback": submission.feedback}

@router.post("/{assignment_id}/evaluate-all")
async def evaluate_all_submissions(assignment_id: PydanticObjectId):
    assignment = await Assignment.get(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    submissions = await Submission.find(
        Submission.assignment.id == assignment_id,
        Submission.status == SubmissionStatus.PENDING
    ).to_list()
    
    count = 0
    for sub in submissions:
        result = await evaluate_submission(assignment, sub)
        sub.score = result.get("score", 0)
        sub.feedback = result.get("feedback", "No feedback provided.")
        sub.status = SubmissionStatus.EVALUATED
        await sub.save()
        count += 1
        
    return {"message": f"Evaluated {count} submissions"}

@router.post("/{assignment_id}/{submission_id}/send")
async def send_single_result(assignment_id: PydanticObjectId, submission_id: PydanticObjectId):
    submission = await Submission.get(submission_id)
    if not submission or submission.assignment.id != assignment_id:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    if submission.status != SubmissionStatus.EVALUATED:
        raise HTTPException(status_code=400, detail="Submission must be evaluated before sending.")
        
    submission.status = SubmissionStatus.SENT
    await submission.save()
    
    return {"message": "Result sent to student"}

@router.post("/{assignment_id}/send-all")
async def send_all_results(assignment_id: PydanticObjectId):
    # Update all EVALUATED submissions to SENT
    await Submission.find(
        Submission.assignment.id == assignment_id,
        Submission.status == SubmissionStatus.EVALUATED
    ).set({Submission.status: SubmissionStatus.SENT})
    
    return {"message": "All evaluated results sent to students"}

@router.get("/dashboard/course/{course_id}")
async def get_course_leaderboard(course_id: PydanticObjectId):
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
        
    assignments = await Assignment.find(Assignment.course.id == course_id).to_list()
    assignment_ids = [a.id for a in assignments]
    assignment_titles = {str(a.id): a.title for a in assignments}
    
    # Get all students for this course
    # Assuming students are enrolled or we can find them from submissions
    # Let's find all submissions for these assignments
    all_submissions = await Submission.find(
        Submission.assignment.id.in_(assignment_ids),
        fetch_links=True
    ).to_list()
    
    # Group by student
    student_stats = {} # student_id -> { name, assignments: { ass_id: score }, total }
    
    for sub in all_submissions:
        if not sub.student:
            continue
        sid = str(sub.student.id)
        if sid not in student_stats:
            student_stats[sid] = {
                "name": getattr(sub.student, "name", "Unknown student"),
                "assignments": {},
                "total": 0
            }
        
        # Only include score if it's evaluated/sent (or even just evaluated for leaderboard?)
        # User said "acc to their marks ... total we can see dashboard order"
        # Usually leaderboard shows published scores.
        score = sub.score or 0
        aid = str(sub.assignment.id)
        student_stats[sid]["assignments"][aid] = score
        student_stats[sid]["total"] += score
        
    # Convert to list and sort by total descending
    leaderboard = list(student_stats.values())
    leaderboard.sort(key=lambda x: x["total"], reverse=True)
    
    return {
        "assignments": [{"id": aid, "title": title} for aid, title in assignment_titles.items()],
        "leaderboard": leaderboard
    }
