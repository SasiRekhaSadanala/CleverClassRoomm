import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

grader_prompt = PromptTemplate.from_template(
    """
You are an expert AI teaching assistant grading a student's theory assignment.
You must use a WEIGHTED SCORING MODEL to evaluate the submission.

Assignment Prompt: {assignment_description}
Student's Essay/Response:
---
{student_text}
---

Your task is to evaluate the response based on these THREE categories:

1. Factual Accuracy (40%): How correct and detailed the information provided is.
2. Concept Coverage (30%): Did the student mention all key points requested in the prompt?
3. Writing Quality (30%): Clarity, professionalism, and depth of explanation.

SCORING RULE:
- Reward effort. If a student wrote a long, thoughtful response that has minor inaccuracies, focus on "Coverage" and "Quality" points.
- Never give a 0 if there is any relevant text.

Return ONLY a valid JSON object in this format:
{{
  "score": <calculated_weighted_average_0_100>,
  "breakdown": {{
    "accuracy": <0-100>,
    "coverage": <0-100>,
    "quality": <0-100>
  }},
  "feedback": "Detailed feedback explaining the score in each category...",
  "concepts_identified": ["topic1", "topic2"]
}}
"""
)

async def grade_theory_submission(description: str, text: str) -> dict:
    if not GOOGLE_API_KEY:
        return {"score": 50, "feedback": "AI Not Configured."}

    try:
        llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            temperature=0.2,
            google_api_key=GOOGLE_API_KEY,
        )
        chain = grader_prompt | llm | StrOutputParser()
        result = await chain.ainvoke({"assignment_description": description, "student_text": text})

        result = result.strip()
        if "```json" in result:
            result = result.split("```json")[1].split("```")[0]
        elif "```" in result:
            result = result.split("```")[1].split("```")[0]
        result = result.strip()

        parsed = json.loads(result)
        
        # Add explicit breakdown to feedback
        if "breakdown" in parsed:
            b = parsed["breakdown"]
            breakdown_text = f"\n\n--- Evaluation Breakdown ---\n• Accuracy: {b.get('accuracy')}/100\n• Coverage: {b.get('coverage')}/100\n• Writing Quality: {b.get('quality')}/100"
            parsed["feedback"] += breakdown_text
            
        return parsed

    except Exception as e:
        print(f"Theory Grader Weighted call failed: {e}")
        return {
            "score": 75.0,
            "feedback": "Error connecting to AI grader. Generic effort score assigned.",
            "concepts_identified": []
        }
