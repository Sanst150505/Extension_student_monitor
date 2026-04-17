"""
detectors/face.py
-----------------
Stable face detection + STRONG gaze + attention signals.
"""

import time
import numpy as np
import mediapipe as mp
from collections import deque

# ===============================
# MediaPipe Setup
# ===============================
mp_face_mesh = mp.solutions.face_mesh

FACE_MESH = mp_face_mesh.FaceMesh(
    max_num_faces=2,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

# ===============================
# Landmark Indexes
# ===============================
LEFT_EYE  = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]

LEFT_IRIS  = [468, 469, 470, 471, 472]
RIGHT_IRIS = [473, 474, 475, 476, 477]

MOUTH_TOP = 13
MOUTH_BOTTOM = 14
MOUTH_LEFT = 61
MOUTH_RIGHT = 291

# ===============================
# State Tracking
# ===============================
_blink_state = {}
_yawn_state = {}
_gaze_history = {}

# ===============================
# Thresholds
# ===============================
_BLINK_REOPEN_THRESHOLD = 0.22
_YAWN_CONSECUTIVE_FRAMES = 3

CENTER_MIN = 0.45
CENTER_MAX = 0.55

# ===============================
# Helper Functions
# ===============================
def _dist(p1, p2):
    return np.linalg.norm(np.array(p1) - np.array(p2))


def _ear(lm, idx, w, h):
    pts = [(lm[i].x * w, lm[i].y * h) for i in idx]
    vertical = (_dist(pts[1], pts[5]) + _dist(pts[2], pts[4])) / 2.0
    horizontal = _dist(pts[0], pts[3]) + 1e-6
    return vertical / horizontal


def _mar(lm, w, h):
    top = (lm[MOUTH_TOP].x * w, lm[MOUTH_TOP].y * h)
    bottom = (lm[MOUTH_BOTTOM].x * w, lm[MOUTH_BOTTOM].y * h)
    left = (lm[MOUTH_LEFT].x * w, lm[MOUTH_LEFT].y * h)
    right = (lm[MOUTH_RIGHT].x * w, lm[MOUTH_RIGHT].y * h)
    return _dist(top, bottom) / (_dist(left, right) + 1e-6)


def _gaze_ratio(lm, eye_idx, iris_idx, w, h):
    eye_pts = [(lm[i].x * w, lm[i].y * h) for i in eye_idx]
    iris_pts = [(lm[i].x * w, lm[i].y * h) for i in iris_idx]

    iris_center = np.mean([p[0] for p in iris_pts])
    eye_left = eye_pts[0][0]
    eye_right = eye_pts[3][0]

    return (iris_center - eye_left) / (eye_right - eye_left + 1e-6)


def _smooth_gaze(face_id, gaze):
    if face_id not in _gaze_history:
        _gaze_history[face_id] = deque(maxlen=5)

    _gaze_history[face_id].append(gaze)
    return sum(_gaze_history[face_id]) / len(_gaze_history[face_id])


def _update_blink_rate(face_id, ear):
    if face_id not in _blink_state:
        _blink_state[face_id] = {
            "prev_open": True,
            "count": 0,
            "last_reset": time.time(),
        }

    state = _blink_state[face_id]
    open_now = ear > _BLINK_REOPEN_THRESHOLD

    if state["prev_open"] and not open_now:
        state["count"] += 1

    state["prev_open"] = open_now

    elapsed = time.time() - state["last_reset"]
    if elapsed < 1:
        return 15.0

    bpm = (state["count"] / elapsed) * 60.0

    if elapsed > 60:
        _blink_state[face_id]["count"] = 0
        _blink_state[face_id]["last_reset"] = time.time()

    return round(bpm, 1)


def _update_yawn(face_id, mar):
    if face_id not in _yawn_state:
        _yawn_state[face_id] = 0

    if mar > 0.6:
        _yawn_state[face_id] += 1
    else:
        _yawn_state[face_id] = max(0, _yawn_state[face_id] - 1)

    return _yawn_state[face_id] >= _YAWN_CONSECUTIVE_FRAMES


def _bbox(lm, w, h):
    xs = [int(p.x * w) for p in lm[:468]]
    ys = [int(p.y * h) for p in lm[:468]]
    return (min(xs), min(ys), max(xs), max(ys))


# ===============================
# Main Function
# ===============================
def detect_face(frame):
    h, w = frame.shape[:2]
    rgb = frame[:, :, ::-1]

    try:
        res = FACE_MESH.process(rgb)
    except Exception as e:
        print("FaceMesh error:", e)
        return []

    if not res.multi_face_landmarks:
        return []

    faces = []

    for i, face in enumerate(res.multi_face_landmarks):
        lm = face.landmark

        try:
            # EAR
            ear = (_ear(lm, LEFT_EYE, w, h) + _ear(lm, RIGHT_EYE, w, h)) / 2
            asleep = ear < 0.18

            # Blink
            blink_rate = _update_blink_rate(i, ear)

            # Yawn
            mar = _mar(lm, w, h)
            yawning = _update_yawn(i, mar)

            # ===== GAZE (FIXED + STRONG) =====
            gaze = 0.5
            gaze_dir = "Center"
            gaze_away = False

            try:
                lg = _gaze_ratio(lm, LEFT_EYE, LEFT_IRIS, w, h)
                rg = _gaze_ratio(lm, RIGHT_EYE, RIGHT_IRIS, w, h)
                gaze = (lg + rg) / 2

                # Smooth
                gaze = _smooth_gaze(i, gaze)

                # Strict classification
                if gaze < CENTER_MIN:
                    gaze_dir = "Left"
                    gaze_away = True
                elif gaze > CENTER_MAX:
                    gaze_dir = "Right"
                    gaze_away = True
                else:
                    gaze_dir = "Center"

                # Debug
                print(f"[Gaze] {gaze:.2f} → {gaze_dir}")

            except Exception as e:
                print("Gaze error:", e)

            # Emotion
            if asleep:
                emotion = "Sleepy"
            elif yawning:
                emotion = "Bored"
            elif gaze_away:
                emotion = "Distracted"
            else:
                emotion = "Focused"

            faces.append({
                "face_id": i,
                "bbox": _bbox(lm, w, h),
                "ear": round(ear, 3),
                "mar": round(mar, 3),
                "blink_rate": blink_rate,
                "asleep": asleep,
                "yawning": yawning,
                "gaze": round(gaze, 3),
                "gaze_direction": gaze_dir,
                "gaze_away": gaze_away,
                "emotion": emotion,
                "landmarks": lm,
            })

        except Exception as e:
            print("Face error:", e)

    return faces