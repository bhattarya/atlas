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
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()

from agents.cartographer import parse_audit, amend_with_minor
from agents.pilot import run_pilot, confirm_session

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
    transcript: UploadFile = File(None),
    added_minor: str = Form(None),
):
    audit_bytes = await audit.read()
    transcript_bytes = await transcript.read() if transcript else None
    try:
        result = parse_audit(audit_bytes, transcript_bytes, added_minor)
    except ValueError as e:
        # Cartographer rejected the PDF (not a UMBC audit)
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        # Gemini API failure — fall back to cache silently
        cached_path = DATA_DIR / "cached_audit.json"
        if cached_path.exists():
            result = json.loads(cached_path.read_text())
        else:
            raise
    (DATA_DIR / "cached_audit.json").write_text(json.dumps(result))
    return result


class ParseCachedRequest(BaseModel):
    added_minor: Optional[str] = None


@app.post("/api/parse-cached")
def parse_cached(req: ParseCachedRequest):
    cached_path = DATA_DIR / "cached_audit.json"
    if not cached_path.exists():
        raise HTTPException(status_code=404, detail="No cached audit. Upload a PDF first.")
    cached = json.loads(cached_path.read_text())
    result = amend_with_minor(cached, req.added_minor)
    return result


@app.post("/api/pilot-register")
async def pilot_register(background_tasks: BackgroundTasks):
    session_id = str(uuid.uuid4())
    queue: asyncio.Queue = asyncio.Queue()
    SESSIONS[session_id] = {"status": "running", "queue": queue}
    background_tasks.add_task(_run_pilot_task, session_id, queue)
    return {"session_id": session_id}


async def _run_pilot_task(session_id: str, queue: asyncio.Queue):
    try:
        await run_pilot(session_id, queue)
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


@app.post("/api/pilot-confirm/{session_id}")
async def pilot_confirm(session_id: str):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found")
    result = await confirm_session(session_id)
    SESSIONS[session_id]["status"] = "confirmed"
    return result
