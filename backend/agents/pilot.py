import os
import asyncio
import base64
from playwright.async_api import async_playwright

PILOT_SESSIONS: dict[str, dict] = {}

GOAL = (
    "Register for CMSC 441 Section 02. "
    "Search for CMSC 441, click Add on Section 02, "
    "stop at the Submit Registration button without clicking it."
)

SA_URL = "http://localhost:8000/static/sa-registration.html"


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

        PILOT_SESSIONS[session_id] = {"browser": browser, "page": page, "status": "running"}

        messages = [{"role": "user", "parts": [GOAL]}]

        for turn in range(10):
            screenshot = await page.screenshot()
            screenshot_b64 = base64.b64encode(screenshot).decode()

            messages.append({
                "role": "user",
                "parts": [
                    {"inline_data": {"mime_type": "image/png", "data": screenshot_b64}},
                    "What is the next action to take?",
                ],
            })

            tools = [
                types.Tool(
                    computer_use=types.ComputerUseTool(display_width=1280, display_height=800)
                )
            ]

            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=messages,
                config=types.GenerateContentConfig(tools=tools),
            )

            action = None
            for part in response.candidates[0].content.parts:
                if hasattr(part, "computer_use") and part.computer_use:
                    action = part.computer_use
                    break

            if action is None:
                await queue.put({"type": "error", "message": "No action returned from model"})
                break

            action_type = action.action if hasattr(action, "action") else str(action)

            if "submit" in str(action).lower() or turn >= 8:
                await queue.put({
                    "type": "waiting",
                    "description": "Pilot stopped at Submit Registration. Ready for your confirmation.",
                })
                PILOT_SESSIONS[session_id]["status"] = "waiting"
                return

            desc = _describe_action(action)
            await queue.put({"type": "action", "description": desc})

            await _execute_action(page, action)
            await asyncio.sleep(0.8)

            messages.append({"role": "model", "parts": [str(action)]})

        await queue.put({"type": "waiting", "description": "Pilot ready. Click Confirm to submit."})
        PILOT_SESSIONS[session_id]["status"] = "waiting"


async def confirm_session(session_id: str) -> dict:
    session = PILOT_SESSIONS.get(session_id)
    if not session:
        return {"error": "Session not found"}

    page = session["page"]
    try:
        submit_btn = await page.query_selector("button#submit-btn, button:has-text('Submit Registration')")
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


def _describe_action(action) -> str:
    t = getattr(action, "action", "")
    if t == "click":
        return f"Click at ({action.coordinate[0]}, {action.coordinate[1]})"
    if t == "type":
        return f"Type: {action.text!r}"
    if t == "screenshot":
        return "Take screenshot"
    if t == "scroll":
        return f"Scroll at ({action.coordinate[0]}, {action.coordinate[1]})"
    return f"Action: {t}"


async def _execute_action(page, action):
    t = getattr(action, "action", "")
    if t == "click":
        await page.mouse.click(action.coordinate[0], action.coordinate[1])
    elif t == "type":
        await page.keyboard.type(action.text)
    elif t == "scroll":
        await page.mouse.wheel(0, action.delta_y if hasattr(action, "delta_y") else 100)
    elif t == "key":
        await page.keyboard.press(action.key)
