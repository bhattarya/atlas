import os
import json
from pathlib import Path
from typing import Optional
from google import genai
from google.genai import types

DATA_DIR = Path(__file__).parent.parent / "data"

SYSTEM = """You are Cartographer, an AI degree-audit parser for UMBC COEIT students.

Given a degree audit PDF (and optionally an unofficial transcript), extract and return structured JSON describing the student's academic plan.

Rules:
1. Detect the student's major from the audit (CS, IS, CE, EE, etc.)
2. Detect any declared minors from the audit
3. If added_minor is specified, include it as an additional minor
4. For each course in the degree requirements, return its status: "completed", "in_progress", or "needed"
5. Flag spring_only courses (courses offered only in Spring semester)
6. Identify bottlenecks: courses that are spring_only AND needed AND have many dependents
7. Return prereqs as a list of course IDs

REFERENCE FACTS (always apply these regardless of what the audit says):
- CMSC 441 (Design & Analysis of Algorithms): Spring-only. High bottleneck — many upper-level courses depend on it.
- CMSC 447 (Software Engineering I): Fall-only.
- CMSC 448 (Software Engineering II / Capstone): Requires CMSC 447 completed first.
- CMSC 341 is a prerequisite for CMSC 421, CMSC 426, CMSC 441, CMSC 447, CMSC 461, CMSC 471, CMSC 481.
- IS 310 and IS 328 are prerequisites for all IS 400-level courses.
- Any course with fewer than 10 seats available at registration window opening is a bottleneck.
- Always set is_bottleneck: true for any course where spring_only is true AND status is "needed".

Return ONLY valid JSON matching this schema:
{
  "student_name": string,
  "major": string,
  "minor": string | null,
  "credits_remaining": number,
  "completed": number,
  "gpa": number | null,
  "bottlenecks": [string],
  "courses": [
    {
      "id": string,
      "name": string,
      "credits": number,
      "status": "completed" | "in_progress" | "needed",
      "prereqs": [string],
      "level": number,
      "spring_only": boolean,
      "is_bottleneck": boolean,
      "sections": [{"section": string, "days": string, "time": string, "seats": number}] | null
    }
  ]
}"""


def parse_audit(
    audit_bytes: bytes,
    transcript_bytes: Optional[bytes] = None,
    added_minor: Optional[str] = None,
) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)

    parts = [types.Part.from_bytes(data=audit_bytes, mime_type="application/pdf")]
    if transcript_bytes:
        parts.append(types.Part.from_bytes(data=transcript_bytes, mime_type="application/pdf"))

    prompt = "Parse this UMBC degree audit and return the structured JSON."

    if added_minor:
        minor_context = _load_minor_context(added_minor)
        if minor_context:
            prompt += minor_context

    parts.append(prompt)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=parts,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM,
            response_mime_type="application/json",
        ),
    )

    result = json.loads(response.text)
    return result


def amend_with_minor(cached_audit: dict, minor_name: Optional[str]) -> dict:
    """Add or remove minor courses from a cached audit result without re-calling Gemini."""
    result = dict(cached_audit)
    result["courses"] = list(cached_audit.get("courses", []))

    if not minor_name:
        result["minor"] = None
        result["courses"] = [c for c in result["courses"] if not c.get("_from_minor")]
        result["bottlenecks"] = [b for b in result.get("bottlenecks", [])
                                 if b not in [c["id"] for c in result["courses"] if c.get("_from_minor")]]
        return result

    minor_file = DATA_DIR / f"minor_{minor_name.lower()}.json"
    if not minor_file.exists():
        return result

    minor_data = json.loads(minor_file.read_text())
    existing_ids = {c["id"] for c in result["courses"]}
    new_bottlenecks = []

    for course in minor_data.get("required_courses", []):
        if course["code"] in existing_ids:
            continue
        code = course["code"]
        is_bottleneck = course.get("spring_only", False)
        level_digit = int(code.split(" ")[-1][0]) if " " in code else 1
        new_course = {
            "id": code,
            "name": course["title"],
            "credits": course["credits"],
            "status": "needed",
            "prereqs": course.get("prereqs", []),
            "level": level_digit + 4,  # push minor courses to right of CS/IS columns
            "spring_only": course.get("spring_only", False),
            "is_bottleneck": is_bottleneck,
            "sections": None,
            "_from_minor": True,
        }
        result["courses"].append(new_course)
        if is_bottleneck:
            new_bottlenecks.append(code)

    result["minor"] = minor_name
    result["bottlenecks"] = list(set(result.get("bottlenecks", []) + new_bottlenecks))
    return result


def _load_minor_context(minor_name: str) -> str:
    minor_file = DATA_DIR / f"minor_{minor_name.lower()}.json"
    if not minor_file.exists():
        return ""
    minor_data = json.loads(minor_file.read_text())
    req = [f"{c['code']} ({c['title']}, {c['credits']} cr)"
           for c in minor_data.get("required_courses", [])]
    return (
        f"\n\nThe student is also adding a {minor_name} minor. "
        f"Required courses: {', '.join(req)}. "
        f"Add these courses to the 'courses' array with status 'needed' if not already completed. "
        f"Flag spring_only courses as is_bottleneck: true."
    )
