import os
import asyncio
import json
import base64
from playwright.async_api import async_playwright

PILOT_SESSIONS: dict = {}

SA_URL = "http://localhost:8000/static/sa-registration.html"

# Scripted steps — selectors are known since we control the page.
# Gemini vision is used between steps to generate narration for the SSE stream.
STEPS = [
    {"action": "fill",   "selector": "#course-input", "value": "CMSC 441"},
    {"action": "click",  "selector": "button:has-text('Search')"},
    {"action": "wait",   "ms": 900},
    {"action": "click",  "selector": "#add-CMSC-441-02"},
    {"action": "wait",   "ms": 600},
    {"action": "stop"},
]

NARRATE_PROMPT = """You are narrating an AI registration agent's actions for a student watching in real time.
Look at this screenshot of a UMBC course registration page and write ONE short sentence (max 12 words)
describing what the agent just did or what you observe. Be specific — mention course names, buttons, seat counts.
No intro, no punctuation at the end, just the sentence."""


async def run_pilot(session_id: str, queue: asyncio.Queue):
    from google import genai
    from google.genai import types

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        await queue.put({"type": "error", "message": "GEMINI_API_KEY not set"})
        return

    client = genai.Client(api_key=api_key)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.goto(SA_URL)
        await asyncio.sleep(0.8)

        PILOT_SESSIONS[session_id] = {"browser": browser, "page": page, "status": "running"}

        for step in STEPS:
            try:
                if step["action"] == "fill":
                    await page.fill(step["selector"], step["value"])

                elif step["action"] == "click":
                    await page.click(step["selector"])

                elif step["action"] == "wait":
                    await asyncio.sleep(step["ms"] / 1000)

                elif step["action"] == "stop":
                    narration = await _narrate(client, page, types)
                    await queue.put({"type": "waiting", "description": narration})
                    PILOT_SESSIONS[session_id]["status"] = "waiting"
                    return

            except Exception as e:
                await queue.put({"type": "error", "message": f"Step failed ({step['action']}): {e}"})
                return

            # Narrate every non-wait step
            if step["action"] not in ("wait",):
                narration = await _narrate(client, page, types)
                await queue.put({"type": "action", "description": narration})

            await asyncio.sleep(0.3)

        await queue.put({"type": "waiting", "description": "Pilot complete. Confirm to submit."})
        PILOT_SESSIONS[session_id]["status"] = "waiting"


async def _narrate(client, page, types) -> str:
    try:
        screenshot = await page.screenshot()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=screenshot, mime_type="image/png"),
                NARRATE_PROMPT,
            ],
        )
        return response.text.strip().strip('"').strip("'")
    except Exception:
        return "Agent acting on registration page…"


async def confirm_session(session_id: str) -> dict:
    session = PILOT_SESSIONS.get(session_id)
    if not session:
        return {"error": "Session not found"}

    page = session["page"]
    try:
        submit_btn = await page.query_selector("#submit-btn")
        if submit_btn:
            await submit_btn.click()
        return {"status": "submitted"}
    except Exception as e:
        return {"error": str(e)}
    finally:
        try:
            await session["browser"].close()
        except Exception:
            pass
