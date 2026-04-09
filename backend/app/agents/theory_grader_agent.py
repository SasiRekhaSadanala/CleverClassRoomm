import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

grader_prompt = PromptTemplate.from_template(
    """
You are an expert AI teaching assistant grading a student's theory assignment.

Assignment Prompt: {assignment_description}
Student's Essay/Response:
---
{student_text}
---

Your task:
1. Evaluate the student's submission against the assignment prompt.
2. Provide a score from 0 to 100 based on accuracy, depth, and clarity.
3. Extract key distinct concepts the student demonstrated well.
4. Provide constructive feedback.

Return ONLY a valid JSON object in this exact format (no markdown fences, no extra text):
{{
  "score": 85,
  "feedback": "Detailed feedback here...",
  "concepts_identified": ["topic1", "topic2"]
}}
"""
)

async def grade_theory_submission(description: str, text: str) -> dict:
    if not GOOGLE_API_KEY:
        # Mock fallback
        print("No GOOGLE_API_KEY, using mock theory grader.")
        word_count = len(text.split())
        score = min(100, max(50, word_count // 2))
        return {
            "score": float(score),
            "feedback": "This is an automated mock evaluation. Good effort, but try to expand your answer more.",
            "concepts_identified": ["Basic Theory"] if word_count > 10 else []
        }

    try:
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            temperature=0.2,
            google_api_key=GOOGLE_API_KEY,
        )
        chain = grader_prompt | llm | StrOutputParser()
        result = await chain.ainvoke({"assignment_description": description, "student_text": text})

        result = result.strip()
        if result.startswith("```"):
            result = result.split("```")[1]
            if result.startswith("json"):
                result = result[4:]
        result = result.strip()

        parsed = json.loads(result)
        return parsed

    except Exception as e:
        print(f"Theory Grader Gemini call failed: {e}. Using mock fallback.")
        return {
            "score": 75.0,
            "feedback": "Error connecting to AI grader. Mock score assigned.",
            "concepts_identified": []
        }
