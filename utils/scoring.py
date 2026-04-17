"""
utils/scoring.py
----------------
Combines detector outputs into a single engagement score (0–100).

Weight table:
  Eye Attention    30 %
  Head Pose        15 %
  Yawning/Fatigue  15 %
  Emotion          10 %
  Phone Detection  10 %
  Participation    10 %   (hand raise)
  Presence         10 %

Output bands:
  80–100  → Engaged
  50–79   → Neutral
  <50     → Distracted
"""

from collections import deque

# ── Rolling average window (smooths jitter) ───────────────────────────────────
_WINDOW = 30                             # frames
_score_history: deque = deque(maxlen=_WINDOW)

# For the analytics graph (capped to prevent memory leak)
_MAX_TIMELINE = 10000
score_timeline: list[float] = []


def compute_score(
    face_results:  list[dict],
    pose_result:   dict,
    phone_result:  dict,
    emotion:       str,
) -> dict:
    """
    face_results  : list from detectors/face.py  (may be empty = no face)
    pose_result   : dict  from detectors/pose.py
    phone_result  : dict  from detectors/phone.py
    emotion       : str   from detectors/emotion.py

    Returns:
        raw_score    : int  0-100 (unsmoothed)
        smooth_score : int  0-100 (rolling average)
        status       : str  Engaged / Neutral / Distracted
        components   : dict breakdown of each sub-score
    """

    # ── Presence (10 %) ───────────────────────────────────────────────────────
    num_faces      = len(face_results)
    presence_score = 100 if num_faces == 1 else (50 if num_faces > 1 else 0)

    if num_faces == 0:
        # No face → immediate Distracted, skip rest
        _update_history(0)
        return _build(0, 0, "Distracted", {
            "presence": 0, "eye": 0, "head": 0,
            "fatigue": 0, "emotion": 0, "phone": 0, "participation": 0,
        })

    # Use primary face (face_id == 0)
    face = face_results[0]

    # ── Eye Attention (30 %) ──────────────────────────────────────────────────
    eye_score = 100
    if face.get("asleep", False):
        eye_score = 0
    elif not face.get("eyes_open", True):
        eye_score = 20
    elif face.get("gaze_away", False):
        eye_score = 40

    # Blink rate penalty: normal 10–20 bpm; very low (<5) or very high (>30) = tired
    blink = face.get("blink_rate", 15.0)
    if blink < 5 or blink > 30:
        eye_score = max(0, eye_score - 15)

    # ── Head Pose (15 %) ──────────────────────────────────────────────────────
    direction  = pose_result.get("head_direction", "Forward")
    head_score = {
        "Forward": 100,
        "Down":    20,    # possible phone / writing
        "Left":    50,
        "Right":   50,
        "Up":      70,
    }.get(direction, 70)

    # ── Yawning / Fatigue (15 %) ──────────────────────────────────────────────
    if face.get("yawning", False) or face.get("asleep", False):
        fatigue_score = 0
    elif face.get("ear", 0.25) < 0.22:
        fatigue_score = 40   # drowsy
    else:
        fatigue_score = 100

    # ── Emotion (10 %) ────────────────────────────────────────────────────────
    emotion_score = {
        "Happy":      100,
        "Focused":     90,
        "Neutral":     80,
        "Surprised":   70,
        "Confused":    60,
        "Distracted":  40,
        "Bored":       30,
        "Sleepy":      10,
    }.get(emotion, 80)

    # ── Phone Detection (10 %) ────────────────────────────────────────────────
    phone_score = 0 if phone_result.get("phone_detected") else 100

    # ── Participation (10 %) ─────────────────────────────────────────────────
    participation_score = 100 if pose_result.get("hand_raised") else 60

    # ── Weighted sum ──────────────────────────────────────────────────────────
    components = {
        "presence":      presence_score,
        "eye":           eye_score,
        "head":          head_score,
        "fatigue":       fatigue_score,
        "emotion":       emotion_score,
        "phone":         phone_score,
        "participation": participation_score,
    }

    weights = {
        "presence":      0.10,
        "eye":           0.30,
        "head":          0.15,
        "fatigue":       0.15,
        "emotion":       0.10,
        "phone":         0.10,
        "participation": 0.10,
    }

    raw = sum(components[k] * weights[k] for k in components)
    raw = int(max(0, min(100, raw)))

    smooth = _update_history(raw)
    status = _status(smooth)

    # Cap timeline to prevent unbounded growth
    if len(score_timeline) < _MAX_TIMELINE:
        score_timeline.append(smooth)

    return _build(raw, smooth, status, components)


# ── Helpers ───────────────────────────────────────────────────────────────────
def _update_history(raw: int) -> int:
    _score_history.append(raw)
    return int(sum(_score_history) / len(_score_history))


def _status(score: int) -> str:
    if score >= 80:
        return "Engaged"
    if score >= 50:
        return "Neutral"
    return "Distracted"


def _build(raw, smooth, status, components) -> dict:
    return {
        "raw_score":    raw,
        "smooth_score": smooth,
        "status":       status,
        "components":   components,
    }


def reset():
    """Reset scoring state (useful between sessions)."""
    _score_history.clear()
    score_timeline.clear()