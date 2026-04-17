from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from db import active_sessions, attention_logs, engagement_logs, sessions, students
from services.attention import compute_attention_score, update_streak_and_badges
from services.realtime import realtime_hub

router = APIRouter()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_key(value: Any, fallback: str = "") -> str:
    text = str(value or fallback).strip()
    return text or fallback


def _student_base(student_id: str, name: str, subject: str, meet_link: str) -> dict[str, Any]:
    return {
        "student_id": student_id,
        "name": name or "Student",
        "subject": subject or "General",
        "meet_link": meet_link or "unassigned",
        "updated_at": _now(),
    }


def _get_student(student_id: str) -> dict[str, Any] | None:
    if students is None:
        return None
    return students.find_one({"student_id": student_id}, {"_id": 0})


def _persist_student(student_doc: dict[str, Any]) -> dict[str, Any]:
    if students is not None:
        students.update_one({"student_id": student_doc["student_id"]}, {"$set": student_doc}, upsert=True)
    return student_doc


def _log_attention(payload: dict[str, Any], computed: dict[str, Any], student_doc: dict[str, Any]) -> dict[str, Any]:
    timestamp = payload.get("timestamp") or _now()
    log_doc = {
        "timestamp": timestamp,
        "student_id": student_doc["student_id"],
        "name": student_doc.get("name", "Student"),
        "subject": student_doc.get("subject", "General"),
        "meet_link": student_doc.get("meet_link", "unassigned"),
        "attention_score": computed["score"],
        "status": computed["status"],
        "metrics": payload,
        "face_detected": bool(payload.get("face_detected")),
        "gaze_direction": payload.get("gaze_direction", "center"),
        "blink_rate": payload.get("blink_rate", 0),
        "head_pose": payload.get("head_pose", "forward"),
        "yawning": bool(payload.get("yawning")),
        "presence": payload.get("presence", True),
        "updated_at": _now(),
    }

    if attention_logs is not None:
        attention_logs.insert_one(log_doc)

    if engagement_logs is not None:
        engagement_logs.insert_one(
            {
                "timestamp": timestamp,
                "student_id": student_doc["student_id"],
                "session_id": student_doc.get("session_id", student_doc["student_id"]),
                "face_detected": bool(payload.get("face_detected")),
                "face_count": 1 if payload.get("face_detected") else 0,
                "emotion": computed["status"],
                "phone_detected": bool(payload.get("phone_detected")),
                "asleep": payload.get("head_pose") == "down",
                "gaze_away": payload.get("gaze_direction", "center") not in {"center", "forward"},
                "yawning": bool(payload.get("yawning")),
                "engagement_score": computed["score"],
                "raw_faces_data": [payload],
            }
        )

    return log_doc


def _build_student_card(student_doc: dict[str, Any], latest_log: dict[str, Any] | None) -> dict[str, Any]:
    card = {
        "student_id": student_doc.get("student_id"),
        "name": student_doc.get("name", "Student"),
        "subject": student_doc.get("subject", "General"),
        "meet_link": student_doc.get("meet_link", "unassigned"),
        "streak": int(student_doc.get("streak", 0)),
        "badge": student_doc.get("badge", ""),
        "badges": student_doc.get("badges", []),
        "presence": bool(latest_log.get("face_detected")) if latest_log else False,
        "attention_score": (latest_log or {}).get("attention_score", 0),
        "status": (latest_log or {}).get("status", "No data"),
        "blink_rate": (latest_log or {}).get("blink_rate", 0),
        "head_pose": (latest_log or {}).get("head_pose", "forward"),
        "yawning": bool((latest_log or {}).get("yawning", False)),
        "last_seen": (latest_log or {}).get("timestamp"),
        "updated_at": student_doc.get("updated_at"),
    }
    return card


@router.post("/join")
async def join_student(payload: dict[str, Any]):
    student_id = _normalize_key(payload.get("student_id"), str(uuid4()))
    name = _normalize_key(payload.get("name"), "Student")
    subject = _normalize_key(payload.get("subject"), "General")
    meet_link = _normalize_key(payload.get("meet_link"), "unassigned")

    student_doc = _get_student(student_id) or _student_base(student_id, name, subject, meet_link)
    student_doc.update({
        "name": name,
        "subject": subject,
        "meet_link": meet_link,
        "joined_at": student_doc.get("joined_at") or _now(),
        "updated_at": _now(),
    })
    student_doc = _persist_student(student_doc)

    return {"ok": True, "student": student_doc}


@router.post("/start-session")
async def start_session(payload: dict[str, Any]):
    session_id = _normalize_key(payload.get("session_id"), str(uuid4()))
    meet_link = _normalize_key(payload.get("meet_link"), "unassigned")
    session_doc = {
        "session_id": session_id,
        "teacher_name": _normalize_key(payload.get("teacher_name"), "Teacher"),
        "subject": _normalize_key(payload.get("subject"), "General"),
        "batch_time": _normalize_key(payload.get("batch_time"), ""),
        "meet_link": meet_link,
        "active": True,
        "started_at": _now(),
        "updated_at": _now(),
    }

    if active_sessions is not None:
        active_sessions.update_one({"meet_link": meet_link}, {"$set": session_doc}, upsert=True)
    if sessions is not None:
        sessions.insert_one(session_doc)

    return {"ok": True, "session": session_doc}


@router.get("/teacher/students")
async def teacher_students(meet_link: str = Query("")):
    if students is None:
        return []

    criteria: dict[str, Any] = {}
    if meet_link:
        criteria["meet_link"] = meet_link

    items = list(students.find(criteria, {"_id": 0}).sort("updated_at", -1))
    latest_logs: dict[str, dict[str, Any]] = {}
    if attention_logs is not None and items:
        student_ids = [item["student_id"] for item in items]
        for student_id in student_ids:
            latest = attention_logs.find_one({"student_id": student_id}, {"_id": 0}, sort=[("timestamp", -1)])
            if latest:
                latest_logs[student_id] = latest

    return [_build_student_card(item, latest_logs.get(item["student_id"])) for item in items]


@router.get("/students/{student_id}/logs")
async def student_logs(student_id: str, limit: int = Query(120, ge=1, le=1000)):
    if attention_logs is None:
        return {"student_id": student_id, "history": [], "summary": {"total_focus_time": 0, "distraction_count": 0, "avg_score": 0}}

    history = list(
        attention_logs.find(
            {"student_id": student_id},
            {"_id": 0},
        ).sort("timestamp", -1).limit(limit)
    )
    history.reverse()

    focus_count = sum(1 for item in history if item.get("attention_score", 0) > 75)
    distraction_count = sum(1 for item in history if item.get("status") not in {"Focused"})
    avg_score = round(sum(item.get("attention_score", 0) for item in history) / len(history), 1) if history else 0

    return {
        "student_id": student_id,
        "history": history,
        "summary": {
            "total_focus_time": focus_count,
            "distraction_count": distraction_count,
            "avg_score": avg_score,
        },
    }


@router.websocket("/ws/teacher")
async def teacher_ws(websocket: WebSocket, meet_link: str = Query("")):
    key = await realtime_hub.connect_teacher(websocket, meet_link)
    try:
        snapshot = await teacher_students(meet_link=key)
        await websocket.send_json({"type": "snapshot", "meet_link": key, "students": snapshot})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        realtime_hub.disconnect_teacher(websocket, key)
    except Exception:
        realtime_hub.disconnect_teacher(websocket, key)


@router.websocket("/ws/student")
async def student_ws(
    websocket: WebSocket,
    student_id: str = Query(""),
    name: str = Query("Student"),
    subject: str = Query("General"),
    meet_link: str = Query("unassigned"),
    session_id: str = Query(""),
):
    await websocket.accept()

    active_student = _student_base(_normalize_key(student_id, str(uuid4())), name, subject, meet_link)
    active_student["session_id"] = _normalize_key(session_id, active_student["student_id"])
    active_student = _persist_student(active_student)

    try:
        while True:
            payload = await websocket.receive_json()
            payload_meet_link = _normalize_key(payload.get("meet_link"), active_student["meet_link"])
            active_student["meet_link"] = payload_meet_link
            active_student["name"] = _normalize_key(payload.get("name"), active_student["name"])
            active_student["subject"] = _normalize_key(payload.get("subject"), active_student["subject"])
            active_student["updated_at"] = _now()

            computed = compute_attention_score(payload)
            payload_score = payload.get("attention_score")
            if isinstance(payload_score, (int, float)):
                computed["score"] = round(float(payload_score), 1)
                if computed["status"] != "Bored":
                    if computed["score"] > 75:
                        computed["status"] = "Focused"
                    elif computed["score"] >= 50:
                        computed["status"] = "Slightly distracted"
                    else:
                        computed["status"] = "Highly distracted"

            reward_state = update_streak_and_badges(active_student, computed["score"])
            active_student.update(reward_state)
            active_student["last_attention_score"] = computed["score"]
            active_student["last_status"] = computed["status"]

            persisted_student = _persist_student(active_student)
            log_doc = _log_attention(payload, computed, persisted_student)
            teacher_payload = {
                "type": "student_update",
                "meet_link": persisted_student["meet_link"],
                "student": _build_student_card(persisted_student, log_doc),
                "log": log_doc,
            }
            await realtime_hub.broadcast_teacher(persisted_student["meet_link"], teacher_payload)
    except WebSocketDisconnect:
        return
    except Exception:
        return