from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import shutil
import uuid
import os
from pathlib import Path
from app.models.assignment import Assignment, AssignmentType, Submission, SubmissionStatus
from app.models.user import User
from beanie import PydanticObjectId
from app.agents.code_understanding import analyze_code_semantics
from app.agents.analytics import update_knowledge_profile
import asyncio

BACKEND_DIR = Path(__file__).resolve().parents[2]
UPLOAD_DIR = BACKEND_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_API_BASE_URL = os.getenv("PUBLIC_API_BASE_URL", "http://127.0.0.1:8001")

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


def _serialize_submission(submission: Submission) -> dict:
    assignment_id = _link_to_id(submission.assignment)
    student_id = _link_to_id(submission.student)
    status = submission.status.value if hasattr(submission.status, "value") else str(submission.status)
    return {
        "_id": str(submission.id),
        "assignment_id": assignment_id,
        "student_id": student_id,
        "status": status,
        "score": submission.score,
        "feedback": submission.feedback,
        "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
        "submission_file_url": submission.submission_file_url,
        "file_name": submission.file_name,
        "theory_answer": submission.theory_answer,
        "code": submission.code
    }

class AssignmentCreate(BaseModel):
    title: str
    description: str
    type: str # 'theory', 'coding', 'project'
    course_id: PydanticObjectId
    due_date: datetime
    test_cases: Optional[List[dict]] = None

class CodeSubmission(BaseModel):
    student_id: PydanticObjectId
    code: str

async def evaluate_code_workflow(submission_id: PydanticObjectId, code: str, student_id: str, description: str, test_cases: list):
    from app.agents.code_grader_agent import grade_code_submission
    
    submission = await Submission.get(submission_id)
    if not submission:
        return
        
    try:
        # 1. AI GRADING
        result = await grade_code_submission(description, code, test_cases)
        
        submission.score = result.get("score", 0)
        submission.feedback = result.get("feedback", "No feedback provided.")
        submission.status = SubmissionStatus.EVALUATED
        await submission.save()
        
        # 2. CODE UNDERSTANDING AGENT (Optional secondary analysis)
        # concepts = await analyze_code_semantics(code)
        concepts = result.get("concepts_identified", [])
        
        # 3. ANALYTICS AGENT
        if concepts:
            await update_knowledge_profile(student_id, concepts, submission.score)
            
    except Exception as e:
        import traceback
        print(f"Workflow error: {e}")
        traceback.print_exc()
        submission.status = SubmissionStatus.FAILED
        submission.feedback = f"Error during evaluation: {str(e)}"
        await submission.save()

@router.post("")
async def create_assignment(data: AssignmentCreate):
    if data.type == AssignmentType.CODING.value and not data.test_cases:
        raise HTTPException(
            status_code=400,
            detail="Coding assignments must include test_cases for accurate evaluation.",
        )

    assignment = Assignment(
        title=data.title,
        description=data.description,
        type=AssignmentType(data.type),
        course=data.course_id,
        due_date=data.due_date,
        test_cases=data.test_cases
    )
    await assignment.insert()
    return assignment

@router.get("/{course_id}")
async def list_assignments(course_id: PydanticObjectId):
    assignments = await Assignment.find(Assignment.course.id == course_id).to_list()
    return assignments

@router.get("/{assignment_id}/submissions")
async def list_submissions(assignment_id: PydanticObjectId):
    submissions = await Submission.find(Submission.assignment.id == assignment_id, fetch_links=True).to_list()

    # Return plain JSON-safe objects so linked references never break serialization.
    results = []
    for s in submissions:
        doc = _serialize_submission(s)
        try:
            if s.student and hasattr(s.student, "name"):
                doc["student_name"] = s.student.name
            else:
                student_id = doc.get("student_id")
                student = await User.get(PydanticObjectId(student_id)) if student_id else None
                doc["student_name"] = student.name if student else "Unknown Student"
        except Exception:
            doc["student_name"] = "Unknown Student"
        results.append(doc)
    return results

@router.post("/{assignment_id}/submit-code")
async def submit_code(assignment_id: PydanticObjectId, submission_data: CodeSubmission, background_tasks: BackgroundTasks):
    assignment = await Assignment.get(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # SINGLE SUBMISSION CHECK
    existing = await Submission.find_one(
        Submission.assignment.id == assignment_id,
        Submission.student.id == submission_data.student_id
    )
    if existing:
        raise HTTPException(status_code=400, detail="You have already submitted this assignment.")
    
    submission = Submission(
        assignment=assignment_id,
        student=submission_data.student_id,
        code=submission_data.code,
        status=SubmissionStatus.PENDING
    )
    await submission.insert()
    
    # Trigger background evaluation pipeline
    background_tasks.add_task(
        evaluate_code_workflow,
        submission.id,
        submission_data.code,
        str(submission_data.student_id),
        assignment.description,
        assignment.test_cases or []
    )
    
    return {"message": "Code submitted successfully. Evaluation running in background.", "submission_id": str(submission.id)}


class TheorySubmission(BaseModel):
    student_id: PydanticObjectId
    text: str


async def evaluate_theory_workflow(submission_id: PydanticObjectId, text: str, student_id: str, description: str):
    from app.agents.theory_grader_agent import grade_theory_submission
    
    submission = await Submission.get(submission_id)
    if not submission:
        return
        
    try:
        # 1. AI GRADING
        result = await grade_theory_submission(description, text)
        
        submission.score = result.get("score", 0)
        submission.feedback = result.get("feedback", "No feedback provided.")
        submission.status = SubmissionStatus.EVALUATED
        await submission.save()
        
        # 2. ANALYTICS AGENT
        concepts = result.get("concepts_identified", [])
        if concepts:
            await update_knowledge_profile(student_id, concepts, submission.score)
            
    except Exception as e:
        import traceback
        print(f"Theory Workflow error: {e}")
        traceback.print_exc()
        submission.status = SubmissionStatus.FAILED
        submission.feedback = f"Error during theory evaluation: {str(e)}"
        await submission.save()


@router.post("/{assignment_id}/submit-file")
async def submit_file(
    assignment_id: PydanticObjectId,
    student_id: PydanticObjectId = Form(...),
    text_answer: Optional[str] = Form(None),
    file: UploadFile = File(...)
):
    assignment = await Assignment.get(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    # SINGLE SUBMISSION CHECK
    existing = await Submission.find_one(
        Submission.assignment.id == assignment_id,
        Submission.student.id == student_id
    )
    if existing:
        raise HTTPException(status_code=400, detail="You have already submitted this assignment.")

    # Save file
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    upload_path = UPLOAD_DIR / unique_filename
    
    with open(upload_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_url = f"{PUBLIC_API_BASE_URL}/uploads/{unique_filename}"
    
    submission = Submission(
        assignment=assignment_id,
        student=student_id,
        theory_answer=text_answer,
        submission_file_url=file_url,
        file_name=file.filename,
        status=SubmissionStatus.PENDING
    )
    await submission.insert()
    
    # Optional: Basic feedback for file submissions if it's a PDF (mocked for now)
    submission.score = 0
    submission.feedback = "File received. Awaiting manual review or background analysis."
    submission.status = SubmissionStatus.EVALUATED # Set to evaluated for static view
    await submission.save()
    
    return {"message": "File submitted successfully", "submission_id": str(submission.id)}


@router.post("/{assignment_id}/submit-theory")
async def submit_theory(assignment_id: PydanticObjectId, submission_data: TheorySubmission, background_tasks: BackgroundTasks):
    assignment = await Assignment.get(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    if assignment.type != AssignmentType.THEORY:
        raise HTTPException(status_code=400, detail="Not a theory assignment")

    # SINGLE SUBMISSION CHECK
    existing = await Submission.find_one(
        Submission.assignment.id == assignment_id,
        Submission.student.id == submission_data.student_id
    )
    if existing:
        raise HTTPException(status_code=400, detail="You have already submitted this assignment.")
    
    submission = Submission(
        assignment=assignment_id,
        student=submission_data.student_id,
        theory_answer=submission_data.text,
        status=SubmissionStatus.PENDING
    )
    await submission.insert()
    
    background_tasks.add_task(
        evaluate_theory_workflow,
        submission.id,
        submission_data.text,
        str(submission_data.student_id),
        assignment.description
    )
    
    return {"message": "Essay submitted successfully. AI evaluation running.", "submission_id": str(submission.id)}


@router.get("/student/{student_id}")
async def list_student_submissions(student_id: PydanticObjectId):
    # Beanie Link filtering: match by the linked document's ID
    submissions = await Submission.find(Submission.student.id == student_id).to_list()

    return [_serialize_submission(s) for s in submissions]

