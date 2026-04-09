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
You are a personalized academic assistant for students.

You must prioritize CLASS CONTEXT first, then use verified general knowledge only if needed.
Never fabricate class facts.

Student Snapshot:
{student_snapshot}

Class Context:
{class_context}

Conversation History:
{history}

Student Question:
{question}

Instructions:
- First, answer from class context if relevant.
- If class context is incomplete, explicitly say what was not found and then provide a short verified general explanation.
- Keep response structured and concise.
- For problem-solving questions, provide step-by-step guidance.
- Use a supportive teaching tone.
- End with a short "Next step" for the student.

Output format (Markdown):
1) Direct Answer
2) Why (course-aligned)
3) Steps (if applicable)
4) Next Step
"""
)


def _candidate_keys() -> List[str]:
    keys: List[str] = []
    if GOOGLE_API_KEYS.strip():
        keys.extend([k.strip() for k in GOOGLE_API_KEYS.split(",") if k.strip()])
    if GOOGLE_API_KEY.strip() and GOOGLE_API_KEY.strip() not in keys:
        keys.append(GOOGLE_API_KEY.strip())
    return keys


def _available_keys() -> List[str]:
    now = time.time()
    return [k for k in _candidate_keys() if _KEY_COOLDOWN_UNTIL.get(k, 0) <= now]


def _cooldown_key(key: str, seconds: int) -> None:
    _KEY_COOLDOWN_UNTIL[key] = time.time() + seconds


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
    q = question.lower()
    if "linked list" in q and "reversal" in q:
        return (
            "Linked list reversal rewires each node to point backward instead of forward.\n"
            "- Core idea: maintain three pointers `prev`, `curr`, and `next`.\n"
            "- Initialize: `prev=None`, `curr=head`.\n"
            "- Repeat until `curr` is None:\n"
            "  1) Save next node: `next = curr.next`\n"
            "  2) Reverse link: `curr.next = prev`\n"
            "  3) Move forward: `prev = curr`, `curr = next`\n"
            "- End state: `prev` is the new head of reversed list.\n"
            "- Time complexity: O(n), Space complexity: O(1).\n"
            "- Quick dry run for 1 -> 2 -> 3:\n"
            "  Step A: reverse 1, list becomes 1 -> None, remaining 2 -> 3\n"
            "  Step B: reverse 2, list becomes 2 -> 1 -> None, remaining 3\n"
            "  Step C: reverse 3, list becomes 3 -> 2 -> 1 -> None"
        )
    if "binary search" in q:
        return (
            "Binary search works on sorted arrays by halving the search space each step. "
            "Compare middle element with target, then move to left or right half. "
            "Time O(log n), space O(1) iterative."
        )
    if "dynamic programming" in q:
        return (
            "For dynamic programming, define state, transition, and base cases first. "
            "Then choose top-down memoization or bottom-up tabulation, and verify overlapping subproblems."
        )
    return (
        "Break the concept into definition, core idea, algorithm/process, and one worked example. "
        "Then validate with edge cases and complexity."
    )


def _practice_checks(question: str) -> str:
    q = question.lower()
    if "linked list" in q and "reversal" in q:
        return (
            "1) Edge case checks: empty list, single-node list, and two-node list.\n"
            "2) Validate head update: final head must be previous tail.\n"
            "3) Ensure no cycle is created (last node should point to None).\n"
            "4) Compare output nodes count with input nodes count to avoid node loss."
        )
    return (
        "1) Test a normal case.\n"
        "2) Test smallest edge case.\n"
        "3) Test one tricky boundary case.\n"
        "4) Verify complexity and correctness constraints."
    )


def _next_step_hint(question: str) -> str:
    q = question.lower()
    if "code" in q or "implement" in q or "reversal" in q:
        return "Try writing a short implementation and share it; I will point out exact fixes line by line."
    return "Share the exact sub-part that is confusing, and I will explain it with one focused example."


def _fallback_answer(question: str, student_snapshot: str, class_context: str) -> str:
    snapshot = _safe_json_parse(student_snapshot)
    weak_topics = snapshot.get("weak_topics", []) if isinstance(snapshot.get("weak_topics", []), list) else []
    mastery = snapshot.get("overall_mastery")
    class_points = _select_relevant_class_points(question, class_context)
    class_points_md = "\n".join([f"- {point}" for point in class_points]) if class_points else "- No specific matching class topic found."
    weak_md = ", ".join([str(t) for t in weak_topics[:3]]) if weak_topics else "none recorded"

    general = _general_explanation(question)
    next_hint = _next_step_hint(question)
    practice = _practice_checks(question)

    return (
        "## Direct Answer\n"
        "I could not reach the AI model right now, so I combined your classroom context with a verified general explanation.\n\n"
        "## Why (course-aligned)\n"
        f"- Student mastery snapshot: {mastery if mastery is not None else 'not available'}\n"
        f"- Weak topics to prioritize: {weak_md}\n"
        "- Relevant class context used:\n"
        f"{class_points_md}\n\n"
        "## Steps\n"
        f"1. Problem focus: {question}.\n"
        "2. Classroom-first anchor: review the matched topic/material above.\n"
        f"3. General explanation (detailed):\n{general}\n"
        f"4. Practice checklist:\n{practice}\n"
        "5. Verification: explain why each step is correct and state time/space complexity with reason.\n\n"
        "## Next Step\n"
        f"{next_hint}"
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

    for key in keys:
        try:
            llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash",
                temperature=0.2,
                max_output_tokens=700,
                max_retries=0,
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
            msg = str(e).lower()
            if "quota" in msg or "resourceexhausted" in msg or "429" in msg:
                _cooldown_key(key, 900)
            else:
                _cooldown_key(key, 300)
            continue

    return {
        "answer": _fallback_answer(question, student_snapshot, class_context),
        "mode": "fallback",
    }
