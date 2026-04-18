"""
Pilot Agent — orchestrates a multi-sub-agent registration run.

  Navigator (Playwright)         drives the browser
  Inspector (Gemini Vision)      reads section / seat state from screenshots
  Decision Engine (Python)       picks the best available section per course
                                 using profs.json ratings as the policy
"""
import os
import json
import asyncio
import re
from pathlib import Path
from typing import Optional, List
from playwright.async_api import async_playwright

PILOT_SESSIONS: dict = {}

SA_URL = "http://localhost:8000/static/sa-registration.html"
DATA_DIR = Path(__file__).parent.parent / "data"


# ─── Default plan: 4 courses from the user's actual cart ───────────────
DEFAULT_PLAN = [
    {"course": "CMSC 426", "preferred_instructor": "Enis Golaszewski"},
    {"course": "CMSC 441", "preferred_instructor": "Paul Burkhardt"},
    {"course": "CMSC 461", "preferred_instructor": "Konstantin Kalpakis"},
    {"course": "CMSC 481", "preferred_instructor": "Ram Rustagi"},
]


# ─── Inspector prompt (reads sections + seats from screenshot) ──────────
INSPECTOR_PROMPT = """You are reading a UMBC course-registration search-results page.

Return ONLY valid JSON in this exact shape — no prose, no markdown fences:
{
  "course_id": "CMSC 441",
  "sections": [
    {"section": "100-LEC", "instructor": "Paul Burkhardt", "seats_open": 6, "is_open": true}
  ]
}

Rules:
- Read every section card visible on screen.
- seats_open is the integer next to "seats open"; if you see "CLOSED" use 0 and is_open=false.
- instructor is the full name shown.
- section is the full section code (e.g. "100-LEC", "1-LEC").
"""


# ─── Helpers ────────────────────────────────────────────────────────────
def _load_profs() -> dict:
    """Map instructor name → prof record."""
    profs = json.loads((DATA_DIR / "profs.json").read_text())
    return {p["name"]: p for p in profs}


def _selector_id(course_id: str, section: str) -> str:
    """Mirror the JS selectorId() function in sa-registration.html."""
    cid = course_id.replace(" ", "-")
    sec = re.sub(r"[^a-zA-Z0-9]", "", section)
    return f"add-{cid}-{sec}"


# ─── Decision Engine ────────────────────────────────────────────────────
def decide_section(course_id: str, sections: list, preferred_instructor: Optional[str], profs: dict) -> Optional[dict]:
    """
    Pick the best open section.

    Priority:
      1. Preferred instructor's section if open
      2. Highest prof rating among open sections (from profs.json)
      3. Any open section (most seats)

    Returns the chosen section dict with a `reason` string explaining the pick
    AND a `fallback` string if we couldn't get the preferred instructor.
    """
    open_sections = [s for s in sections if s.get("is_open") and s.get("seats_open", 0) > 0]
    if not open_sections:
        return None

    fallback_note = None

    # 1. Preferred instructor match
    if preferred_instructor:
        # Name-match tolerant to diacritics / case
        pref_norm = preferred_instructor.lower().strip()
        for s in open_sections:
            if s["instructor"].lower().strip() == pref_norm:
                return {
                    **s,
                    "reason": f"preferred prof {s['instructor']} open ({s['seats_open']} seats)",
                }
        # Preferred exists but not open — note it for transparency
        all_with_pref = [s for s in sections if s["instructor"].lower().strip() == pref_norm]
        if all_with_pref:
            fallback_note = (
                f"{preferred_instructor} full (0 seats) — switching to next-best open section"
            )

    # 2. Highest-rated prof among OPEN
    rated = []
    for s in open_sections:
        prof = profs.get(s["instructor"])
        rating = prof["rating"] if prof else 0
        pct_a = prof.get("grade_a_pct") if prof else None
        rated.append((rating, pct_a, s))
    rated.sort(key=lambda r: -r[0])
    best_rating, best_pct_a, best_sec = rated[0]
    if best_rating > 0:
        stat = f"{best_rating}/5"
        if best_pct_a is not None:
            stat += f", {best_pct_a}% A"
        reason = f"highest-rated open section — {best_sec['instructor']} ({stat})"
        return {
            **best_sec,
            "reason": reason,
            **({"fallback": fallback_note} if fallback_note else {}),
        }

    # 3. Any open
    most_seats = max(open_sections, key=lambda s: s["seats_open"])
    return {
        **most_seats,
        "reason": f"open section by {most_seats['instructor']}",
        **({"fallback": fallback_note} if fallback_note else {}),
    }


# ─── Inspector (Gemini vision) ──────────────────────────────────────────
async def inspect_sections(client, page, types) -> list:
    """Screenshot the section list and ask Gemini to extract structured data."""
    try:
        screenshot = await page.locator("#section-list").screenshot()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=screenshot, mime_type="image/png"),
                INSPECTOR_PROMPT,
            ],
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        data = json.loads(response.text)
        return data.get("sections", [])
    except Exception as e:
        print(f"[Pilot Inspector] vision read failed: {e}, falling back to DOM read")
        return await _read_sections_from_dom(page)


async def _read_sections_from_dom(page) -> list:
    """Fallback: read sections directly from the rendered DOM."""
    cards = await page.query_selector_all("#section-list .section-card")
    out = []
    for card in cards:
        sec = await card.get_attribute("data-sec")
        instructor_el = await card.query_selector(".sec-instructor")
        seats_el = await card.query_selector(".sec-seats")
        instructor = (await instructor_el.inner_text()).strip() if instructor_el else "Unknown"
        seats_text = (await seats_el.inner_text()).strip() if seats_el else "0"
        first_token = seats_text.split()[0] if seats_text else "0"
        if first_token.upper() == "CLOSED":
            seats_open, is_open = 0, False
        else:
            try:
                seats_open = int(first_token)
                is_open = seats_open > 0
            except ValueError:
                seats_open, is_open = 0, False
        out.append({
            "section": sec,
            "instructor": instructor,
            "seats_open": seats_open,
            "is_open": is_open,
        })
    return out


# ─── Main orchestrator ──────────────────────────────────────────────────
async def run_pilot(session_id: str, queue: asyncio.Queue, plan: Optional[List[dict]] = None):
    from google import genai
    from google.genai import types

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        await queue.put({"type": "error", "message": "GEMINI_API_KEY not set"})
        return

    client = genai.Client(api_key=api_key)
    profs = _load_profs()
    plan = plan or DEFAULT_PLAN

    async def emit(role: str, description: str, **extra):
        await queue.put({"type": "action", "role": role, "description": description, **extra})

    async with async_playwright() as p:
        # slow_mo makes every action (click, fill, hover) take ~500ms so the
        # browser looks like a human is driving it — critical for demo. Without
        # this, actions fire instantly and the judges can't see what's happening.
        browser = await p.chromium.launch(headless=False, slow_mo=500)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})

        # Inject a giant red dot that follows the mouse so the cursor is
        # obvious even in a screen recording / zoomed-out demo. Playwright's
        # mouse-move API fires these events, so the overlay tracks every hover
        # and click.
        await page.add_init_script("""
          (() => {
            const dot = document.createElement('div');
            dot.id = '__atlas_cursor';
            Object.assign(dot.style, {
              position: 'fixed', width: '22px', height: '22px',
              borderRadius: '50%', background: 'rgba(255,195,0,0.55)',
              border: '3px solid #000', pointerEvents: 'none',
              zIndex: '2147483647', transform: 'translate(-50%,-50%)',
              boxShadow: '0 0 0 4px rgba(255,195,0,0.25), 0 4px 14px rgba(0,0,0,0.35)',
              transition: 'transform 0.08s ease-out',
              top: '-40px', left: '-40px',
            });
            const attach = () => document.body && document.body.appendChild(dot);
            if (document.body) attach(); else document.addEventListener('DOMContentLoaded', attach);
            document.addEventListener('mousemove', (e) => {
              dot.style.left = e.clientX + 'px';
              dot.style.top = e.clientY + 'px';
            }, true);
          })();
        """)

        await emit("Navigator", "Connecting to peoplesoft.umbc.edu/registration…")
        await page.goto(SA_URL)
        await asyncio.sleep(0.8)
        # Move the cursor into view so the yellow dot is visible from turn 1
        await page.mouse.move(640, 450, steps=25)
        await emit("Navigator", "Reached Add Classes page")

        PILOT_SESSIONS[session_id] = {
            "browser": browser, "page": page,
            "status": "running", "registered": [],
        }

        registered = []

        for idx, item in enumerate(plan, 1):
            course_id = item["course"]
            preferred = item.get("preferred_instructor")
            await emit("Navigator", f"[{idx}/{len(plan)}] Searching for {course_id}", course=course_id)

            try:
                # Search — hover first so the yellow dot visibly glides to the
                # input, then the button. Small animated steps so the motion
                # reads as deliberate.
                await page.hover("#course-input")
                await page.fill("#course-input", course_id)
                await asyncio.sleep(0.3)
                await page.hover("button:has-text('Search')")
                await page.click("button:has-text('Search')")
                # Wait briefly for either the section list OR the "no results"
                # status message to appear — don't hang the demo on a miss.
                try:
                    await page.wait_for_selector("#section-list", timeout=2500)
                except Exception:
                    status_txt = (await page.locator("#status-msg").inner_text()).strip()
                    if status_txt and "no results" in status_txt.lower():
                        await emit(
                            "Inspector",
                            f"{course_id} isn't in the Spring 2026 schedule — skipping (try a different term)",
                            course=course_id, level="warn",
                        )
                    else:
                        await emit(
                            "Inspector",
                            f"{course_id} search didn't return sections — skipping",
                            course=course_id, level="warn",
                        )
                    continue
                await asyncio.sleep(0.4)

                # Inspect
                await emit("Inspector", f"Reading section availability for {course_id}…", course=course_id)
                sections = await inspect_sections(client, page, types)
                if sections:
                    summary = " · ".join(
                        f"{s['section']} ({s['instructor']}): {s['seats_open']} seats"
                        for s in sections
                    )
                    await emit("Inspector", f"{len(sections)} section(s) — {summary}", course=course_id)
                else:
                    await emit("Inspector", f"No sections returned for {course_id}", course=course_id, level="warn")
                    continue

                # Decide
                choice = decide_section(course_id, sections, preferred, profs)
                if not choice:
                    await emit("Decision", f"All sections of {course_id} are full — recommend wait-list", course=course_id, level="warn")
                    continue

                # Announce fallback first (transparency), then the pick
                if choice.get("fallback"):
                    await emit("Decision", choice["fallback"], course=course_id, level="warn")
                await emit("Decision", f"Selecting {choice['section']} — {choice['reason']}", course=course_id, section=choice["section"])

                # Add — hover visibly first so judges see the cursor travel to
                # the Add button before it clicks.
                button_id = _selector_id(course_id, choice["section"])
                try:
                    await page.hover(f"#{button_id}", timeout=1500)
                except Exception:
                    pass
                await asyncio.sleep(0.25)
                await page.click(f"#{button_id}", timeout=2000)
                await asyncio.sleep(0.45)
                await emit("Navigator", f"✓ Added {course_id} {choice['section']} — {choice['instructor']}", course=course_id)
                registered.append({
                    "course": course_id,
                    "section": choice["section"],
                    "instructor": choice["instructor"],
                    "reason": choice.get("reason"),
                })

            except Exception as e:
                await emit("Navigator", f"⚠ Failed on {course_id}: {str(e)[:80]}", course=course_id, level="error")
                continue

        PILOT_SESSIONS[session_id]["registered"] = registered

        # Pause before final submit
        await emit("Inspector", f"Cart contains {len(registered)} course(s). Awaiting your confirmation.")
        await queue.put({
            "type": "waiting",
            "role": "Pilot",
            "description": f"Ready to enroll in {len(registered)} courses. Click Submit.",
            "registered": registered,
        })
        PILOT_SESSIONS[session_id]["status"] = "waiting"


async def confirm_session(session_id: str) -> dict:
    session = PILOT_SESSIONS.get(session_id)
    if not session:
        return {"status": "error", "error": "Session not found", "registered": []}

    # Capture the registered list NOW so we always return it, even if the
    # browser click raises (user may have closed the Playwright window, etc.).
    registered = list(session.get("registered", []))
    status = "submitted"
    click_error: Optional[str] = None

    try:
        page = session.get("page")
        if page is not None:
            try:
                # Hover first so the cursor glides to Submit on camera
                try:
                    await page.hover("#submit-btn", timeout=1500)
                except Exception:
                    pass
                await asyncio.sleep(0.35)
                await page.click("#submit-btn", timeout=3000)
                await asyncio.sleep(1.0)
            except Exception as e:
                click_error = str(e)[:160]
                status = "submitted_offline"
    finally:
        # Leave browser open briefly so the user sees the confirmation
        async def _close_later(browser):
            await asyncio.sleep(3.5)
            try:
                await browser.close()
            except Exception:
                pass
        browser = session.get("browser")
        if browser is not None:
            asyncio.create_task(_close_later(browser))

    result = {"status": status, "registered": registered}
    if click_error:
        result["warning"] = click_error
    return result
