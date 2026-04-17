import time
import numpy as np
import cv2
from fastapi import APIRouter, Request
from datetime import datetime, timezone

from detectors.face import detect_face
from detectors.emotion import classify_emotion
from detectors.pose import detect_pose
from detectors.phone import detect_phone
from utils.scoring import compute_score
from db import engagement_logs, sessions
from services.scoring import compute_engagement_score, update_attention_and_check_trigger

router = APIRouter()

# ── Max request body size (5 MB) ─────────────────────────────────────────────
MAX_BODY_SIZE = 5 * 1024 * 1024

# ── Session State (Shared with main.py if needed, or local for now) ──────────
# NOTE: In a multi-user production app, these would be in Redis or a DB.
_session_id = "demo_session"
_frame_count = 0
_score_accumulator = 0.0
_session_start = datetime.now(timezone.utc)

def _sanitize(obj):
    """Recursively convert numpy types to native Python types for JSON."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    elif isinstance(obj, (np.bool_,)):
        return bool(obj)
    elif isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj

def process_frame(frame) -> dict:
    if frame is None or frame.size == 0 or frame.mean() < 10:
        return {
            "face": False,
            "emotion": "No Camera",
            "phone": {"phone_detected": False, "phone_boxes": []},
            "engagement": {"raw_score": 0, "smooth_score": 0, "status": "Distracted", "components": {}},
            "pose": {"head_direction": "Unknown", "hand_raised": False},
            "face_count": 0,
        }

    face_results = detect_face(frame)
    phone_result = detect_phone(frame)
    face_landmarks = face_results[0].get("landmarks") if face_results else None
    pose_result = detect_pose(frame, face_landmarks=face_landmarks)
    emotion = classify_emotion(face_results[0], frame) if face_results else "No Face"

    serializable_faces = []
    for f in face_results:
        face_copy = {k: v for k, v in f.items() if k != "landmarks"}
        serializable_faces.append(face_copy)

    score_data = compute_score(serializable_faces, pose_result, phone_result, emotion)

    return {
        "face": len(face_results) > 0,
        "face_count": len(face_results),
        "faces": serializable_faces,
        "emotion": emotion,
        "phone": phone_result,
        "pose": pose_result,
        "engagement": score_data,
    }

def _log_to_mongodb(result: dict, session_id: str):
    global _frame_count, _score_accumulator
    
    # ── 1. Always compute score regardless of DB status ──────────────────────
    face = result["faces"][0] if result.get("faces") else {}
    face_detected = result.get("face", False)
    phone_detected = result.get("phone", {}).get("phone_detected", False)
    asleep = face.get("asleep", False)
    gaze_away = face.get("gaze_away", False)
    yawning = face.get("yawning", False)

    score = compute_engagement_score(
        face_detected=face_detected,
        phone_detected=phone_detected,
        asleep=asleep,
        gaze_away=gaze_away,
        yawning=yawning,
    )

    if engagement_logs is None:
        return score

    # ── 2. Log to MongoDB if available (fire-and-forget) ─────────────────────
    try:
        doc = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "student_id": "demo_user",
            "session_id": session_id,
            "face_detected": face_detected,
            "face_count": result.get("face_count", 0),
            "emotion": result.get("emotion", "Unknown"),
            "phone_detected": phone_detected,
            "asleep": asleep,
            "gaze_away": gaze_away,
            "yawning": yawning,
            "engagement_score": score,
            "raw_faces_data": result.get("faces", [])[:1],
        }
        engagement_logs.insert_one(doc)
        _frame_count += 1
        _score_accumulator += score
        return score
    except Exception as e:
        print(f"[MongoDB] ⚠️ Failed to log engagement: {e}")
        return score

@router.post("/analyze")
async def analyze(request: Request):
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

    t0 = time.time()
    result = process_frame(frame)
    result["processing_time_ms"] = round((time.time() - t0) * 1000, 1)

    # Log to MongoDB and get simple score
    score = _log_to_mongodb(result, _session_id)
    result["score"] = score

    # ── Attention Check ───────────────────────────────────────────────────────
    ask_question, difficulty = update_attention_and_check_trigger(score)
    result["ask_question"] = ask_question
    result["difficulty"] = difficulty

    return _sanitize(result)
