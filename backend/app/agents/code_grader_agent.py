import os
import json
import re
from typing import Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")


def _extract_function_name(code: str) -> str | None:
    match = re.search(r"def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(", code)
    return match.group(1) if match else None


def _normalize(value: Any) -> Any:
    if isinstance(value, float):
        return round(value, 6)
    if isinstance(value, list):
        return [_normalize(v) for v in value]
    if isinstance(value, tuple):
        return tuple(_normalize(v) for v in value)
    if isinstance(value, dict):
        return {k: _normalize(v) for k, v in value.items()}
    return value


def _safe_builtins() -> dict[str, Any]:
    return {
        "abs": abs,
        "all": all,
        "any": any,
        "bool": bool,
        "dict": dict,
        "enumerate": enumerate,
        "float": float,
        "int": int,
        "len": len,
        "list": list,
        "map": map,
        "max": max,
        "min": min,
        "range": range,
        "set": set,
        "sorted": sorted,
        "str": str,
        "sum": sum,
        "tuple": tuple,
        "zip": zip,
    }


def _evaluate_with_test_cases(code: str, test_cases: list) -> dict | None:
    if not test_cases:
        return None

    function_name = _extract_function_name(code)
    if not function_name:
        return {
            "score": 15.0,
            "feedback": "No Python function definition found. Add a function like `def solve(...):` that returns the required output.",
            "concepts_identified": [],
            "complexity": "Unknown",
        }

    globals_ns: dict[str, Any] = {"__builtins__": _safe_builtins()}
    locals_ns: dict[str, Any] = {}
    try:
        exec(code, globals_ns, locals_ns)
    except Exception as e:
        return {
            "score": 5.0,
            "feedback": f"Code has runtime/syntax errors during evaluation: {e}",
            "concepts_identified": [],
            "complexity": "Unknown",
        }

    func = locals_ns.get(function_name) or globals_ns.get(function_name)
    if not callable(func):
        return {
            "score": 10.0,
            "feedback": f"Function `{function_name}` was not callable after execution.",
            "concepts_identified": [],
            "complexity": "Unknown",
        }

    passed = 0
    total = len(test_cases)
    failed_details = []

    for idx, case in enumerate(test_cases):
        args = case.get("args", case.get("input", []))
        expected = case.get("expected_output", case.get("expected"))
        if not isinstance(args, (list, tuple)):
            args = [args]

        try:
            actual = func(*args)
            if _normalize(actual) == _normalize(expected):
                passed += 1
            else:
                failed_details.append(
                    f"Case {idx + 1}: expected={expected}, got={actual}"
                )
        except Exception as e:
            failed_details.append(f"Case {idx + 1}: runtime error: {e}")

    pass_rate = passed / total if total > 0 else 0
    score = round(pass_rate * 100, 1)

    complexity = "Unknown"
    if "for" in code and "for" in code[code.find("for") + 1:]:
        complexity = "Likely O(N^2) or worse"
    elif "for" in code or "while" in code:
        complexity = "Likely O(N)"
    else:
        complexity = "Likely O(1)"

    concepts = []
    keyword_map = {
        "dict": "hash map",
        "set": "set usage",
        "sort": "sorting",
        "recursion": "recursion",
        "while": "iteration",
        "for": "iteration",
    }
    for key, concept in keyword_map.items():
        if key in code:
            concepts.append(concept)

    summary = f"Passed {passed}/{total} test cases."
    if failed_details:
        summary += " Failing details: " + " | ".join(failed_details[:3])

    return {
        "score": score,
        "feedback": f"{summary} Estimated complexity: {complexity}.",
        "concepts_identified": concepts,
        "complexity": complexity,
    }

code_grader_prompt = PromptTemplate.from_template(
    """
You are an expert AI software engineering instructor grading a student's coding assignment.

Assignment Task: {assignment_description}
Student's Code:
---
{student_code}
---
Test Cases/Requirements: {test_cases}

Your task:
1. Evaluate the student's code for logical correctness, time/space complexity (efficiency), and code style.
2. PERFORM AN EXPLICIT BIG O ANALYSIS. Identify the Time Complexity of the student's solution.
3. Compare the student's complexity to the OPTIMAL complexity for this specific problem.
4. Provide a score from 0 to 100 based on this scale:
   - 95-100: Correct, clean, AND OPTIMAL time complexity.
   - 70-85: Correct and functional, but SUBOPTIMAL efficiency (e.g., O(N^2) when O(N) or O(N log N) is possible).
   - 50-69: Functional logic but has minor bugs or extremely poor efficiency/readability.
   - 0-49: Non-functional or completely off-track.
5. Extract key programming concepts the student demonstrated.
6. Provide constructive feedback that explicitly mentions the Time Complexity you identified.

Return ONLY a valid JSON object (no markdown fences):
{{
  "score": 85,
  "feedback": "Your solution is correct but has O(N^2) complexity. An O(N) solution using a Hash Map would be more efficient...",
  "concepts_identified": ["concept1", "concept2"],
  "complexity": "O(N^2)"
}}
"""
)

async def grade_code_submission(description: str, code: str, test_cases: list) -> dict:
    deterministic = _evaluate_with_test_cases(code, test_cases)
    if deterministic is not None:
        return deterministic

    if not GOOGLE_API_KEY:
        print("No GOOGLE_API_KEY and no test cases. Using structure-based fallback grader.")
        score = 20
        if "def " in code or "function " in code:
            score += 20
        if "return" in code:
            score += 20
        if len(code.strip()) > 80:
            score += 10
        if "for" in code or "while" in code:
            score += 10
        score = min(score, 70)

        return {
            "score": float(score),
            "feedback": "No test cases were provided for this assignment, so only basic code structure was evaluated. Add test cases for accurate correctness scoring.",
            "concepts_identified": ["Basic Syntax"] if score > 50 else []
        }

    try:
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            temperature=0.1,
            google_api_key=GOOGLE_API_KEY,
        )
        chain = code_grader_prompt | llm | StrOutputParser()
        result = await chain.ainvoke({
            "assignment_description": description, 
            "student_code": code,
            "test_cases": json.dumps(test_cases)
        })

        result = result.strip()
        if "```json" in result:
            result = result.split("```json")[1].split("```")[0]
        elif "```" in result:
            result = result.split("```")[1].split("```")[0]
        
        parsed = json.loads(result.strip())
        return parsed

    except Exception as e:
        print(f"Code Grader Gemini call failed: {e}. Fallback used.")
        return {
            "score": 60.0,
            "feedback": "AI grading failed due to connectivity issues. Basic evaluation applied.",
            "concepts_identified": []
        }
