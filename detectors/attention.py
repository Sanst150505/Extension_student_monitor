# detectors/attention.py

from collections import deque

# smooth last N frames
_HISTORY = {}
WINDOW = 10


def _get_history(face_id):
    if face_id not in _HISTORY:
        _HISTORY[face_id] = deque(maxlen=WINDOW)
    return _HISTORY[face_id]


def compute_attention(face, pose, phone):
    face_id = face["face_id"]
    history = _get_history(face_id)

    score = 100

    # 🚨 Hard conditions
    if face["asleep"]:
        return "Sleeping", 0

    # 👁️ Gaze
    if face["gaze_away"]:
        score -= 25

    # 🧠 Head direction
    if pose["head_direction"] != "Forward":
        score -= 20

    # 📱 Phone
    if phone["phone_detected"]:
        score -= 40

    # 😮 Yawning
    if face["yawning"]:
        score -= 15

    # 👀 Blink abnormal
    if face["blink_rate"] < 6:
        score -= 10

    score = max(0, min(100, score))

    # 📊 Smooth score
    history.append(score)
    smooth_score = sum(history) / len(history)

    # 🏷️ Label
    if smooth_score > 75:
        label = "Focused"
    elif smooth_score > 50:
        label = "Semi-Focused"
    elif smooth_score > 25:
        label = "Distracted"
    else:
        label = "Highly Distracted"

    return label, round(smooth_score, 1)