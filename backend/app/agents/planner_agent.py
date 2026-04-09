import os
import asyncio
import time
import json
from typing import List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GOOGLE_API_KEYS = os.getenv("GOOGLE_API_KEYS", "")
_KEY_COOLDOWN_UNTIL: dict[str, float] = {}

short_term_prompt = PromptTemplate.from_template(
    """
You are an expert AI Learning Strategist specialized in 'The 7-Day Sprint'. 
Your goal is to create a high-intensity, daily study schedule for a student to master a specific subject or topic in exactly one week.

Subject: {subject}
Goal: {goal}
Learning Style: {style}
Progress Context: {progress_context}

You MUST personalize the plan from the Progress Context.
Rules:
- If readiness_band is beginner: smaller daily workload, more fundamentals and guided drills.
- If readiness_band is intermediate: balanced fundamentals + timed problem solving.
- If readiness_band is advanced: fewer basics, more challenge tasks and synthesis.
- Prioritize weak_topics with higher time allocation.
- Use strong_topics as quick warmups, not the main workload.
- Include measurable daily checkpoints tied to current performance.

Structure your response in Markdown:
1. **Overview**: A brief motivation and summary.
2. **Daily Breakdown (Day 1-7)**:
   - Specific tasks for the morning, afternoon, and evening.
   - Core concepts to focus on.
   - A 'Checkpoint Challenge' for each day.
3. **Completion Criteria**: How the student knows they have succeeded.

Use a professional, encouraging, and highly technical tone. Avoid emojis.
Keep the response concise (about 350-500 words).
"""
)

long_term_prompt = PromptTemplate.from_template(
    """
You are an expert AI Curriculum Architect.
Your goal is to create a strategic 4-12 week roadmap for a student to achieve deep mastery or professional proficiency in a broad subject area.

Subject: {subject}
Goal: {goal}
Learning Style: {style}
Progress Context: {progress_context}

You MUST personalize the roadmap from the Progress Context.
Rules:
- Tune weekly intensity by readiness_band.
- Build remediation cycles around weak_topics first.
- Use recent_quiz_trend and avg scores to decide pacing (faster if improving, slower if declining).
- Include explicit weekly KPIs the student can track.

Structure your response in Markdown:
1. **The Roadmap Phase (Milestones)**: Divide the duration into 4 key phases (e.g., Fundamentals, Deep Dive, Projects, Mastery).
2. **Weekly Objectives**: High-level goals for each week.
3. **Resource Strategy**: How to find and use high-quality materials.
4. **Final Mastery Project**: A description of a project to prove competence.

Use a strategic, high-level, and authoritative tone. Avoid emojis.
Keep the response concise (about 500-700 words).
"""
)


async def _invoke_chain_with_timeout(chain, payload: dict, timeout_seconds: int = 30):
    # Some provider SDK calls can still block; run in a worker thread so timeout remains effective.
    return await asyncio.wait_for(
        asyncio.to_thread(chain.invoke, payload),
        timeout=timeout_seconds,
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


def _fallback_short_term(subject: str, goal: str, style: str, progress_context: str) -> str:
    return (
        f"## 7-Day Sprint Plan (Fallback)\n\n"
        f"**Subject:** {subject}\n"
        f"**Goal:** {goal}\n"
        f"**Style:** {style}\n"
        f"**Progress Context:** {progress_context}\n\n"
        "### Day 1-2\n"
        "- Review fundamentals and identify weak topics.\n"
        "- Solve 5 targeted practice problems per topic.\n\n"
        "### Day 3-4\n"
        "- Do intermediate exercises and timed drills.\n"
        "- Write concise notes for errors and fixes.\n\n"
        "### Day 5-6\n"
        "- Attempt mixed-topic mock tasks.\n"
        "- Revisit weakest concepts from mistakes.\n\n"
        "### Day 7\n"
        "- Final self-test and one mini-project.\n"
        "- Summarize learnings and define next 7-day goals.\n\n"
        "### Completion Criteria\n"
        "- At least 80% accuracy on mixed-topic practice.\n"
        "- Can explain core concepts and tradeoffs clearly."
    )


def _parse_progress_context(progress_context: str) -> dict:
    try:
        parsed = json.loads(progress_context)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass
    return {}


def _fallback_long_term(subject: str, goal: str, style: str, progress_context: str) -> str:
    snapshot = _parse_progress_context(progress_context)
    student_name = snapshot.get("student_name", "Student")
    readiness = snapshot.get("readiness_band", "intermediate")
    overall_mastery = snapshot.get("overall_mastery", 50.0)
    weak_topics = snapshot.get("weak_topics", []) or ["core fundamentals"]
    strong_topics = snapshot.get("strong_topics", []) or ["problem decomposition"]
    quiz_avg = snapshot.get("avg_quiz_score")
    assignment_avg = snapshot.get("avg_assignment_score")

    # Choose effort and pacing by readiness.
    if readiness == "beginner":
        weekly_hours = "6-8"
        problems_per_week = "12-16"
        checkpoint_target = "65%"
    elif readiness == "advanced":
        weekly_hours = "10-12"
        problems_per_week = "25-35"
        checkpoint_target = "85%"
    else:
        weekly_hours = "8-10"
        problems_per_week = "18-24"
        checkpoint_target = "75%"

    primary_weak = weak_topics[0]
    secondary_weak = weak_topics[1] if len(weak_topics) > 1 else weak_topics[0]
    strength_anchor = strong_topics[0]

    return (
        f"## 8-Week Performance-Driven Roadmap\n\n"
        f"**Subject:** {subject}\n"
        f"**Goal:** {goal}\n"
        f"**Student:** {student_name}\n"
        f"**Style:** {style}\n"
        f"**Current Mastery:** {overall_mastery}% ({readiness})\n"
        f"**Weak Topics to Prioritize:** {', '.join(weak_topics)}\n"
        f"**Strong Topics to Leverage:** {', '.join(strong_topics)}\n"
        f"**Baseline Scores:** Quiz Avg={quiz_avg if quiz_avg is not None else 'N/A'} | Assignment Avg={assignment_avg if assignment_avg is not None else 'N/A'}\n\n"
        "### Weekly Operating Rules\n"
        f"- Time Budget: **{weekly_hours} hours/week**\n"
        f"- Problem Volume: **{problems_per_week} problems/week**\n"
        f"- Weekly Checkpoint Target: **{checkpoint_target}**\n"
        f"- 70% effort on weak topics, 20% mixed practice, 10% strength-anchor ({strength_anchor}) warmups\n\n"
        "### Week-by-Week Plan\n"
        f"**Week 1 - Diagnostic and Repair ({primary_weak})**\n"
        "- Rebuild core patterns and edge cases for the weakest topic.\n"
        "- Complete 2 timed drills and 1 retrospective notebook of mistakes.\n"
        "- KPI: >=70% on end-of-week mini assessment.\n\n"
        f"**Week 2 - Reinforcement ({primary_weak} + {secondary_weak})**\n"
        "- Alternate easy/medium sets, then do one mixed timed set.\n"
        "- Add 1 implementation exercise from scratch without references.\n"
        "- KPI: reduce repeated mistake types by at least 40%.\n\n"
        f"**Week 3 - Pattern Transfer ({secondary_weak})**\n"
        "- Solve variant problems that force adaptation of learned patterns.\n"
        "- Write complexity notes for each solution and compare alternatives.\n"
        "- KPI: at least 3 correct medium problems in one sitting.\n\n"
        "**Week 4 - Midpoint Evaluation**\n"
        "- Full mixed-topic quiz and one coding assignment under time limit.\n"
        "- Analyze wrong answers by root cause (logic, edge case, complexity).\n"
        "- KPI: midpoint score >= checkpoint target.\n\n"
        "**Week 5 - Applied Integration**\n"
        "- Combine two topic families in each practice block.\n"
        "- Build one mini-project module focused on algorithm selection.\n"
        "- KPI: successful completion with documented complexity tradeoffs.\n\n"
        "**Week 6 - Speed and Reliability**\n"
        "- Timed rounds with strict review loop (attempt -> review -> patch).\n"
        "- Emphasize correctness under pressure and clean code structure.\n"
        "- KPI: >=80% pass rate on timed sets.\n\n"
        "**Week 7 - Capstone Build**\n"
        "- Develop end-to-end DSA-based capstone feature (problem, solution, tests).\n"
        "- Include test coverage for edge cases and failure modes.\n"
        "- KPI: capstone passes all defined tests.\n\n"
        "**Week 8 - Final Mastery Check**\n"
        "- Run final benchmark quiz + assignment simulation.\n"
        "- Produce a personal playbook: strongest patterns, weak triggers, fix strategy.\n"
        "- KPI: final score >= midpoint + 10 percentage points.\n\n"
        "### Adaptive Rule\n"
        "- If weekly KPI is missed: repeat the same topic block next week with reduced scope and extra review.\n"
        "- If weekly KPI is exceeded by >10 points: increase medium/hard ratio and reduce fundamentals block."
    )

async def create_short_term_plan(
    subject: str,
    goal: str,
    style: str = "Balanced",
    progress_context: str = "No prior performance data available.",
) -> str:
    """Generates a high-intensity 7-day study plan."""
    keys = _available_keys()
    if not keys:
        return _fallback_short_term(subject, goal, style, progress_context)

    for key in keys:
        try:
            llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash",
                temperature=0.4,
                max_output_tokens=900,
                max_retries=0,
                google_api_key=key,
            )
            chain = short_term_prompt | llm | StrOutputParser()
            result = await _invoke_chain_with_timeout(
                chain,
                {
                    "subject": subject,
                    "goal": goal,
                    "style": style,
                    "progress_context": progress_context,
                },
                timeout_seconds=20,
            )
            return result
        except asyncio.TimeoutError:
            _cooldown_key(key, 180)
        except Exception as e:
            message = str(e).lower()
            if "quota" in message or "resourceexhausted" in message or "429" in message:
                _cooldown_key(key, 900)
            else:
                _cooldown_key(key, 300)

    return _fallback_short_term(subject, goal, style, progress_context)

async def create_long_term_plan(
    subject: str,
    goal: str,
    style: str = "Balanced",
    progress_context: str = "No prior performance data available.",
) -> str:
    """Generates a multi-week roadmap for deep mastery."""
    keys = _available_keys()
    if not keys:
        return _fallback_long_term(subject, goal, style, progress_context)

    for key in keys:
        try:
            llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash",
                temperature=0.3,
                max_output_tokens=1200,
                max_retries=0,
                google_api_key=key,
            )
            chain = long_term_prompt | llm | StrOutputParser()
            result = await _invoke_chain_with_timeout(
                chain,
                {
                    "subject": subject,
                    "goal": goal,
                    "style": style,
                    "progress_context": progress_context,
                },
                timeout_seconds=25,
            )
            return result
        except asyncio.TimeoutError:
            _cooldown_key(key, 180)
        except Exception as e:
            message = str(e).lower()
            if "quota" in message or "resourceexhausted" in message or "429" in message:
                _cooldown_key(key, 900)
            else:
                _cooldown_key(key, 300)

    return _fallback_long_term(subject, goal, style, progress_context)
