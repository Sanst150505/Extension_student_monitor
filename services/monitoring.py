from __future__ import annotations

import time
from collections import Counter, deque
from dataclasses import dataclass, field


LOG_INTERVAL_SECONDS = 4
QUESTION_COOLDOWN_SECONDS = 45
LOW_SCORE_THRESHOLD = 55
LOW_SCORE_STREAK = 2
QUESTION_PENDING_TIMEOUT_SECONDS = 40
MAX_HISTORY = 8


@dataclass
class MonitorState:
    score_history: deque = field(default_factory=lambda: deque(maxlen=MAX_HISTORY))
    emotion_history: deque = field(default_factory=lambda: deque(maxlen=MAX_HISTORY))
    attention_history: deque = field(default_factory=lambda: deque(maxlen=MAX_HISTORY))
    previous_score: float = 85.0
    low_score_streak: int = 0
    last_log_at: float = 0.0
    last_question_at: float = 0.0
    pending_question_id: str | None = None
    pending_question_started_at: float = 0.0


_STATE: dict[str, MonitorState] = {}


def build_monitor_key(identity: dict) -> str:
    return "::".join(
        [
            identity.get("student_id", "unknown"),
            identity.get("subject", "General"),
            identity.get("batch", "General"),
            identity.get("session_id", "demo_session"),
        ]
    )


def get_state(identity: dict) -> MonitorState:
    key = build_monitor_key(identity)
    if key not in _STATE:
        _STATE[key] = MonitorState()
    return _STATE[key]


def _majority_label(history: deque, fallback: str) -> str:
    if not history:
        return fallback
    return Counter(history).most_common(1)[0][0]


def _frame_emotion(face_detected: bool, face: dict, pose_result: dict, phone_result: dict) -> str:
    if not face_detected:
        return "No Face"

    closed_frames = int(face.get("closed_frames", 0))
    eyes_closed = bool(face.get("eyes_closed", False))
    yawning = bool(face.get("yawning", False))
    gaze_away = bool(face.get("gaze_away", False))
    phone_detected = bool(phone_result.get("phone_detected", False))
    head_direction = pose_result.get("head_direction", "Unknown")

    if closed_frames >= 18:
        return "Sleepy"
    if (eyes_closed and closed_frames >= 10) or yawning:
        return "Drowsy"
    if phone_detected or gaze_away or head_direction in {"Left", "Right", "Down", "Up"}:
        return "Distracted"
    return "Engaged"


def _compute_raw_score(face_detected: bool, face: dict, pose_result: dict, phone_result: dict) -> tuple[float, dict]:
    if not face_detected:
        return 0.0, {
            "base": 0,
            "gaze_penalty": 0,
            "head_penalty": 0,
            "phone_penalty": 0,
            "eye_penalty": 0,
            "yawn_penalty": 0,
        }

    score = 100.0
    closed_frames = int(face.get("closed_frames", 0))
    eyes_closed = bool(face.get("eyes_closed", False))
    yawning = bool(face.get("yawning", False))
    gaze_away = bool(face.get("gaze_away", False))
    phone_detected = bool(phone_result.get("phone_detected", False))
    head_direction = pose_result.get("head_direction", "Unknown")

    gaze_penalty = 20 if gaze_away else 0
    phone_penalty = 35 if phone_detected else 0
    yawn_penalty = 10 if yawning else 0
    eye_penalty = 0
    head_penalty = 0

    if head_direction in {"Left", "Right"}:
        head_penalty = 18
    elif head_direction == "Down":
        head_penalty = 22
    elif head_direction == "Up":
        head_penalty = 12

    if closed_frames >= 18:
        eye_penalty = 65
    elif closed_frames >= 10:
        eye_penalty = 40
    elif eyes_closed or closed_frames >= 4:
        eye_penalty = 20

    score -= gaze_penalty + head_penalty + phone_penalty + eye_penalty + yawn_penalty
    return max(0.0, min(100.0, score)), {
        "base": 100,
        "gaze_penalty": -gaze_penalty,
        "head_penalty": -head_penalty,
        "phone_penalty": -phone_penalty,
        "eye_penalty": -eye_penalty,
        "yawn_penalty": -yawn_penalty,
    }


def _attention_label(score: float, emotion: str) -> str:
    if emotion == "Sleepy":
        return "Sleeping"
    if emotion == "No Face":
        return "Not Attentive"
    if score >= 80:
        return "Focused"
    if score >= 60:
        return "Slightly Distracted"
    if score >= 35:
        return "Distracted"
    return "Not Attentive"


def _difficulty_for_score(score: float) -> str:
    if score < 30:
        return "easy"
    if score < 55:
        return "medium"
    return "hard"


def evaluate_monitoring(identity: dict, face_results: list[dict], pose_result: dict, phone_result: dict) -> dict:
    face = face_results[0] if face_results else {}
    face_detected = bool(face_results)
    state = get_state(identity)

    frame_emotion = _frame_emotion(face_detected, face, pose_result, phone_result)
    raw_score, components = _compute_raw_score(face_detected, face, pose_result, phone_result)

    smooth_score = round((state.previous_score * 0.35) + (raw_score * 0.65), 1)
    state.previous_score = smooth_score

    state.emotion_history.append(frame_emotion)
    stable_emotion = _majority_label(state.emotion_history, frame_emotion)

    attention_status = _attention_label(smooth_score, stable_emotion)
    state.attention_history.append(attention_status)
    stable_attention = _majority_label(state.attention_history, attention_status)

    state.score_history.append(smooth_score)
    if smooth_score < LOW_SCORE_THRESHOLD:
        state.low_score_streak += 1
    else:
        state.low_score_streak = 0

    now = time.time()
    if state.pending_question_id and now - state.pending_question_started_at >= QUESTION_PENDING_TIMEOUT_SECONDS:
        state.pending_question_id = None
        state.pending_question_started_at = 0.0

    raw_attention_status = _attention_label(raw_score, frame_emotion)
    high_risk_state = raw_attention_status in {"Not Attentive", "Sleeping"} or frame_emotion in {"Sleepy", "No Face"}
    ask_question = (
        (state.low_score_streak >= LOW_SCORE_STREAK or high_risk_state or raw_score <= 30)
        and now - state.last_question_at >= QUESTION_COOLDOWN_SECONDS
        and not state.pending_question_id
    )

    return {
        "raw_score": round(raw_score, 1),
        "smooth_score": smooth_score,
        "score": smooth_score,
        "status": stable_attention,
        "attention_status": stable_attention,
        "current_state": stable_emotion,
        "emotion": stable_emotion,
        "gaze_status": "Away" if face.get("gaze_away") else "Centered",
        "components": components,
        "signals": {
            "eyes_closed": bool(face.get("eyes_closed", False)),
            "closed_frames": int(face.get("closed_frames", 0)),
            "yawning": bool(face.get("yawning", False)),
            "gaze_away": bool(face.get("gaze_away", False)),
            "head_direction": pose_result.get("head_direction", "Unknown"),
            "phone_detected": bool(phone_result.get("phone_detected", False)),
        },
        "intervention": {
            "ask_question": ask_question,
            "difficulty": _difficulty_for_score(smooth_score),
            "cooldown_seconds_remaining": max(0, int(QUESTION_COOLDOWN_SECONDS - (now - state.last_question_at))),
            "low_score_streak": state.low_score_streak,
            "trigger_reason": (
                "persistent_low_attention"
                if state.low_score_streak >= LOW_SCORE_STREAK
                else "high_risk_state"
                if high_risk_state
                else "critical_raw_score"
                if raw_score <= 30
                else None
            ),
        },
    }


def should_log(identity: dict) -> bool:
    state = get_state(identity)
    now = time.time()
    if now - state.last_log_at >= LOG_INTERVAL_SECONDS:
        state.last_log_at = now
        return True
    return False


def mark_question_sent(identity: dict, question_id: str) -> None:
    state = get_state(identity)
    state.last_question_at = time.time()
    state.pending_question_id = question_id
    state.pending_question_started_at = state.last_question_at


def mark_question_answered(identity: dict, question_id: str | None = None) -> None:
    state = get_state(identity)
    if question_id is None or state.pending_question_id == question_id:
        state.pending_question_id = None
        state.pending_question_started_at = 0.0


def reset() -> None:
    _STATE.clear()
