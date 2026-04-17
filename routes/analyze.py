import time
from datetime import datetime, timezone
from urllib.parse import unquote, urlparse

import cv2
import numpy as np
from fastapi import APIRouter, Request

from db import engagement_logs
from detectors.face import detect_face
from detectors.phone import detect_phone
from detectors.pose import detect_pose
from services.monitoring import evaluate_monitoring, should_log
from services.scoring import compute_engagement_score, update_attention_and_check_trigger

router = APIRouter()

MAX_BODY_SIZE = 5 * 1024 * 1024


def _sanitize(obj):
    if isinstance(obj, dict):
        return {key: _sanitize(value) for key, value in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(value) for value in obj]
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


def _session_from_link(meet_link: str, fallback: str) -> str:
    if not meet_link:
        return fallback

    parsed = urlparse(meet_link)
    path_parts = [part for part in parsed.path.split("/") if part]
    if path_parts:
        return path_parts[-1]
    return fallback


def _read_identity(request: Request) -> dict:
    meet_link = unquote(request.headers.get("X-Meet-Link", ""))
    session_id = request.headers.get("X-Session-Id", "").strip()
    batch = unquote(request.headers.get("X-Student-Batch", "General"))

    return {
        "session_id": session_id or _session_from_link(meet_link, "demo_session"),
        "student_id": request.headers.get("X-Student-Id", "demo_user"),
        "student_name": unquote(request.headers.get("X-Student-Name", "Student")),
        "subject": unquote(request.headers.get("X-Student-Subject", "General")),
        "batch": batch or "General",
        "meet_link": meet_link,
    }


def process_frame(frame, identity: dict) -> dict:
    if frame is None or frame.size == 0 or frame.mean() < 10:
        return {
            "face": False,
            "emotion": "No Face",
            "phone": {"phone_detected": False, "phone_boxes": []},
            "engagement": {
                "raw_score": 0,
                "smooth_score": 0,
                "score": 0,
                "status": "Not Attentive",
                "attention_status": "Not Attentive",
                "current_state": "No Face",
                "emotion": "No Face",
                "gaze_status": "Unknown",
                "components": {},
                "signals": {},
                "intervention": {
                    "ask_question": False,
                    "difficulty": "easy",
                    "cooldown_seconds_remaining": 0,
                    "low_score_streak": 0,
                },
            },
            "pose": {"head_direction": "Unknown", "hand_raised": False},
            "face_count": 0,
            "faces": [],
        }

    face_results = detect_face(frame)
    phone_result = detect_phone(frame)
    face_landmarks = face_results[0].get("landmarks") if face_results else None
    pose_result = detect_pose(frame, face_landmarks=face_landmarks)

    serializable_faces = []
    for face in face_results:
        face_copy = {key: value for key, value in face.items() if key != "landmarks"}
        serializable_faces.append(face_copy)

    engagement = evaluate_monitoring(identity, serializable_faces, pose_result, phone_result)

    return {
        "face": len(face_results) > 0,
        "face_count": len(face_results),
        "faces": serializable_faces,
        "emotion": engagement["emotion"],
        "attention": {
            "status": engagement["attention_status"],
            "score": engagement["smooth_score"],
        },
        "phone": phone_result,
        "pose": pose_result,
        "engagement": engagement,
    }


def _log_to_mongodb(identity: dict, result: dict) -> None:
    if engagement_logs is None or not should_log(identity):
        return

    face = result["faces"][0] if result.get("faces") else {}
    doc = {
        "student_id": identity["student_id"],
        "student_name": identity["student_name"],
        "subject": identity["subject"],
        "batch": identity["batch"],
        "session_id": identity["session_id"],
        "timestamp": datetime.now(timezone.utc),
        "emotion": result["engagement"]["emotion"],
        "engagement": {
            "status": result["engagement"]["attention_status"],
            "score": result["engagement"]["smooth_score"],
        },
        "attention": {
            "status": result["engagement"]["attention_status"],
            "score": result["engagement"]["smooth_score"],
        },
        "pose": {
            "head_direction": result["pose"].get("head_direction", "Unknown"),
        },
        "phone_detected": result["phone"].get("phone_detected", False),
        "meet_link": identity["meet_link"],
        "gaze_status": result["engagement"]["gaze_status"],
        "signals": {
            "eyes_closed": face.get("eyes_closed", False),
            "closed_frames": face.get("closed_frames", 0),
            "yawning": face.get("yawning", False),
            "gaze_away": face.get("gaze_away", False),
        },
        "processing_time_ms": result.get("processing_time_ms", 0),
    }
    engagement_logs.insert_one(doc)


@router.post("/analyze")
async def analyze(request: Request):
    identity = _read_identity(request)

    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_BODY_SIZE:
        return {"error": "Frame too large (max 5MB)"}

    try:
        contents = await request.body()
    except Exception:
        return {"error": "Failed to read frame"}

    if not contents:
        return {"error": "Empty frame"}

    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        return {"error": "Invalid image"}

    started = time.time()
    result = process_frame(frame, identity)
    result["processing_time_ms"] = round((time.time() - started) * 1000, 1)

    _log_to_mongodb(identity, result)

    face = result["faces"][0] if result.get("faces") else {}
    trigger_score = compute_engagement_score(
        face_detected=result["face"],
        phone_detected=result["phone"].get("phone_detected", False),
        asleep=result["engagement"]["emotion"] in {"Sleepy", "Drowsy"},
        gaze_away=face.get("gaze_away", False) or result["pose"].get("head_direction") in {"Left", "Right", "Down"},
        yawning=face.get("yawning", False),
    )
    ask_question, difficulty = update_attention_and_check_trigger(trigger_score)

    result["ask_question"] = ask_question
    result["difficulty"] = difficulty
    result["session_id"] = identity["session_id"]
    result["student_id"] = identity["student_id"]
    result["subject"] = identity["subject"]
    result["batch"] = identity["batch"]

    return _sanitize(result)
