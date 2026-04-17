from datetime import datetime, timezone

from fastapi import APIRouter, Body

from db import events_logs

router = APIRouter()


@router.post("/event")
async def event(data: dict = Body(...)):
    event_doc = {
        "timestamp": datetime.now(timezone.utc),
        "student_id": data.get("student_id", "demo_user"),
        "student_name": data.get("student_name") or data.get("name", "Student"),
        "subject": data.get("subject", "General"),
        "batch": data.get("batch", "General"),
        "session_id": data.get("session_id", "demo_session"),
        "meet_link": data.get("meet_link", ""),
        "event_type": data.get("type", "UNKNOWN"),
        "details": data,
    }

    if events_logs is not None:
        try:
            events_logs.insert_one(event_doc)
        except Exception as exc:
            print(f"[MongoDB] Failed to log event: {exc}")

    return {"ok": True}
