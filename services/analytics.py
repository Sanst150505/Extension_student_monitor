"""
services/analytics.py
---------------------
MongoDB aggregation queries for the analytics API endpoints.

Functions:
  get_recent_stats(limit)    → last N entries (timestamp, score, emotion)
  get_summary()              → avg score, top emotion, frame/event counts
  get_student_profile(id)    → full history, avg score, risk level
"""

from db import engagement_logs, events_logs


# ──────────────────────────────────────────────────────────────────────────────
#  GET /stats — last 100 entries
# ──────────────────────────────────────────────────────────────────────────────
def get_recent_stats(limit: int = 100) -> list:
    """Return the most recent engagement log entries."""
    if engagement_logs is None:
        return []

    cursor = engagement_logs.find(
        {},
        {
            "_id": 0,
            "timestamp": 1,
            "engagement_score": 1,
            "emotion": 1,
        },
    ).sort("timestamp", -1).limit(limit)

    return list(cursor)


# ──────────────────────────────────────────────────────────────────────────────
#  GET /summary — aggregate overview
# ──────────────────────────────────────────────────────────────────────────────
def get_summary() -> dict:
    """Return aggregate engagement summary."""
    if engagement_logs is None:
        return {
            "avg_engagement_score": 0,
            "most_common_emotion": "N/A",
            "total_frames": 0,
            "total_idle_events": 0,
            "total_tab_switches": 0,
        }

    # Total frames
    total_frames = engagement_logs.count_documents({})

    # Average engagement score
    avg_pipeline = [
        {"$group": {"_id": None, "avg_score": {"$avg": "$engagement_score"}}}
    ]
    avg_result = list(engagement_logs.aggregate(avg_pipeline))
    avg_score = round(avg_result[0]["avg_score"], 1) if avg_result else 0

    # Most common emotion
    emotion_pipeline = [
        {"$group": {"_id": "$emotion", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 1},
    ]
    emotion_result = list(engagement_logs.aggregate(emotion_pipeline))
    top_emotion = emotion_result[0]["_id"] if emotion_result else "N/A"

    # Event counts
    total_idle = 0
    total_tab_switches = 0
    if events_logs is not None:
        total_idle = events_logs.count_documents({"event_type": "IDLE"})
        total_tab_switches = events_logs.count_documents({"event_type": "TAB_SWITCH"})

    return {
        "avg_engagement_score": avg_score,
        "most_common_emotion": top_emotion,
        "total_frames": total_frames,
        "total_idle_events": total_idle,
        "total_tab_switches": total_tab_switches,
    }


# ──────────────────────────────────────────────────────────────────────────────
#  GET /student/{id} — student profile
# ──────────────────────────────────────────────────────────────────────────────
def get_student_profile(student_id: str) -> dict:
    """Return full engagement history and risk assessment for a student."""
    if engagement_logs is None:
        return {
            "student_id": student_id,
            "total_frames": 0,
            "avg_score": 0,
            "risk_level": "unknown",
            "history": [],
        }

    # Full history for this student
    cursor = engagement_logs.find(
        {"student_id": student_id},
        {
            "_id": 0,
            "timestamp": 1,
            "engagement_score": 1,
            "emotion": 1,
            "face_detected": 1,
            "phone_detected": 1,
            "asleep": 1,
            "gaze_away": 1,
            "yawning": 1,
        },
    ).sort("timestamp", -1)

    history = list(cursor)
    total_frames = len(history)

    # Average score
    if total_frames > 0:
        avg_score = round(
            sum(h.get("engagement_score", 0) for h in history) / total_frames, 1
        )
    else:
        avg_score = 0

    # Risk level
    if avg_score >= 70:
        risk_level = "low"
    elif avg_score >= 40:
        risk_level = "medium"
    else:
        risk_level = "high"

    return {
        "student_id": student_id,
        "total_frames": total_frames,
        "avg_score": avg_score,
        "risk_level": risk_level,
        "history": history,
    }
