import os
import time
import json
import google.generativeai as genai
from typing import List, Dict, Any

from langchain_core.prompts import PromptTemplate

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GOOGLE_API_KEYS = os.getenv("GOOGLE_API_KEYS", "")
_KEY_COOLDOWN_UNTIL: dict[str, float] = {}

chat_prompt = PromptTemplate.from_template(
    """
You are an exceptionally patient, supportive, and world-class academic tutor. Your primary goal is to nurture the student's understanding by providing clear and educational explanations.

Class Context (Topics & Materials):
{class_context}

Student Mastery Snapshot:
{student_snapshot}

Uploaded Document Text (if any):
{document_text}

Conversation History:
{history}

Current Query:
{question}

Instructions:
1. **Adaptive Detail**: Tailor your response length and depth to the user's query. 
   - If they ask a simple question (e.g., "What is ML?"), provide a solid, well-rounded answer that is clear but not overwhelmingly deep.
   - If they ask for a "brief" or "short" explanation, be concise.
   - If they ask for a "detailed" explanation, or if they ask you to explain a complex mechanism, go deep with step-by-step breakdowns and examples.
2. **Patience & Tone**: Imagine you are sitting next to the student, patiently walking them through the concept. Use a warm, encouraging tone.
3. **Diagrams**: Use Markdown `mermaid` diagrams (e.g., flowchart LR, sequenceDiagram) *only when helpful* to explain relationships, flows, or architectures. Do not force a diagram if the question is simple.
4. **Document Usage**: If the user provided 'Uploaded Document Text', use it extensively to answer their question.
5. **Formatting**: Use Markdown formatting (headers, bold text, bullet points) naturally to make the response visually organized and easy to read. Do not use a rigid, robotic output structure; let the structure flow naturally based on the question.
"""
)


def _candidate_keys() -> List[str]:
    keys: List[str] = []
    
    # Dedicated chatbot API key (separate quota from quiz generation)
    chat_key = os.getenv("CHATBOT_API_KEY")
    if chat_key:
        keys.append(chat_key)
        
    # Fallback to general API key
    if GOOGLE_API_KEY:
        keys.append(GOOGLE_API_KEY)
        
    # Support multiple rotation keys if provided
    if GOOGLE_API_KEYS:
        parts = [k.strip() for k in GOOGLE_API_KEYS.split(",") if k.strip()]
        keys.extend(parts)
        
    return list(dict.fromkeys(keys))


def _available_keys() -> List[str]:
    now = time.time()
    return [k for k in _candidate_keys() if _KEY_COOLDOWN_UNTIL.get(k, 0) < now]


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
    document_text: str = "",
) -> Dict[str, Any]:
    keys = _available_keys()
    if not keys:
        return {
            "answer": _fallback_answer(question, student_snapshot, class_context),
            "mode": "fallback",
        }

    # Format the prompt text using the template
    prompt_text = chat_prompt.format(
        question=question,
        student_snapshot=student_snapshot,
        class_context=class_context,
        document_text=document_text or "No document provided.",
        history=history,
    )

    last_error_msg = ""
    for key in keys:
        try:
            genai.configure(api_key=key)
            # Use gemini-flash-latest which is verified to work on these keys
            model = genai.GenerativeModel('gemini-flash-latest')
            
            response = await model.generate_content_async(
                prompt_text,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=8192,
                    temperature=0.7,
                )
            )
            
            return {"answer": response.text, "mode": "model"}
        except Exception as e:
            err_str = str(e).lower()
            if "exhausted" in err_str or "quota" in err_str or "429" in err_str:
                last_error_msg = "My AI free-tier rate limits have been temporarily reached (please try again in 1 minute)."
            print(f"Chatbot Agent Native Error with key {key[:5]}...: {e}")
            continue

    if last_error_msg:
        return {"answer": last_error_msg, "mode": "fallback"}
        
    return {
        "answer": _fallback_answer(question, student_snapshot, class_context),
        "mode": "fallback",
    }
