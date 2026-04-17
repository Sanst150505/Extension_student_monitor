"""Attention scoring helpers for live student telemetry."""

from __future__ import annotations

from typing import Any


def _clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


def _bool_score(flag: Any) -> float:
    return 100.0 if bool(flag) else 0.0


def _gaze_score(payload: dict[str, Any]) -> float:
    if payload.get("gaze_away"):
        return 25.0

    direction = str(payload.get("gaze_direction", "center")).strip().lower()
    if direction in {"center", "forward"}:
        return 100.0
    if direction in {"left", "right"}:
        return 60.0
    return 40.0


def _head_pose_score(payload: dict[str, Any]) -> float:
    pose = str(payload.get("head_pose", "forward")).strip().lower()
    if pose in {"forward", "center"}:
        return 100.0
    if pose in {"left", "right"}:
        return 65.0
    if pose in {"up"}:
        return 75.0
    if pose in {"down"}:
        return 25.0
    return 55.0


def _blink_score(blink_rate: Any) -> float:
    try:
        blink = float(blink_rate)
    except (TypeError, ValueError):
        blink = 0.0

    if 8.0 <= blink <= 25.0:
        return 100.0
    if 5.0 <= blink < 8.0 or 25.0 < blink <= 30.0:
        return 75.0
    if blink > 0.0:
        return 45.0
    return 0.0


def compute_attention_score(payload: dict[str, Any]) -> dict[str, Any]:
    face_score = _bool_score(payload.get("face_detected"))
    gaze_score = _gaze_score(payload)
    head_score = _head_pose_score(payload)
    blink_score = _blink_score(payload.get("blink_rate"))
    yawning = bool(payload.get("yawning"))
    no_yawn_score = 0.0 if yawning else 100.0

    score = (
        0.40 * face_score
        + 0.20 * gaze_score
        + 0.15 * head_score
        + 0.15 * blink_score
        + 0.10 * no_yawn_score
    )
    score = round(_clamp(score), 1)

    if yawning:
        status = "Bored"
    elif score > 75:
        status = "Focused"
    elif score >= 50:
        status = "Slightly distracted"
    else:
        status = "Highly distracted"

    components = {
        "face": round(face_score, 1),
        "gaze": round(gaze_score, 1),
        "head_pose": round(head_score, 1),
        "blink": round(blink_score, 1),
        "no_yawning": round(no_yawn_score, 1),
    }

    return {
        "score": score,
        "status": status,
        "components": components,
        "metrics": {
            "face_detected": bool(payload.get("face_detected")),
            "gaze_direction": payload.get("gaze_direction", "center"),
            "head_pose": payload.get("head_pose", "forward"),
            "blink_rate": payload.get("blink_rate", 0),
            "yawning": yawning,
        },
    }


def update_streak_and_badges(student_doc: dict[str, Any] | None, score: float) -> dict[str, Any]:
    current_streak = int((student_doc or {}).get("streak", 0))
    if score > 75:
        current_streak += 1
    else:
        current_streak = 0

    badges: list[str] = list((student_doc or {}).get("badges", []))
    if current_streak >= 10 and "Focused 10 min" not in badges:
        badges.append("Focused 10 min")
    if current_streak >= 30 and "Focus Master" not in badges:
        badges.append("Focus Master")

    badge = badges[-1] if badges else ""

    return {
        "streak": current_streak,
        "badge": badge,
        "badges": badges,
    }