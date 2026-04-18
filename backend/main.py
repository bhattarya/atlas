import os
import json
import uuid
import asyncio
from pathlib import Path
from dotenv import load_dotenv

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()

from agents.cartographer import parse_audit
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
    return {"status": "ok", "model": "gemini-3-flash-preview"}


@app.post("/api/parse")
async def parse(
    audit: UploadFile = File(...),
    transcript: UploadFile = File(None),
    added_minor: str = Form(None),
):
    audit_bytes = await audit.read()
    transcript_bytes = await transcript.read() if transcript else None
    result = parse_audit(audit_bytes, transcript_bytes, added_minor)
    # Cache for minor-toggle re-parses
    (DATA_DIR / "cached_audit.json").write_text(json.dumps(result))
    return result


class ParseCachedRequest(BaseModel):
    added_minor: str | None = None


@app.post("/api/parse-cached")
def parse_cached(req: ParseCachedRequest):
    cached_path = DATA_DIR / "cached_audit.json"
    if not cached_path.exists():
        raise HTTPException(status_code=404, detail="No cached audit. Upload a PDF first.")
    cached = json.loads(cached_path.read_text())
    if req.added_minor:
        # Re-run cartographer with minor override using cached bytes placeholder
        # In full impl, re-parse the stored bytes; here we amend the cached result
        cached["minor"] = req.added_minor
        cached["minor_added"] = True
    else:
        cached.pop("minor", None)
        cached.pop("minor_added", None)
    return cached


@app.post("/api/pilot-register")
def pilot_register():
    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = {"status": "running", "queue": asyncio.Queue()}
    asyncio.create_task(_run_pilot_task(session_id))
    return {"session_id": session_id}


async def _run_pilot_task(session_id: str):
    queue = SESSIONS[session_id]["queue"]
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
