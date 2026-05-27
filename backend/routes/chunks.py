import json
import re
import shutil
import traceback
from pathlib import Path
from typing import List

from fastapi import APIRouter, Header, Request, UploadFile, File, Form
from fastapi.responses import StreamingResponse

from config import verify_key
from gemini import gemini_generate, extract_json, coerce
from prompts import STAGE1_SYSTEM, STAGE1_USER, STAGE2_SYSTEM, STAGE2_USER

router = APIRouter()

SESSIONS_DIR = Path("/tmp/hitnagdut_sessions")


def _safe(name: str) -> str:
    return re.sub(r'[^a-zA-Z0-9._-]', '_', name)[:200]


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


def _log(msg: str) -> str:
    return _sse({"type": "log", "message": msg})


@router.post("/upload-chunk")
async def upload_chunk(
    session_id: str = Form(...),
    file_name: str = Form(...),
    chunk_index: int = Form(...),
    data: UploadFile = File(...),
    x_internal_key: str = Header(default=""),
):
    verify_key(x_internal_key)
    session_dir = SESSIONS_DIR / _safe(session_id)
    session_dir.mkdir(parents=True, exist_ok=True)
    chunk_path = session_dir / f"{_safe(file_name)}__{chunk_index:06d}.bin"
    chunk_path.write_bytes(await data.read())
    return {"ok": True}


@router.post("/process-session")
async def process_session(
    request: Request,
    x_internal_key: str = Header(default=""),
):
    verify_key(x_internal_key)
    body = await request.json()
    session_id: str = body.get("session_id", "")
    file_names: List[str] = body.get("file_names", [])

    session_dir = SESSIONS_DIR / _safe(session_id)

    prepared = []
    for file_name in file_names:
        safe_name = _safe(file_name)
        chunks = sorted(session_dir.glob(f"{safe_name}__*.bin"))
        pdf_bytes = b"".join(c.read_bytes() for c in chunks)
        prepared.append({"filename": file_name, "content": pdf_bytes})

    async def event_gen():
        all_objections = []
        summary_list = []
        try:
            for i, fi in enumerate(prepared):
                name = fi["filename"]
                pdf_bytes = fi["content"]
                n = len(prepared)

                yield _log(f"[{i+1}/{n}] {name}")

                try:
                    yield _log("  שלב 1: מזהה פרטי מגיש...")
                    raw_meta = await gemini_generate(STAGE1_USER, STAGE1_SYSTEM, pdf_bytes)
                    md = extract_json(raw_meta)
                    meta = {
                        "megish":      coerce(md.get("megish")),
                        "beshem":      coerce(md.get("beshem")),
                        "ktovet":      coerce(md.get("ktovet")),
                        "gush_chelka": coerce(md.get("gush_chelka")),
                    }
                    kpart = f" | {meta['ktovet']}" if meta["ktovet"] else ""
                    megish = meta["megish"]
                    yield _log(f"  ✓ {megish}{kpart}")

                    yield _log("  שלב 2: מחלץ סעיפי התנגדות...")
                    raw_secs = await gemini_generate(STAGE2_USER, STAGE2_SYSTEM, pdf_bytes)
                    sd = extract_json(raw_secs)
                    sections = []
                    for s in (sd.get("sections") or []):
                        sections.append({
                            "section_number":      coerce(s.get("section_number")),
                            "section_title":       coerce(s.get("section_title")),
                            "missed_some_clauses": bool(s.get("missed_some_clauses", False)),
                            "clauses": [{"text": coerce(c.get("text"))} for c in (s.get("clauses") or [])],
                        })

                    clause_count = sum(len(s["clauses"]) for s in sections)
                    nsec = len(sections)
                    yield _log(f"  ✓ {nsec} פרקים ({clause_count} סעיפים) חולצו")

                    all_objections.append({"meta": meta, "sections": sections})
                    summary_list.append({"fileName": name, "megish": meta["megish"], "clauses": clause_count})

                except Exception as e:
                    traceback.print_exc()
                    err_msg = str(e)
                    yield _log(f"  ✗ שגיאה: {err_msg}")
                    all_objections.append({"meta": {"megish": name, "beshem": "", "ktovet": "", "gush_chelka": ""}, "sections": []})
                    summary_list.append({"fileName": name, "megish": name, "clauses": 0, "failed": True})

            total = sum(s["clauses"] for s in summary_list)
            nf = len(prepared)
            total_msg = f'סה"כ: {nf} קבצים, {total} סעיפים'
            yield _log(total_msg)
            yield _log("עיבוד בסיסי הושלם. עובר לשלב בדיקה מקדימית...")
            yield _sse({"type": "done", "objections": all_objections, "summary": summary_list})

        except Exception as e:
            err = str(e)
            yield _sse({"type": "error", "message": err})

        finally:
            shutil.rmtree(session_dir, ignore_errors=True)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
