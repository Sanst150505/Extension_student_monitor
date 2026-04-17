from __future__ import annotations

from collections import Counter

from db import assessments, engagement_logs, events_logs


def _scope_filter(subject: str | None = None, batch: str | None = None, session_id: str | None = None) -> dict:
    scope = {}
    if subject:
        scope["subject"] = subject
    if batch:
        scope["batch"] = batch
    if session_id:
        scope["session_id"] = session_id
    return scope


def _trend_from_scores(scores: list[float]) -> str:
    if len(scores) < 4:
        return "stable"
    recent = scores[:4]
    previous = scores[4:8]
    if not previous:
        return "stable"
    delta = (sum(recent) / len(recent)) - (sum(previous) / len(previous))
    if delta > 5:
        return "up"
    if delta < -5:
        return "down"
    return "stable"


def _band(score: float) -> str:
    if score >= 80:
        return "high"
    if score >= 60:
        return "moderate"
    return "low"


def _assessment_summary(student_id: str, scope: dict) -> dict:
    if assessments is None:
        return {
            "avg_question_score": 0.0,
            "question_attempts": 0,
            "correct_answers": 0,
            "avg_response_time": 0.0,
        }

    docs = list(
        assessments.find(
            {"student_id": student_id, **scope},
            {
                "_id": 0,
                "score": 1,
                "correct": 1,
                "response_time": 1,
                "timestamp": 1,
                "question_id": 1,
            },
        ).sort("timestamp", -1)
    )
    if not docs:
        return {
            "avg_question_score": 0.0,
            "question_attempts": 0,
            "correct_answers": 0,
            "avg_response_time": 0.0,
        }

    scores = [float(doc.get("score", 0)) for doc in docs]
    response_times = [float(doc.get("response_time", 0)) for doc in docs if doc.get("response_time") is not None]
    return {
        "avg_question_score": round(sum(scores) / len(scores), 1),
        "question_attempts": len(docs),
        "correct_answers": sum(1 for doc in docs if doc.get("correct")),
        "avg_response_time": round(sum(response_times) / len(response_times), 1) if response_times else 0.0,
        "recent": docs[:10],
    }


def get_recent_stats(limit: int = 100, subject: str | None = None, batch: str | None = None, session_id: str | None = None) -> list:
    if engagement_logs is None:
        return []

    scope = _scope_filter(subject, batch, session_id)
    cursor = engagement_logs.find(
        scope,
        {
            "_id": 0,
            "timestamp": 1,
            "student_id": 1,
            "student_name": 1,
            "subject": 1,
            "batch": 1,
            "session_id": 1,
            "emotion": 1,
            "engagement": 1,
            "attention": 1,
            "pose": 1,
            "phone_detected": 1,
        },
    ).sort("timestamp", -1).limit(limit)

    rows = []
    for item in cursor:
        rows.append(
            {
                "timestamp": item.get("timestamp"),
                "student_id": item.get("student_id"),
                "student_name": item.get("student_name"),
                "subject": item.get("subject"),
                "batch": item.get("batch"),
                "session_id": item.get("session_id"),
                "engagement_score": item.get("engagement", {}).get("score", 0),
                "emotion": item.get("emotion", "No Data"),
                "attention_status": item.get("attention", {}).get("status", "No Data"),
                "head_direction": item.get("pose", {}).get("head_direction", "Unknown"),
                "phone_detected": item.get("phone_detected", False),
            }
        )
    return rows


def get_students_overview(subject: str | None = None, batch: str | None = None, session_id: str | None = None) -> list:
    if engagement_logs is None:
        return []

    scope = _scope_filter(subject, batch, session_id)
    student_ids = engagement_logs.distinct("student_id", scope)
    students = []

    for student_id in student_ids:
        history = list(
            engagement_logs.find(
                {"student_id": student_id, **scope},
                {
                    "_id": 0,
                    "timestamp": 1,
                    "student_name": 1,
                    "emotion": 1,
                    "engagement": 1,
                    "attention": 1,
                    "pose": 1,
                    "phone_detected": 1,
                },
            ).sort("timestamp", -1).limit(12)
        )
        if not history:
            continue

        latest = history[0]
        scores = [float(item.get("engagement", {}).get("score", 0)) for item in history]
        emotion_values = [item.get("emotion", "No Data") for item in history]
        assessment_summary = _assessment_summary(student_id, scope)
        avg_engagement_score = round(sum(scores) / len(scores), 1) if scores else 0.0
        final_score = round((0.6 * avg_engagement_score) + (0.4 * assessment_summary["avg_question_score"]), 1)

        students.append(
            {
                "student_id": student_id,
                "name": latest.get("student_name") or student_id,
                "engagement_score": round(latest.get("engagement", {}).get("score", 0), 1),
                "avg_engagement_score": avg_engagement_score,
                "attention_status": latest.get("attention", {}).get("status", "No Data"),
                "emotion": latest.get("emotion", "No Data"),
                "head_direction": latest.get("pose", {}).get("head_direction", "Unknown"),
                "phone_detected": latest.get("phone_detected", False),
                "trend": _trend_from_scores(scores),
                "score_band": _band(latest.get("engagement", {}).get("score", 0)),
                "dominant_emotion": Counter(emotion_values).most_common(1)[0][0] if emotion_values else "No Data",
                "avg_question_score": assessment_summary["avg_question_score"],
                "question_attempts": assessment_summary["question_attempts"],
                "correct_answers": assessment_summary["correct_answers"],
                "avg_response_time": assessment_summary["avg_response_time"],
                "final_score": final_score,
            }
        )

    students.sort(key=lambda student: (student["engagement_score"], student["avg_question_score"]))
    return students


def get_summary(subject: str | None = None, batch: str | None = None, session_id: str | None = None) -> dict:
    students = get_students_overview(subject, batch, session_id)
    scope = _scope_filter(subject, batch, session_id)

    if engagement_logs is None:
        return {
            "avg_engagement_score": 0,
            "avg_question_score": 0,
            "avg_final_score": 0,
            "most_common_emotion": "N/A",
            "total_logs": 0,
            "total_idle_events": 0,
            "total_tab_switches": 0,
            "total_students": 0,
            "distracted_students": 0,
        }

    total_logs = engagement_logs.count_documents(scope)
    recent_rows = get_recent_stats(limit=200, subject=subject, batch=batch, session_id=session_id)
    emotions = [row.get("emotion", "N/A") for row in recent_rows if row.get("emotion")]
    avg_engagement = round(sum(student["avg_engagement_score"] for student in students) / len(students), 1) if students else 0
    avg_question = round(sum(student["avg_question_score"] for student in students) / len(students), 1) if students else 0
    avg_final = round(sum(student["final_score"] for student in students) / len(students), 1) if students else 0

    total_idle = events_logs.count_documents({**scope, "event_type": "IDLE"}) if events_logs is not None else 0
    total_tab_switches = events_logs.count_documents({**scope, "event_type": "TAB_SWITCH"}) if events_logs is not None else 0

    return {
        "avg_engagement_score": avg_engagement,
        "avg_question_score": avg_question,
        "avg_final_score": avg_final,
        "most_common_emotion": Counter(emotions).most_common(1)[0][0] if emotions else "N/A",
        "total_logs": total_logs,
        "total_idle_events": total_idle,
        "total_tab_switches": total_tab_switches,
        "total_students": len(students),
        "distracted_students": sum(1 for student in students if student["attention_status"] in {"Distracted", "Not Attentive", "Sleeping"}),
    }


def get_student_profile(student_id: str, subject: str | None = None, batch: str | None = None, session_id: str | None = None) -> dict:
    if engagement_logs is None:
        return {
            "student_id": student_id,
            "total_logs": 0,
            "avg_score": 0,
            "risk_level": "unknown",
            "current_state": "No Data",
            "emotion": "No Data",
            "trend": "stable",
            "history": [],
            "assessments": [],
            "avg_question_score": 0,
            "final_score": 0,
        }

    scope = _scope_filter(subject, batch, session_id)
    history = list(
        engagement_logs.find(
            {"student_id": student_id, **scope},
            {
                "_id": 0,
                "timestamp": 1,
                "emotion": 1,
                "engagement": 1,
                "attention": 1,
                "pose": 1,
                "phone_detected": 1,
                "signals": 1,
            },
        ).sort("timestamp", -1)
    )

    scores = [float(item.get("engagement", {}).get("score", 0)) for item in history]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0
    if avg_score >= 80:
        risk_level = "low"
    elif avg_score >= 60:
        risk_level = "medium"
    else:
        risk_level = "high"

    latest = history[0] if history else {}
    assessment_summary = _assessment_summary(student_id, scope)
    final_score = round((0.6 * avg_score) + (0.4 * assessment_summary["avg_question_score"]), 1)

    normalized_history = [
        {
            "timestamp": item.get("timestamp"),
            "engagement_score": item.get("engagement", {}).get("score", 0),
            "emotion": item.get("emotion", "No Data"),
            "attention_status": item.get("attention", {}).get("status", "No Data"),
            "head_direction": item.get("pose", {}).get("head_direction", "Unknown"),
            "phone_detected": item.get("phone_detected", False),
            "eyes_closed": item.get("signals", {}).get("eyes_closed", False),
            "closed_frames": item.get("signals", {}).get("closed_frames", 0),
            "gaze_away": item.get("signals", {}).get("gaze_away", False),
            "yawning": item.get("signals", {}).get("yawning", False),
        }
        for item in history
    ]

    return {
        "student_id": student_id,
        "total_logs": len(history),
        "avg_score": avg_score,
        "risk_level": risk_level,
        "current_state": latest.get("attention", {}).get("status", "No Data"),
        "emotion": latest.get("emotion", "No Data"),
        "trend": _trend_from_scores(scores),
        "history": normalized_history,
        "assessments": assessment_summary.get("recent", []),
        "avg_question_score": assessment_summary["avg_question_score"],
        "question_attempts": assessment_summary["question_attempts"],
        "avg_response_time": assessment_summary["avg_response_time"],
        "final_score": final_score,
    }
