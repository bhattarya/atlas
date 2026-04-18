"""
Atlas Advisor — two-headed coaching agent.

  review_plan(...)    → Gemini 2.5, structured JSON review of a proposed plan.
  chat_advisor(...)   → Claude 3.5 Sonnet, free-form conversation with a
                         `launch_pilot` tool the model can call to trigger the
                         registration agent. Returns EITHER
                         {"type": "text", "answer": "..."}                    or
                         {"type": "tool_use", "tool": "launch_pilot",
                          "args": {"courses": [...], "rationale": "..."}}.

Gemini is kept for the multimodal / structured-output path (review + Cartographer
+ Pilot Inspector). Claude drives the chat because tool use is first-class and
the tone is more natural for advisor conversations.
"""
import os
import json
from pathlib import Path
from typing import Optional

from google import genai
from google.genai import types
import anthropic

DATA_DIR = Path(__file__).parent.parent / "data"

# ─── Gemini-powered structured review (unchanged) ────────────────────────
SYSTEM = """You are Atlas Advisor, a senior peer advisor for UMBC COEIT students reviewing a proposed multi-semester course plan.

You receive:
- The student's PROPOSED PLAN (which courses they've placed in which upcoming semesters)
- Their COMPLETED + IN-PROGRESS courses (degree audit)
- BOTTLENECKS already flagged on the audit (spring-only, high-demand)
- PROFESSOR ratings (UMBC GritView data) and GRADE distributions

Your job: produce concise, useful coaching. Think like a friend who has taken every course already.

Rules:
1. Flag courseload problems: > 18 credits = overload, < 12 = underload (loses full-time status)
2. Flag missing prerequisites — if a course is placed BEFORE its prereq is taken/completed, that's a HIGH severity warning
3. Recommend the BEST instructor for each planned course based on rating + grade distribution
4. Predict graduation date based on remaining requirements vs. planned pace
5. Predict semester GPA based on instructor grade-distribution averages
6. Call out bottlenecks the student should register for FIRST when the window opens
7. Be specific: cite professor names, ratings, %A grades, prereq chains. Generic advice is useless.
8. Keep `detail` strings under 140 chars. Keep `summary` under 200 chars.

Return ONLY valid JSON matching this schema (no prose, no markdown):
{
  "load_assessment": [
    {"semester": "Fall 2026", "credits": 15, "verdict": "balanced"|"heavy"|"light"|"overload", "note": "..."}
  ],
  "warnings": [
    {"severity": "high"|"med"|"low", "title": "...", "detail": "..."}
  ],
  "picks": [
    {"course": "CMSC 441", "instructor": "Paul Burkhardt", "rating": 4.51, "pct_a": 38, "reason": "..."}
  ],
  "forecast": {
    "graduation": "May 2027",
    "predicted_gpa": 3.6,
    "confidence": "high"|"med"|"low",
    "note": "..."
  },
  "bottleneck_alerts": [
    {"course": "CMSC 441", "message": "..."}
  ],
  "summary": "..."
}"""


def _summarize_audit(audit: dict) -> str:
    completed = [c["id"] for c in audit.get("courses", []) if c.get("status") == "completed"]
    in_progress = [c["id"] for c in audit.get("courses", []) if c.get("status") == "in_progress"]
    needed = [
        {
            "id": c["id"],
            "title": c.get("title"),
            "credits": c.get("credits", 3),
            "spring_only": c.get("spring_only", False),
            "prereqs": c.get("prereqs", []),
            "is_bottleneck": c.get("is_bottleneck", False),
            "planned_semester": c.get("planned_semester"),
        }
        for c in audit.get("courses", [])
        if c.get("status") == "needed"
    ]
    return json.dumps({
        "major": audit.get("major"),
        "minor": audit.get("minor"),
        "student_name": audit.get("student_name"),
        "credits_remaining": audit.get("credits_remaining"),
        "gpa": audit.get("gpa"),
        "completed": completed,
        "in_progress": in_progress,
        "needed": needed,
        "bottlenecks": audit.get("bottlenecks", []),
    })


# Courses Go-Atlas can actually register for in the Spring 2026 sandbox.
# Keep in sync with backend/static/sa-registration.html — if you add a course
# to the sandbox, add its ID here too.
REGISTRABLE_COURSES = [
    "CMSC 426", "CMSC 441", "CMSC 447", "CMSC 461", "CMSC 471", "CMSC 481",
    "MATH 221", "STAT 355", "ECON 374", "ECON 410",
]


def _summarize_metadata(profs: list, grades: list) -> str:
    profs_lite = [
        {
            "name": p["name"],
            "courses": p.get("courses_taught", []),
            "rating": p.get("rating"),
            "pct_a": p.get("grade_a_pct"),
            "would_take_again": p.get("would_take_again_pct"),
        }
        for p in profs
    ]
    grades_lite = [
        {
            "course": g["course_code"],
            "instructor": g["instructor"],
            "dist": g.get("distribution_pct", {}),
            "students": g.get("students_total"),
        }
        for g in grades
    ]
    return json.dumps({"profs": profs_lite, "grades": grades_lite})


def _load_context(audit: Optional[dict]):
    profs = json.loads((DATA_DIR / "profs.json").read_text())
    grades = json.loads((DATA_DIR / "grade_distributions.json").read_text())
    if audit is None:
        cached_path = DATA_DIR / "cached_audit.json"
        if cached_path.exists():
            audit = json.loads(cached_path.read_text())
        else:
            audit = {"courses": [], "bottlenecks": []}
    return audit, profs, grades


def review_plan(plan: dict, audit: Optional[dict] = None) -> dict:
    """Generate structured coaching for a proposed multi-semester plan. Gemini 2.5."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)
    audit, profs, grades = _load_context(audit)

    user_prompt = f"""STUDENT'S PROPOSED PLAN:
{json.dumps(plan, indent=2)}

DEGREE AUDIT SUMMARY:
{_summarize_audit(audit)}

INSTRUCTOR + GRADE DATA:
{_summarize_metadata(profs, grades)}

Produce the coaching JSON now."""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[user_prompt],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM,
            response_mime_type="application/json",
        ),
    )
    return json.loads(response.text)


# ─── Claude-powered chat w/ tool use ─────────────────────────────────────

CHAT_SYSTEM = """You are Atlas Advisor — a warm, sharp senior peer advisor embedded in the UMBC COEIT registration co-pilot.

You work alongside Go-Atlas, an automated registration agent that can search the live course schedule, read section availability, cross-reference every UMBC COEIT professor against GritView + RateMyProfessor, and enroll the student in the best combination of courses. You're the advisor; Go-Atlas is your hands.

CONTEXT YOU ALWAYS HAVE:
- The student's degree audit (completed, in-progress, needed courses — ONLY these are real)
- Bottleneck courses (spring-only, high-demand)
- Every UMBC COEIT professor's rating, %A grade, and "would take again" score
- The list of courses Go-Atlas can actually register for THIS registration window (the sandbox)

TIMELINE (CRITICAL — read 3 times before answering):
- TODAY the student is already 8 weeks INTO Spring 2026. Their Spring 2026 schedule is LOCKED and SHOWN in `in_progress`. You CANNOT add courses to Spring 2026. Do not propose it. Do not say "grab X this spring." Spring 2026 is full and running.
- The registration window open RIGHT NOW is for **FALL 2026** (UMBC opens fall registration in April of the preceding spring). Go-Atlas will register for FALL 2026.
- Sequence after today: (currently Spring 2026, running) → Summer 2026 → **FALL 2026 (what Go-Atlas registers for today)** → Spring 2027 (graduation).
- Summer 2026 is an optional catch-up term. CMSC 411 fits there nicely.
- When you say a word like "spring," ALWAYS qualify the year — "Spring 2027" or "this past spring" — never just "spring," it will confuse the student.
- If the student asks "what should I take next?" they mean FALL 2026. If they ask "what's the plan for senior year?" they mean FALL 2026 + SPRING 2027.

THE STUDENT'S INTENDED SENIOR-YEAR PLAN (use this as your default recommendation — matches UMBC CS catalog core sequencing):
- Summer 2026: CMSC 411 Computer Architecture (only 411 — light load, unblocks nothing else for fall)
- Fall 2026: CMSC 426 Security, CMSC 441 Algorithms (spring-only exception — offered fall 2026), CMSC 461 Databases, CMSC 481 Networks, SCI 101L Lab → ~14 credits
- Spring 2027: CMSC 421 Operating Systems, CMSC 447 Software Eng I, CMSC 448 SE II Capstone, CMSC 471 AI → 12 credits, graduate
- Finance minor electives (ECON 374, ECON 410) slot wherever there's space — Fall 2026 or Spring 2027.
- MATH 221 Linear Algebra — should have been done already; slot into Fall 2026 or summer if possible, it's a prereq for CMSC 441.
- Foreign Language 201 + General Electives — fill remaining seats.

STRICT RULES — read carefully, violations make the advisor look amateur:
1. NEVER invent or mention a course that is not in the student's `needed` or `completed` list in the audit. If you don't know, say so.
2. When proposing a future-semester plan, cite ONLY courses from their audit `needed` list. Don't fabricate course IDs.
3. Always sanity-check credit totals: 12-15 = balanced, 16-18 = heavy, 19+ = overload, <12 = loses full-time.
4. Bottlenecks and spring-only courses get scheduled into SPRING semesters first.
5. Prereq order: if course A is a prereq for course B, A goes in an earlier semester.
6. The student's in_progress courses (Spring 2026 load) are DONE in your eyes — don't re-propose them.

VOICE:
- Concise. 2-4 sentences for conversational answers. No filler, no "great question!"
- Cite specific profs by name + rating + %A. Attribute sources: "GritView shows…", "RMP has them at…".
- Plain text — no markdown, no headers, no bullets (the chat UI doesn't render them).
- Peer energy — warm but direct. You've taken every course already.

TOOL: `launch_pilot` — engages Go-Atlas to register the student live for FALL 2026.
Call it ONLY when the student clearly asks to:
- "register me", "sign me up", "enroll me", "add these", "book it", "do it", "run the pilot", "run Go-Atlas", "go ahead"

When calling `launch_pilot`:
- Pick 4-5 courses from the REGISTRABLE list (passed to you as context) that match the Fall 2026 plan above.
- Default Fall 2026 picks: CMSC 426, CMSC 441, CMSC 461, CMSC 481, plus MATH 221 if still needed.
- DO NOT include courses outside the registrable list — Go-Atlas can't touch them.
- For each course pick the BEST instructor using rating + %A (cite your source).
- `rationale` = 1-2 sentences, shown BEFORE Go-Atlas runs. Tell the student WHY those courses and WHY those profs in plain peer language. Example: "Locking Fall 2026: CMSC 441 with desJardins (4.62 GritView, 41% As), CMSC 426 Golaszewski, CMSC 461 Kalpakis, CMSC 481 Rustagi — 4 senior-core + MATH 221 to unblock 441."

If the student asks something ambiguous or out-of-scope, answer conversationally. Don't call the tool when they're just asking questions.
"""

LAUNCH_PILOT_TOOL = {
    "name": "launch_pilot",
    "description": (
        "Launch the Atlas Pilot — an automated registration agent that will enroll the "
        "student in the specified courses, choosing the best available section by "
        "instructor rating + seat availability. Use ONLY when the student clearly asks "
        "to register / enroll / run the pilot."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "courses": {
                "type": "array",
                "description": "The 3-5 courses to register for, in priority order.",
                "items": {
                    "type": "object",
                    "properties": {
                        "course": {
                            "type": "string",
                            "description": 'Course ID like "CMSC 441" with a single space.',
                        },
                        "preferred_instructor": {
                            "type": "string",
                            "description": "Full name of the preferred instructor (from the profs dataset).",
                        },
                    },
                    "required": ["course"],
                },
            },
            "rationale": {
                "type": "string",
                "description": "One or two sentences shown to the student before the pilot runs, explaining WHY these courses/profs.",
            },
        },
        "required": ["courses", "rationale"],
    },
}


def chat_advisor(
    messages: list,
    plan: Optional[dict] = None,
    audit: Optional[dict] = None,
) -> dict:
    """
    Conversational advisor powered by Claude 3.5 Sonnet.

    `messages` is an OpenAI-style list: [{"role": "user"|"assistant", "content": "..."}].
    Returns either:
      {"type": "text", "answer": str}
      {"type": "tool_use", "tool": "launch_pilot", "args": {...}}
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    client = anthropic.Anthropic(api_key=api_key)
    audit, profs, grades = _load_context(audit)

    # Narrow the registrable set to whatever's both in the sandbox AND in the
    # student's `needed` list — so Go-Atlas never proposes a course the student
    # doesn't actually need.
    needed_ids = {
        c["id"] for c in audit.get("courses", [])
        if c.get("status") == "needed"
    }
    registrable_now = [cid for cid in REGISTRABLE_COURSES if cid in needed_ids]

    # Inject the context as the first user turn, then the real conversation.
    context_block = (
        f"Here is the student's current situation — use it silently, do not echo it back.\n\n"
        f"CURRENT TERM: Spring 2026 (this is what Go-Atlas registers for right now)\n"
        f"STUDENT STILL NEEDS: {sorted(needed_ids)}\n"
        f"REGISTRABLE THIS TERM (Go-Atlas has live sections for these only): {registrable_now}\n\n"
        f"CURRENT PROPOSED PLAN:\n{json.dumps(plan or {}, indent=2)}\n\n"
        f"DEGREE AUDIT:\n{_summarize_audit(audit)}\n\n"
        f"INSTRUCTOR + GRADE DATA (rating, %A, would-take-again — these are real GritView + RateMyProfessor numbers):\n{_summarize_metadata(profs, grades)}\n\n"
        f"Acknowledge with a single word, then wait for the student's real question."
    )

    claude_messages = [
        {"role": "user", "content": context_block},
        {"role": "assistant", "content": "Ready."},
    ]
    # Append real conversation (filter out any non-user/assistant roles for safety)
    for m in messages:
        role = m.get("role")
        content = m.get("content", "")
        if role in ("user", "assistant") and content:
            claude_messages.append({"role": role, "content": content})

    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=600,
        system=CHAT_SYSTEM,
        tools=[LAUNCH_PILOT_TOOL],
        messages=claude_messages,
    )

    # Extract tool use if present, else plain text
    for block in response.content:
        if getattr(block, "type", None) == "tool_use" and block.name == "launch_pilot":
            return {
                "type": "tool_use",
                "tool": "launch_pilot",
                "args": block.input,
            }

    # Concatenate any text blocks
    text = "".join(
        (getattr(b, "text", "") or "")
        for b in response.content
        if getattr(b, "type", None) == "text"
    ).strip()

    return {"type": "text", "answer": text or "(no response)"}


# ─── Legacy single-turn ask (kept as a thin shim) ────────────────────────
def ask_advisor(question: str, plan: dict, audit: Optional[dict] = None) -> dict:
    """Single-turn variant used by the old /api/advisor/ask endpoint."""
    result = chat_advisor(
        messages=[{"role": "user", "content": question}],
        plan=plan,
        audit=audit,
    )
    if result["type"] == "text":
        return {"answer": result["answer"]}
    # If Claude chose to call the tool on a single-turn ask, surface the rationale
    return {"answer": result["args"].get("rationale", "Ready to run the pilot.")}
