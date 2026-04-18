from datetime import datetime, timezone

from fastapi import APIRouter, Body

from db import voice_logs

router = APIRouter()


def _voice_score(transcript: str, speaking_duration: float, avg_volume: float, confidence: float) -> float:
    transcript_bonus = min(len((transcript or "").split()) * 4, 40)
    duration_bonus = min(max(speaking_duration, 0) * 6, 30)
    energy_bonus = min(max(avg_volume, 0) * 100, 20)
    confidence_bonus = min(max(confidence, 0) * 10, 10)
    return round(min(transcript_bonus + duration_bonus + energy_bonus + confidence_bonus, 100), 1)


@router.post("/voice-event")
async def voice_event(data: dict = Body(...)):
    transcript = (data.get("transcript") or "").strip()
    speaking_duration = float(data.get("speaking_duration", 0) or 0)
    avg_volume = float(data.get("avg_volume", 0) or 0)
    peak_volume = float(data.get("peak_volume", 0) or 0)
    confidence = float(data.get("confidence", 0) or 0)
    status = data.get("status", "idle")

    doc = {
        "student_id": data.get("student_id", "demo_user"),
        "student_name": data.get("student_name", "Student"),
        "subject": data.get("subject", "General"),
        "batch": data.get("batch", "General"),
        "session_id": data.get("session_id", "demo_session"),
        "transcript": transcript,
        "speaking_duration": speaking_duration,
        "avg_volume": avg_volume,
        "peak_volume": peak_volume,
        "confidence": confidence,
        "status": status,
        "voice_score": _voice_score(transcript, speaking_duration, avg_volume, confidence),
        "timestamp": datetime.now(timezone.utc),
    }

    if voice_logs is not None:
        try:
            voice_logs.insert_one(doc)
        except Exception as exc:
            print(f"[MongoDB] Failed to log voice event: {exc}")

    return {
        "ok": True,
        "voice_score": doc["voice_score"],
        "status": status,
        "transcript": transcript,
    }
