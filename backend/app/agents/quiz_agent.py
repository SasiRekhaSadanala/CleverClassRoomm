import os
import json
import re
from typing import Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

# GOOGLE_API_KEY placeholder — set this in your environment before running
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

quiz_prompt = PromptTemplate.from_template(
    """
You are an expert educational quiz generator.

Generate exactly {num_questions} high-quality multiple-choice questions about the following topic for university-level students.
Difficulty: {difficulty}

Topic: {topic}

Return ONLY a valid JSON array (no markdown, no extra text) in this exact format:
[
  {{
    "text": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_option_index": 0,
    "explanation": "A detailed explanation of why the correct option is right and others are wrong."
  }}
]

Rules:
- Each question must have exactly 4 options
- correct_option_index is 0-based (0, 1, 2, or 3)
- Questions should be clear, specific, and test deep understanding for {difficulty} level
- Avoid trivia/definitions-only questions
- Use realistic distractors that are plausible but clearly incorrect
- Avoid options like "All of the above" or "None of the above"
- Keep options similar in length and style to avoid obvious clues
- Include at least 2 application/scenario-based questions
- Each question must have one unambiguously correct answer
- The explanation must be helpful, constructive, and explain the core concept
- Do NOT include any text outside the JSON array
"""
)


quiz_retry_prompt = PromptTemplate.from_template(
    """
You are fixing a low-quality quiz draft.

Topic: {topic}
Requested Count: {num_questions}
Requested Difficulty: {difficulty}

Issues found in the previous draft:
{issues}

Return ONLY a valid JSON array with exactly {num_questions} questions using schema:
[{{"text":"...","options":["...","...","...","..."],"correct_option_index":0,"explanation":"..."}}]

Quality requirements:
- University-level, concept + application balanced
- Distinct questions (no duplicates or near-duplicates)
- Exactly 4 unique options per question
- One unambiguous correct option
- No "All of the above" / "None of the above"
- include a clear explanation for every question
"""
)


def _clean_llm_json(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        parts = cleaned.split("```")
        if len(parts) >= 2:
            cleaned = parts[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
    return cleaned.strip()


def _normalize_question(item: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None

    text = str(item.get("text", "")).strip()
    options = item.get("options", [])
    idx = item.get("correct_option_index", None)
    explanation = str(item.get("explanation", "")).strip()

    if not text or not isinstance(options, list) or len(options) != 4:
        return None

    norm_options = [str(opt).strip() for opt in options]
    if any(not opt for opt in norm_options):
        return None
    if len(set(opt.lower() for opt in norm_options)) != 4:
        return None

    bad_patterns = ["all of the above", "none of the above"]
    for opt in norm_options:
        low = opt.lower()
        if any(p in low for p in bad_patterns):
            return None

    try:
        idx = int(idx)
    except Exception:
        return None
    if idx < 0 or idx > 3:
        return None

    if not text.endswith("?"):
        text = f"{text}?"

    text = re.sub(r"\s+", " ", text)
    norm_options = [re.sub(r"\s+", " ", opt) for opt in norm_options]
    if not explanation:
        explanation = f"Correct answer is {norm_options[idx]}"

    return {
        "text": text,
        "options": norm_options,
        "correct_option_index": idx,
        "explanation": explanation,
    }


def _validate_and_repair_questions(questions: Any, expected_count: int) -> tuple[list[dict[str, Any]], list[str]]:
    issues: list[str] = []
    if not isinstance(questions, list):
        return [], ["Output is not a JSON array"]

    normalized: list[dict[str, Any]] = []
    seen_texts: set[str] = set()

    for q in questions:
        nq = _normalize_question(q)
        if not nq:
            issues.append("Invalid question shape/options/index detected")
            continue

        key = re.sub(r"\W+", "", nq["text"].lower())
        if key in seen_texts:
            issues.append("Duplicate or near-duplicate question text detected")
            continue
        seen_texts.add(key)
        normalized.append(nq)

    if len(normalized) < expected_count:
        issues.append(f"Only {len(normalized)} valid unique questions; expected {expected_count}")

    return normalized[:expected_count], issues


async def _invoke_quiz_llm(prompt: PromptTemplate, topic: str, num_questions: int, difficulty: str, issues: str = "") -> list[dict[str, Any]]:
    api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if not api_key:
        print("Quiz Agent Warning: No GOOGLE_API_KEY resolved at runtime.")
    
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        temperature=0.25,
        google_api_key=api_key,
    )
    chain = prompt | llm | StrOutputParser()
    payload = {"topic": topic, "num_questions": num_questions, "difficulty": difficulty}
    if issues:
        payload["issues"] = issues
    result = await chain.ainvoke(payload)
    cleaned = _clean_llm_json(result)
    parsed = json.loads(cleaned)
    normalized, found_issues = _validate_and_repair_questions(parsed, num_questions)
    if found_issues:
        raise ValueError("; ".join(found_issues))
    return normalized


async def generate_quiz_questions(topic: str, num_questions: int = 5, difficulty: str = "medium") -> list[dict]:
    """
    AI Quiz Generator Agent.
    Calls Gemini to produce MCQs for the given topic, count, and difficulty.
    Falls back to hardcoded mock questions if no API key is set.
    """
    if not GOOGLE_API_KEY:
        # High-quality mock fallback
        return _mock_questions(topic, num_questions)

    try:
        return await _invoke_quiz_llm(quiz_prompt, topic, num_questions, difficulty)

    except Exception as e:
        print(f"[QuizAgent] Primary quiz generation failed: {e}. Retrying with repair prompt.")
        try:
            return await _invoke_quiz_llm(quiz_retry_prompt, topic, num_questions, difficulty, issues=str(e))
        except Exception as retry_err:
            print(f"[QuizAgent] Retry failed: {retry_err}. Using topic-aware fallback.")
            return _mock_questions(topic, num_questions)


def _mock_questions(topic: str, num_questions: int = 5) -> list[dict]:
    """Topic-aware fallback questions when model output is unavailable or invalid."""
    t = (topic or "").strip() or "the topic"
    lower = t.lower()
    
    questions = []

    if "array" in lower:
        questions = [
            {
                "text": "You need frequent indexed access and occasional inserts in the middle. Which trade-off best describes arrays?",
                "options": [
                    "O(1) indexed reads and O(n) middle inserts",
                    "O(log n) indexed reads and O(1) middle inserts",
                    "O(1) indexed reads and O(1) middle inserts",
                    "O(n) indexed reads and O(log n) middle inserts",
                ],
                "correct_option_index": 0,
                "explanation": "Arrays provide constant time access via index but require shifting elements for middle insertions, leading to linear time complexity.",
            },
            {
                "text": "For a sorted array, which approach gives worst-case O(log n) search time?",
                "options": [
                    "Binary search",
                    "Linear scan",
                    "Interpolation by random pivot",
                    "Breadth-first traversal",
                ],
                "correct_option_index": 0,
                "explanation": "Binary search repeatedly divides the search interval in half, achieving logarithmic time complexity for sorted data.",
            },
            {
                "text": "When rotating an array right by k in-place, which idea minimizes extra space?",
                "options": [
                    "Reverse sections of the array",
                    "Create k temporary arrays",
                    "Use recursion with full copies",
                    "Insert each element at index 0 repeatedly",
                ],
                "correct_option_index": 0,
                "explanation": "Reversing sections (the whole array, then the first k, then the rest) allows in-place rotation with O(1) space.",
            },
            {
                "text": "Which bug is most common in two-pointer array algorithms?",
                "options": [
                    "Incorrect boundary update causing skipped candidates",
                    "Using immutable strings",
                    "Choosing BFS over DFS",
                    "Using too many helper classes",
                ],
                "correct_option_index": 0,
                "explanation": "Two-pointer bugs often stem from failing to update pointers correctly at the edges or skipping middle elements.",
            },
            {
                "text": "Given memory constraints, when is an array preferred over a linked structure?",
                "options": [
                    "When cache locality and compact storage are important",
                    "When constant-time middle insertion is required",
                    "When nodes must be frequently spliced",
                    "When unknown growth requires no resizing strategy",
                ],
                "correct_option_index": 0,
                "explanation": "Arrays use contiguous memory, providing better CPU cache locality and lower overhead than linked lists with pointers.",
            },
        ]
    elif "linked list" in lower or "linkedlist" in lower:
        questions = [
            {
                "text": "Which operation is typically O(1) in a singly linked list when a node reference is already known?",
                "options": [
                    "Insertion after that node",
                    "Random indexed access",
                    "Finding tail without tail pointer",
                    "Binary search",
                ],
                "correct_option_index": 0,
                "explanation": "Inserting after a known node only requires updating two pointers, which is a constant time operation.",
            },
            {
                "text": "Why does linked list traversal often underperform arrays in practice?",
                "options": [
                    "Poor cache locality from pointer chasing",
                    "Asymptotically slower insertion at head",
                    "Inability to represent dynamic data",
                    "Mandatory recursion in traversal",
                ],
                "correct_option_index": 0,
                "explanation": "Linked list nodes can be scattered in memory, causing frequent cache misses during traversal compared to contiguous arrays.",
            },
            {
                "text": "Which technique detects a cycle in O(n) time and O(1) space?",
                "options": [
                    "Floyd slow/fast pointers",
                    "Merge sort",
                    "Bucket hashing with fixed buckets",
                    "Binary lifting",
                ],
                "correct_option_index": 0,
                "explanation": "Floyd's algorithm uses two pointers at different speeds to detect cycles without needing extra storage for visited nodes.",
            },
            {
                "text": "In reversing a singly linked list iteratively, which pointers are essential each step?",
                "options": [
                    "prev, curr, next",
                    "left, right, mid",
                    "head, tail only",
                    "parent, child",
                ],
                "correct_option_index": 0,
                "explanation": "Reversing requires tracking the previous node to link to, the current node, and the next node to continue traversal.",
            },
            {
                "text": "What is a common pitfall while deleting a node in a singly linked list?",
                "options": [
                    "Losing reference to the next node before relinking",
                    "Using too much stack memory",
                    "Performing stable partition",
                    "Sorting before deletion",
                ],
                "correct_option_index": 0,
                "explanation": "One must store a reference to the 'next' node before breaking the current link to avoid losing the rest of the list.",
            },
        ]
    else:
        questions = [
            {
                "text": f"Which statement best captures the key goal when applying {t} to solve a problem?",
                "options": [
                    "Balance correctness, efficiency, and edge-case safety",
                    "Maximize code length for readability",
                    "Prefer brute-force regardless of constraints",
                    "Avoid testing to reduce runtime overhead",
                ],
                "correct_option_index": 0,
                "explanation": f"Solving problems with {t} requires a balanced approach that ensures the code is correct, fast enough, and handles edge cases.",
            },
            {
                "text": f"A solution for {t} passes simple tests but fails hidden edge cases. What is the best next step?",
                "options": [
                    "Design targeted edge-case tests from constraints",
                    "Only rename variables for clarity",
                    "Increase recursion depth blindly",
                    "Replace all loops with recursion",
                ],
                "correct_option_index": 0,
                "explanation": "Edge cases often reveal fundamental logic flaws; designing specific tests helps identify and fix these systematic issues.",
            },
            {
                "text": f"When comparing two approaches for {t}, which criterion should be prioritized first?",
                "options": [
                    "Worst-case time and space under problem constraints",
                    "Number of helper functions",
                    "Length of variable names",
                    "Whether it uses object-oriented syntax",
                ],
                "correct_option_index": 0,
                "explanation": "In technical systems, the asymptotic performance (time/space) is usually the most critical factor for scalability.",
            },
            {
                "text": f"Which practice most improves confidence in a {t} implementation before submission?",
                "options": [
                    "Manual dry-runs on boundary and adversarial inputs",
                    "Running only one happy-path sample",
                    "Ignoring complexity analysis",
                    "Avoiding assertions in local tests",
                ],
                "correct_option_index": 0,
                "explanation": "Manual tracing on boundary conditions helps catch off-by-one errors and other common logic bugs.",
            },
            {
                "text": f"A {t} algorithm is correct but too slow. What optimization direction is most appropriate?",
                "options": [
                    "Reduce repeated work with better data structures or preprocessing",
                    "Add more print statements for profiling",
                    "Increase input size to average out runtime",
                    "Convert all integers to strings",
                ],
                "correct_option_index": 0,
                "explanation": "Optimization for speed usually involves finding ways to avoid redundant calculations, often by using alternative data structures.",
            },
        ]

    return questions[:num_questions]
