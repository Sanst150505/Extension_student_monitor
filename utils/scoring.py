"""
utils/scoring.py
----------------
Simple stable engagement scoring for hackathon demo.
"""

import time
from collections import deque

STATE_BUFFER_SIZE = 20
NO_FACE_TIMEOUT_SECONDS = 1.0

_previous_score = 70.0
_state_buffer = deque(maxlen=STATE_BUFFER_SIZE)
_last_face_seen_at = 0.0


def _base_state(face_detected, eyes_closed, gaze_away, head_direction, yawning):
    if not face_detected:
        return "No Face"
    if eyes_closed or yawning:
        return "Sleepy"
    if gaze_away or head_direction in {"Left", "Right"}:
        return "Distracted"
    return "Attentive"


def _smoothed_state(current_state):
    _state_buffer.append(current_state)
    counts = {}
    for state in _state_buffer:
        counts[state] = counts.get(state, 0) + 1
    return max(counts, key=counts.get)


def _emotion_for_state(state, gaze_away):
    if state == "Sleepy":
        return "Sleepy"
    if state == "Distracted" or gaze_away:
        return "Bored"
    if state == "No Face":
        return "No Face"
    return "Engaged"


def compute_score(face_results, pose_result, phone_result, emotion):
    global _previous_score, _last_face_seen_at

    now = time.time()
    face = face_results[0] if face_results else {}
    face_detected = len(face_results) > 0

    if face_detected:
        _last_face_seen_at = now

    no_face_active = (not face_detected) and ((now - _last_face_seen_at) > NO_FACE_TIMEOUT_SECONDS)
    eyes_closed = bool(face.get("eyes_closed", False))
    gaze_away = bool(face.get("gaze_away", False))
    yawning = bool(face.get("yawning", False))
    head_direction = pose_result.get("head_direction", "Unknown")
    phone_detected = bool(phone_result.get("phone_detected", False))

    current_state = _base_state(
        face_detected=not no_face_active,
        eyes_closed=eyes_closed,
        gaze_away=gaze_away,
        head_direction=head_direction,
        yawning=yawning,
    )
    stable_state = _smoothed_state(current_state)

    raw_score = 70
    if stable_state == "Attentive":
        raw_score += 20
    if gaze_away or head_direction in {"Left", "Right"}:
        raw_score -= 20
    if eyes_closed:
        raw_score -= 40
    if phone_detected:
        raw_score -= 30
    if stable_state == "No Face":
        raw_score = 0

    raw_score = max(0, min(100, raw_score))
    smooth_score = round(0.6 * _previous_score + 0.4 * raw_score, 1)
    _previous_score = smooth_score

    final_emotion = _emotion_for_state(stable_state, gaze_away) if emotion in {"Engaged", "Bored", "Sleepy", "No Face"} else emotion

    return {
        "raw_score": raw_score,
        "smooth_score": smooth_score,
        "status": stable_state,
        "current_state": stable_state,
        "emotion": final_emotion,
        "gaze_status": "Away" if gaze_away else "Centered",
        "components": {
            "base": 70,
            "attention_bonus": 20 if stable_state == "Attentive" else 0,
            "gaze_penalty": -20 if (gaze_away or head_direction in {"Left", "Right"}) else 0,
            "eyes_penalty": -40 if eyes_closed else 0,
            "phone_penalty": -30 if phone_detected else 0,
        },
        "buffer_size": len(_state_buffer),
    }


def reset():
    global _previous_score, _last_face_seen_at
    _previous_score = 70.0
    _last_face_seen_at = 0.0
    _state_buffer.clear()
