import os
import json
from app.models.assignment import Assignment, Submission, AssignmentType
from app.agents.code_grader_agent import grade_code_submission
from app.agents.theory_grader_agent import grade_theory_submission

async def evaluate_submission(assignment: Assignment, submission: Submission, file_text: str = "") -> dict:
    """Evaluates a student submission by routing to specialized graders."""
    
    # 1. Prepare inputs
    description = assignment.description or "No description provided."
    test_cases = assignment.test_cases or []
    
    # Combine all text content available
    student_text_parts = []
    if file_text:
        student_text_parts.append(file_text)
    if submission.theory_answer:
        student_text_parts.append(submission.theory_answer)
    
    full_text = "\n\n".join(student_text_parts)
    student_code = submission.code or ""
    
    # 2. Determine Grading Strategy
    try:
        if assignment.type in [AssignmentType.CODING, AssignmentType.CODE]:
            # Use code grader primarily (it handles both exec and LLM)
            # If they provided text but assignment is coding, we'll append it to code comments for the AI part
            actual_code = student_code
            if full_text and not student_code:
                # Student might have uploaded .py/.cpp as a file
                actual_code = full_text
            
            return await grade_code_submission(description, actual_code, test_cases)
            
        elif assignment.type in [AssignmentType.THEORY, AssignmentType.CONTENT]:
            return await grade_theory_submission(description, full_text)
            
        elif assignment.type == AssignmentType.MIXED:
            # For mixed, we evaluate both and average
            code_res = await grade_code_submission(description, student_code, test_cases)
            theory_res = await grade_theory_submission(description, full_text)
            
            combined_score = (code_res.get("score", 0) + theory_res.get("score", 0)) / 2
            combined_feedback = f"--- Code Evaluation ---\n{code_res.get('feedback', '')}\n\n--- Theory Evaluation ---\n{theory_res.get('feedback', '')}"
            
            return {
                "score": combined_score,
                "feedback": combined_feedback,
                "concepts_identified": list(set(code_res.get("concepts_identified", []) + theory_res.get("concepts_identified", [])))
            }
        else:
            # Fallback for unspecified
            if student_code:
                return await grade_code_submission(description, student_code, test_cases)
            return await grade_theory_submission(description, full_text)
            
    except Exception as e:
        print(f"Routing Evaluator Error: {e}")
        return {
            "score": 0,
            "feedback": f"Evaluation routing failed: {str(e)}"
        }
