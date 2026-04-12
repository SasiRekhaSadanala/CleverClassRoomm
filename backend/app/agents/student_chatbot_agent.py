import os
import time
import json
from typing import List, Dict, Any

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GOOGLE_API_KEYS = os.getenv("GOOGLE_API_KEYS", "")
_KEY_COOLDOWN_UNTIL: dict[str, float] = {}

chat_prompt = PromptTemplate.from_template(
    """
You are a strictly course-aligned academic tutor. You ONLY answer questions that are directly related to the topics and materials provided in the Class Context below. You must NOT answer questions outside of this scope.

Class Context (Topics & Materials uploaded by the teacher):
{class_context}

Student Mastery Snapshot:
{student_snapshot}

Conversation History:
{history}

Current Query:
{question}

**CRITICAL GATEKEEPING RULE:**
First, determine if the student's query is related to ANY topic or material listed in the Class Context above.
- If the query IS related to the class context, provide a thorough, high-quality answer following the Output Structure below.
- If the query is NOT related to ANY topic in the class context, respond with ONLY this message (no other text):
"I'm sorry, but this topic is not covered in the course notes provided by your teacher. Please ask a question related to your class materials."

Instructions (only if the query IS relevant):
1. Provide a direct, thorough answer using the course context and your knowledge of that specific topic.
2. Use a supportive, encouraging, and sophisticated teaching tone.
3. For technical or problem-solving questions, break the explanation into intuitive steps.
4. Use Markdown formatting (headers, bold text, code blocks) to make the response visually organized and easy to read.

Output Structure (only if the query IS relevant):
## Quick Answer
The direct answer to the question.

## Deep Dive / Why
A detailed explanation of the concept, principles, and underlying logic.

## Step-by-Step / Examples
(If applicable) Practical examples or a logical breakdown of the process.

## Pro Tip / Next Concept
A related higher-level concept or a practical tip to help the learner master this topic.
"""
)


def _candidate_keys() -> List[str]:
    keys: List[str] = []
    
    # Evaluate at runtime so load_dotenv() from main.py is already active
    api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    api_keys = os.getenv("GOOGLE_API_KEYS", "").strip()
    
    if api_keys:
        keys.extend([k.strip() for k in api_keys.split(",") if k.strip()])
    if api_key and api_key not in keys:
        keys.append(api_key)
    return keys


def _available_keys() -> List[str]:
    return _candidate_keys()

def _cooldown_key(key: str, seconds: int) -> None:
    pass


def _safe_json_parse(raw: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass
    return {}


def _select_relevant_class_points(question: str, class_context: str) -> list[str]:
    ctx = _safe_json_parse(class_context)
    topics = ctx.get("topics", []) if isinstance(ctx.get("topics", []), list) else []
    q = question.lower()

    ranked: list[tuple[int, str]] = []
    for topic in topics:
        title = str(topic.get("title", "")).strip()
        desc = str(topic.get("description", "")).strip()
        materials = topic.get("materials", []) if isinstance(topic.get("materials", []), list) else []
        score = 0

        if title and title.lower() in q:
            score += 4
        for token in title.lower().split():
            if len(token) > 2 and token in q:
                score += 1

        material_titles = [str(m.get("title", "")).strip() for m in materials[:3]]
        if any(mt and mt.lower() in q for mt in material_titles):
            score += 2

        if title:
            summary = f"Topic: {title}"
            if desc:
                summary += f" - {desc[:140]}"
            if material_titles:
                summary += f" | Materials: {', '.join(material_titles)}"
            ranked.append((score, summary))

    ranked.sort(key=lambda x: x[0], reverse=True)
    selected = [item[1] for item in ranked[:3] if item[0] > 0]
    if not selected:
        selected = [item[1] for item in ranked[:2]]
    return selected


def _general_explanation(question: str) -> str:
    return (
        "This concept involves understanding the basic principles, identifying the core problem, "
        "and applying a systematic step-by-step solution. It is characterized by its efficiency "
        "and widespread application in academic and industrial problem-solving."
    )


def _practice_checks(question: str) -> str:
    return (
        "1) Verify the edge cases.\n"
        "2) Test with a standard input.\n"
        "3) Analyze time/space complexity."
    )


def _next_step_hint(question: str) -> str:
    q = question.lower()
    if "code" in q or "implement" in q or "reversal" in q:
        return "Try writing a short implementation and share it; I will point out exact fixes line by line."
    return "Share the exact sub-part that is confusing, and I will explain it with one focused example."


def _fallback_answer(question: str, student_snapshot: str, class_context: str) -> str:
    general = _general_explanation(question)
    practice = _practice_checks(question)

    return (
        "## Quick Answer\n"
        "I am currently operating in offline mode as I couldn't reach the AI model, but I can still provide a general overview of this topic.\n\n"
        "## Deep Dive / Why\n"
        f"The topic '{question}' is a fundamental concept. {general}\n\n"
        "## Step-by-Step / Examples\n"
        f"To master this, follow these steps:\n{practice}\n\n"
        "## Pro Tip / Next Concept\n"
        "Try to implement a small version of this concept yourself to see it in action!"
    )


async def generate_personalized_student_answer(
    question: str,
    student_snapshot: str,
    class_context: str,
    history: str,
) -> Dict[str, Any]:
    keys = _available_keys()
    if not keys:
        return {
            "answer": _fallback_answer(question, student_snapshot, class_context),
            "mode": "fallback",
        }

    last_error_msg = ""
    for key in keys:
        try:
            llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash",
                temperature=0.7,
                max_output_tokens=1000,
                max_retries=1,
                google_api_key=key,
            )
            chain = chat_prompt | llm | StrOutputParser()
            answer = await chain.ainvoke(
                {
                    "question": question,
                    "student_snapshot": student_snapshot,
                    "class_context": class_context,
                    "history": history,
                }
            )
            return {"answer": answer, "mode": "model"}
        except Exception as e:
            err_str = str(e).lower()
            if "exhausted" in err_str or "quota" in err_str or "429" in err_str:
                last_error_msg = "My AI free-tier rate limits have been temporarily reached (please try again in 1 minute)."
            print(f"Chatbot Agent Error with key {key[:5]}...: {e}")
            continue

    if last_error_msg:
        fallback_notice = f"**System Notice**: {last_error_msg}\n\n"
    else:
        fallback_notice = ""

    return {
        "answer": fallback_notice + _fallback_answer(question, student_snapshot, class_context),
        "mode": "fallback",
    }
