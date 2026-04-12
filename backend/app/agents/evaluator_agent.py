import os
import json
from langchain_core.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import StrOutputParser

from app.models.assignment import Assignment, Submission, AssignmentType

def _get_api_key():
    return os.getenv("GOOGLE_API_KEY", "").strip()

def _clean_llm_json(raw_text: str) -> str:
    cleaned = raw_text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()

CODE_PROMPT = """You are an expert Computer Science Professor AI evaluating a student's code submission.
Assignment Statement/Description: {description}
Test Cases (if any): {test_cases}

Student Submission:
{submission_text}

Task:
Evaluate the student's code for correctness, time/space complexity, modularity, and handling of edge cases.
If the student submitted code that solves the problem perfectly, score it highly (up to 100).
If there are syntax errors or logic bugs, reduce the score and explain what is wrong.

Return your response ONLY as a valid JSON object matching this schema:
{{
  "score": <int 0-100>,
  "feedback": "<string: detailed explanation of mistakes, what to improve, and what they did well>"
}}
"""

CONTENT_PROMPT = """You are an expert Academic Tutor AI evaluating a student's written/theory submission.
Assignment Statement/Description: {description}

Student Submission:
{submission_text}

Task:
Evaluate the student's submission for factual accuracy, keyword inclusion, alignment with the prompt, and logical flow.
Does the answer correctly and comprehensively answer the assignment statement?
If there is plagiarism or the answer is entirely irrelevant, give a very low score.

Return your response ONLY as a valid JSON object matching this schema:
{{
  "score": <int 0-100>,
  "feedback": "<string: detailed explanation of what concepts are missing, what is correct, and how to improve>"
}}
"""

MIXED_PROMPT = """You are an expert Professor AI evaluating a student's mixed (code + theory) submission.
Assignment Statement/Description: {description}
Test Cases (if any): {test_cases}

Student Submission:
{submission_text}

Task:
Evaluate both the written theory and the code implementations. 
Blend your evaluation: 50% weight to correctness/logic of any code, and 50% to factual accuracy/clarity of explanations.

Return your response ONLY as a valid JSON object matching this schema:
{{
  "score": <int 0-100>,
  "feedback": "<string: detailed explanation of evaluation on both code and theory>"
}}
"""

async def evaluate_submission(assignment: Assignment, submission: Submission, file_text: str = "") -> dict:
    """Evaluates a student submission based on its type."""
    api_key = _get_api_key()
    if not api_key:
        return {"score": 0, "feedback": "Evaluation failed: AI API Key not configured."}

    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        temperature=0.2,
        google_api_key=api_key
    )

    prompt_template_str = CONTENT_PROMPT
    if assignment.type in [AssignmentType.CODING, AssignmentType.CODE]:
        prompt_template_str = CODE_PROMPT
    elif assignment.type == AssignmentType.MIXED:
        prompt_template_str = MIXED_PROMPT
    elif assignment.type == AssignmentType.THEORY:
        prompt_template_str = CONTENT_PROMPT

    prompt = PromptTemplate.from_template(prompt_template_str)
    chain = prompt | llm | StrOutputParser()
    
    # Combine everything the student submitted into one block of text for the AI
    parts = []
    if submission.code:
        parts.append(f"--- CODE ---\n{submission.code}")
    if submission.theory_answer:
        parts.append(f"--- TEXT SUBMISSION ---\n{submission.theory_answer}")
    if file_text:
        parts.append(f"--- EXTRACTED FILE CONTENT ---\n{file_text}")
        
    submission_text = "\n\n".join(parts)
    if not submission_text.strip():
        return {"score": 0, "feedback": "Submitter provided no text or code."}

    try:
        raw_result = await chain.ainvoke({
            "description": assignment.description,
            "test_cases": json.dumps(assignment.test_cases) if assignment.test_cases else "None provided",
            "submission_text": submission_text
        })
        cleaned = _clean_llm_json(raw_result)
        result = json.loads(cleaned)
        return {
            "score": int(result.get("score", 0)),
            "feedback": str(result.get("feedback", "No feedback provided."))
        }
    except Exception as e:
        print(f"Evaluator error: {e}")
        return {
            "score": 0,
            "feedback": f"AI Evaluation encountered an error: {str(e)}"
        }
