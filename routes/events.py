import time
from fastapi import APIRouter, Request
from datetime import datetime, timezone
from db import events_logs

router = APIRouter()

@router.post("/event")
async def event(request: Request):
    """
    Receives browser events from the extension.
    """
    try:
        data = await request.json()
    except Exception:
        return {"error": "Invalid JSON"}

    # MongoDB log
    if events_logs is not None:
        try:
            events_logs.insert_one({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "student_id": "demo_user",
                "event_type": data.get("type", "UNKNOWN"),
                "details": data,
            })
        except Exception as e:
            print(f"[MongoDB] ⚠️ Failed to log event: {e}")

    return {"ok": True}
