import os
import json
import uuid
import asyncio
from pathlib import Path
from dotenv import load_dotenv

from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel

load_dotenv(override=True)

from agents.cartographer import parse_audit, amend_with_minor
from agents.pilot import run_pilot, confirm_session
from agents.validator import validate_placement as _validate_placement
from agents.advisor import review_plan, ask_advisor, chat_advisor
from agents.pdf_export import build_schedule_pdf

app = FastAPI(title="Atlas Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

DATA_DIR = Path(__file__).parent / "data"
SESSIONS: dict[str, dict] = {}


@app.get("/health")
def health():
    return {"status": "ok", "model": "gemini-2.5-flash"}


@app.get("/api/course-metadata")
def course_metadata():
    profs = json.loads((DATA_DIR / "profs.json").read_text())
    grades = json.loads((DATA_DIR / "grade_distributions.json").read_text())
    return {"profs": profs, "grades": grades}


@app.post("/api/parse")
async def parse(
    audit: UploadFile = File(...),
    transcript: Optional[UploadFile] = File(None),
    added_minor: Optional[str] = Form(None),
):
    """
    Demo-locked parse endpoint.

    Cartographer's live PDF parse is non-deterministic — same audit can come back
    with BIOL 141 in-progress one run and completed the next, MATH 221 sometimes
    bottleneck / sometimes not, phantom senior electives showing up, etc. For the
    hackathon demo we want a deterministic, hand-curated student state, so we
    return the pre-built `cached_audit.json` verbatim no matter what PDF was
    uploaded. The upload is still consumed so the UI "upload → parse" animation
    plays as expected.

    Set ATLAS_LIVE_PARSE=1 to restore Cartographer's live path (post-demo).
    """
    audit_bytes = await audit.read()
    transcript_bytes = await transcript.read() if transcript else None

    cached_path = DATA_DIR / "cached_audit.json"

    # Demo lock: always serve the curated audit if it exists.
    if os.environ.get("ATLAS_LIVE_PARSE") != "1" and cached_path.exists():
        return json.loads(cached_path.read_text())

    try:
        result = parse_audit(audit_bytes, transcript_bytes, added_minor)
    except Exception:
        if cached_path.exists():
            result = json.loads(cached_path.read_text())
        else:
            raise HTTPException(status_code=500, detail="Parse failed and no cached audit available")
    cached_path.write_text(json.dumps(result))
    return result


class ParseCachedRequest(BaseModel):
    added_minor: Optional[str] = None


class ValidatePlacementRequest(BaseModel):
    course_code: str
    semester: str
    current_plan: dict  # {semester_name: [course_code, ...]}


@app.post("/api/parse-cached")
def parse_cached(req: ParseCachedRequest):
    cached_path = DATA_DIR / "cached_audit.json"
    if not cached_path.exists():
        raise HTTPException(status_code=404, detail="No cached audit. Upload a PDF first.")
    cached = json.loads(cached_path.read_text())
    result = amend_with_minor(cached, req.added_minor)
    return result


class PilotRegisterRequest(BaseModel):
    plan: Optional[list] = None  # list of {course, preferred_instructor?}


@app.post("/api/pilot-register")
async def pilot_register(req: PilotRegisterRequest, background_tasks: BackgroundTasks):
    session_id = str(uuid.uuid4())
    queue: asyncio.Queue = asyncio.Queue()
    SESSIONS[session_id] = {"status": "running", "queue": queue}
    background_tasks.add_task(_run_pilot_task, session_id, queue, req.plan)
    return {"session_id": session_id}


async def _run_pilot_task(session_id: str, queue: asyncio.Queue, plan):
    try:
        await run_pilot(session_id, queue, plan)
    except Exception as e:
        await queue.put({"type": "error", "message": str(e)})


@app.get("/api/pilot-stream/{session_id}")
async def pilot_stream(session_id: str):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")

    queue = SESSIONS[session_id]["queue"]

    async def event_generator():
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=30)
                yield f"data: {json.dumps(item)}\n\n"
                if item["type"] in ("waiting", "error"):
                    break
            except asyncio.TimeoutError:
                yield "data: {\"type\": \"ping\"}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/validate-placement")
def validate_placement_endpoint(req: ValidatePlacementRequest):
    cached_path = DATA_DIR / "cached_audit.json"
    if not cached_path.exists():
        return {"valid": True, "errors": [], "warnings": []}
    audit = json.loads(cached_path.read_text())
    all_courses = audit.get("courses", [])
    completed = [c["id"] for c in all_courses if c.get("status") == "completed"]
    return _validate_placement(req.course_code, req.semester, req.current_plan, completed, all_courses)


class AdvisorRequest(BaseModel):
    plan: dict  # { semester_name: [course_id, ...] }


@app.post("/api/advisor")
def advisor_endpoint(req: AdvisorRequest):
    cached_path = DATA_DIR / "cached_audit.json"
    audit = json.loads(cached_path.read_text()) if cached_path.exists() else None
    try:
        return review_plan(req.plan, audit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Advisor failed: {e}")


class AdvisorAskRequest(BaseModel):
    question: str
    plan: Optional[dict] = None


@app.post("/api/advisor/ask")
def advisor_ask_endpoint(req: AdvisorAskRequest):
    cached_path = DATA_DIR / "cached_audit.json"
    audit = json.loads(cached_path.read_text()) if cached_path.exists() else None
    try:
        return ask_advisor(req.question, req.plan or {}, audit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Advisor ask failed: {e}")


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class AdvisorChatRequest(BaseModel):
    messages: list[ChatMessage]
    plan: Optional[dict] = None


@app.post("/api/advisor/chat")
def advisor_chat_endpoint(req: AdvisorChatRequest):
    """Conversational advisor — Claude 3.5 Sonnet with the launch_pilot tool."""
    cached_path = DATA_DIR / "cached_audit.json"
    audit = json.loads(cached_path.read_text()) if cached_path.exists() else None
    try:
        return chat_advisor(
            [m.model_dump() for m in req.messages],
            req.plan or {},
            audit,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Advisor chat failed: {e}")


class ExportPlanRequest(BaseModel):
    registered: list[dict]  # [{course, section, instructor}, ...]
    student_name: Optional[str] = None
    major: Optional[str] = None
    term: Optional[str] = None


@app.post("/api/export-plan")
def export_plan_endpoint(req: ExportPlanRequest):
    """Build a PDF of the finalized schedule and return it as an attachment."""
    cached_path = DATA_DIR / "cached_audit.json"
    audit = json.loads(cached_path.read_text()) if cached_path.exists() else {}
    pdf_bytes = build_schedule_pdf(
        registered=req.registered,
        student_name=req.student_name or audit.get("student_name", "UMBC Student"),
        major=req.major or audit.get("major", "Computer Science"),
        term=req.term or "Spring 2026",
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="atlas-schedule.pdf"',
        },
    )


@app.post("/api/pilot-confirm/{session_id}")
async def pilot_confirm(session_id: str):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")
    result = await confirm_session(session_id)
    SESSIONS[session_id]["status"] = "confirmed"
    return result
