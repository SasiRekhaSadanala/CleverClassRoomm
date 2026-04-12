import os
import json
import re
import google.generativeai as genai
from typing import Any

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
        "abs": abs, "all": all, "any": any, "bool": bool, "dict": dict,
        "enumerate": enumerate, "float": float, "int": int, "len": len,
        "list": list, "map": map, "max": max, "min": min, "range": range,
        "set": set, "sorted": sorted, "str": str, "sum": sum, "tuple": tuple, "zip": zip,
    }

def _evaluate_with_test_cases(code: str, test_cases: list) -> dict | None:
    """Performs deterministic test case execution if possible."""
    if not test_cases:
        return None

    function_name = _extract_function_name(code)
    if not function_name:
        return None

    globals_ns: dict[str, Any] = {"__builtins__": _safe_builtins()}
    locals_ns: dict[str, Any] = {}
    try:
        exec(code, globals_ns, locals_ns)
    except Exception:
        return None # Fallback to LLM if execution fails

    func = locals_ns.get(function_name) or globals_ns.get(function_name)
    if not callable(func):
        return None

    passed = 0
    total = len(test_cases)
    for case in test_cases:
        args = case.get("args", case.get("input", []))
        expected = case.get("expected_output", case.get("expected"))
        if not isinstance(args, (list, tuple)):
            args = [args]
        try:
            actual = func(*args)
            if _normalize(actual) == _normalize(expected):
                passed += 1
        except Exception:
            pass

    return {
        "score": round((passed / total) * 100, 1) if total > 0 else 0,
        "is_test_based": True,
        "passed": passed,
        "total": total
    }

async def grade_code_submission(description: str, code: str, test_cases: list) -> dict:
    if not GOOGLE_API_KEY:
        return {"score": 50, "feedback": "AI Not Configured. Defaulting to 50."}

    # Optional: Run deterministic tests to help the AI
    test_results = _evaluate_with_test_cases(code, test_cases)
    results_str = ""
    if test_results:
        results_str = f"PRE-EVALUATION RESULTS: Code passed {test_results['passed']}/{test_results['total']} test cases."

    prompt = f"""
You are an expert AI software engineering instructor grading a student's coding assignment.
You must use a WEIGHTED SCORING MODEL to ensure fairness.

Assignment Task: {description}
Student's Code:
---
{code}
---
Test Cases/Requirements: {json.dumps(test_cases)}
{results_str}

Your task is to evaluate the code based on these FOUR categories:

1. Approach (40%): Correctness of logic, algorithm choice, and problem-solving strategy.
2. Readability (20%): Code style, variable naming, and helpful comments.
3. Structure (20%): Modularity, use of functions/classes, and organization.
4. Effort (20%): The visible attempt, complexity of code written, and completeness.

SCORING RULE: 
- If the code solves the problem partially but is well-structured and shows high effort, the student should still receive a good grade (e.g. 60-70+) even if it doesn't pass all tests. 
- Never give a 0 if there is any relevant code. 
- Reward "Effort" points for any substantial logic written.

Return ONLY a valid JSON object:
{{
  "score": <calculated_weighted_average_0_100>,
  "breakdown": {{
    "approach": <0-100>,
    "readability": <0-100>,
    "structure": <0-100>,
    "effort": <0-100>
  }},
  "feedback": "Detailed explanation mentioning why they got their scores in each category...",
  "concepts_identified": ["concept1", "concept2"],
  "complexity": "e.g. O(N)"
}}
"""

    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        # Using gemini-flash-latest which was verified to work on this API key
        model = genai.GenerativeModel(
            model_name='gemini-flash-latest',
        )
        
        # Call generate_content (async version)
        response = await model.generate_content_async(prompt)
        result_text = response.text.strip()

        # Clean JSON if wrapped in markdown
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0]
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0]
        
        parsed = json.loads(result_text.strip())
        
        # Ensure feedback includes the explicit breakdown
        if "breakdown" in parsed:
            b = parsed["breakdown"]
            breakdown_text = f"\n\n--- Evaluation Breakdown ---\n• Approach: {b.get('approach')}/100\n• Readability: {b.get('readability')}/100\n• Structure: {b.get('structure')}/100\n• Effort: {b.get('effort')}/100"
            parsed["feedback"] += breakdown_text
            
        print(f"SUCCESS: Native Code Grader generated score {parsed.get('score')}")
        return parsed

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Code Grader Native call failed: {e}")
        return {
            "score": 60.0,
            "feedback": "AI grading failed due to connectivity issues. Generic effort score applied.",
            "concepts_identified": []
        }
