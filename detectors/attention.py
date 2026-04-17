from collections import deque


_HISTORY = {}
WINDOW = 6


def _get_history(face_id):
    if face_id not in _HISTORY:
        _HISTORY[face_id] = deque(maxlen=WINDOW)
    return _HISTORY[face_id]


def compute_attention(face, pose, phone):
    face_id = face.get("face_id", 0)
    history = _get_history(face_id)

    if not face:
        history.append(0)
        return "Not Attentive", 0.0

    score = 100.0
    closed_frames = int(face.get("closed_frames", 0))

    if closed_frames >= 18:
        history.append(0)
        return "Sleeping", 0.0

    if face.get("gaze_away"):
        score -= 20
    if pose.get("head_direction") in {"Left", "Right"}:
        score -= 18
    elif pose.get("head_direction") == "Down":
        score -= 22
    elif pose.get("head_direction") == "Up":
        score -= 12
    if phone.get("phone_detected"):
        score -= 35
    if face.get("yawning"):
        score -= 10
    if closed_frames >= 10:
        score -= 40
    elif closed_frames >= 4 or face.get("eyes_closed"):
        score -= 20

    score = max(0.0, min(100.0, score))
    history.append(score)
    smooth_score = sum(history) / len(history)

    if smooth_score >= 80:
        label = "Focused"
    elif smooth_score >= 60:
        label = "Slightly Distracted"
    elif smooth_score >= 35:
        label = "Distracted"
    else:
        label = "Not Attentive"

    return label, round(smooth_score, 1)
