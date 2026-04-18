import os
import json
from pathlib import Path
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
    transcript_bytes: bytes | None = None,
    added_minor: str | None = None,
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
        prompt += f" Include '{added_minor}' as an additional minor and add its required courses to the map."
    parts.append(prompt)

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=parts,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM,
            response_mime_type="application/json",
        ),
    )

    return json.loads(response.text)
