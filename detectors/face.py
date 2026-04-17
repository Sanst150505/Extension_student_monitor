"""
detectors/face.py
-----------------
Stable face detection + attention metrics.

Returns per-face:
  eyes_open, asleep, gaze_away, yawning, emotion (heuristic),
  ear, mar, bbox, face_id, blink_rate
"""

import time
import numpy as np
import mediapipe as mp

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

# All landmark indices used for bounding box computation
_ALL_FACE_OVAL = list(range(0, 468))  # all base landmarks

# ===============================
# Blink & Yawn State Tracking
# ===============================
_blink_state = {}       # face_id → {prev_ear, blink_count, last_reset, last_open}
_yawn_state = {}        # face_id → consecutive yawn frame count

_BLINK_EAR_THRESHOLD = 0.20   # below this = eye closed
_BLINK_REOPEN_THRESHOLD = 0.22
_YAWN_CONSECUTIVE_FRAMES = 3  # require 3+ frames of MAR > threshold


def _reset_blink_tracker(face_id: int):
    _blink_state[face_id] = {
        "prev_open": True,
        "blink_count": 0,
        "last_reset": time.time(),
    }


# ===============================
# Helper Functions
# ===============================
def _dist(p1, p2):
    return np.linalg.norm(np.array(p1) - np.array(p2))


def _ear(landmarks, eye_indices, w, h):
    pts = [(int(landmarks[i].x * w), int(landmarks[i].y * h)) for i in eye_indices]
    vertical = (_dist(pts[1], pts[5]) + _dist(pts[2], pts[4])) / 2.0
    horizontal = _dist(pts[0], pts[3]) + 1e-6
    return vertical / horizontal


def _mar(landmarks, w, h):
    top = (landmarks[MOUTH_TOP].x * w, landmarks[MOUTH_TOP].y * h)
    bottom = (landmarks[MOUTH_BOTTOM].x * w, landmarks[MOUTH_BOTTOM].y * h)
    left = (landmarks[MOUTH_LEFT].x * w, landmarks[MOUTH_LEFT].y * h)
    right = (landmarks[MOUTH_RIGHT].x * w, landmarks[MOUTH_RIGHT].y * h)
    return _dist(top, bottom) / (_dist(left, right) + 1e-6)


def _gaze_ratio(landmarks, eye_indices, iris_indices, w, h):
    eye_pts = [(landmarks[i].x * w, landmarks[i].y * h) for i in eye_indices]
    iris_pts = [(landmarks[i].x * w, landmarks[i].y * h) for i in iris_indices]

    iris_center = np.mean([p[0] for p in iris_pts])
    eye_left = eye_pts[0][0]
    eye_right = eye_pts[3][0]

    return (iris_center - eye_left) / (eye_right - eye_left + 1e-6)


def _compute_bbox(landmarks, w, h):
    """Compute tight bounding box from face landmarks."""
    xs = [int(landmarks[i].x * w) for i in range(min(468, len(landmarks)))]
    ys = [int(landmarks[i].y * h) for i in range(min(468, len(landmarks)))]
    margin = 10
    x1 = max(0, min(xs) - margin)
    y1 = max(0, min(ys) - margin)
    x2 = min(w, max(xs) + margin)
    y2 = min(h, max(ys) + margin)
    return (x1, y1, x2, y2)


def _update_blink_rate(face_id: int, ear: float) -> float:
    """
    Track blinks using EAR transitions (open→closed→open = 1 blink).
    Returns blinks per minute.
    """
    if face_id not in _blink_state:
        _reset_blink_tracker(face_id)

    state = _blink_state[face_id]
    currently_open = ear > _BLINK_REOPEN_THRESHOLD

    # Detect blink: was open, now closed
    if state["prev_open"] and not currently_open:
        state["blink_count"] += 1

    state["prev_open"] = currently_open

    # Compute rate (blinks per minute)
    elapsed = time.time() - state["last_reset"]
    if elapsed < 1.0:
        return 15.0  # default until we have data

    bpm = (state["blink_count"] / elapsed) * 60.0

    # Reset counter every 60 seconds to stay current
    if elapsed > 60.0:
        _reset_blink_tracker(face_id)

    return round(bpm, 1)


def _update_yawn_state(face_id: int, mar: float) -> bool:
    """
    Require MAR > threshold for multiple consecutive frames to confirm yawning.
    Prevents false positives from talking or brief mouth opening.
    """
    if face_id not in _yawn_state:
        _yawn_state[face_id] = 0

    if mar > 0.6:
        _yawn_state[face_id] += 1
    else:
        _yawn_state[face_id] = max(0, _yawn_state[face_id] - 1)

    return _yawn_state[face_id] >= _YAWN_CONSECUTIVE_FRAMES


# ===============================
# Main Function
# ===============================
def detect_face(frame):
    """
    Returns list of face data dicts with keys:
      eyes_open, asleep, gaze_away, yawning, emotion,
      ear, mar, bbox, face_id, blink_rate, landmarks
    """
    h, w = frame.shape[:2]

    try:
        rgb = frame[:, :, ::-1].copy()
        results = FACE_MESH.process(rgb)
    except Exception as e:
        print(f"[FaceDetector] FaceMesh error: {e}")
        return []

    if not results.multi_face_landmarks:
        return []

    faces = []

    for face_idx, face_lm in enumerate(results.multi_face_landmarks):
        lm = face_lm.landmark

        try:
            # ===== Bounding Box =====
            bbox = _compute_bbox(lm, w, h)

            # ===== Eye Aspect Ratio =====
            left_ear = _ear(lm, LEFT_EYE, w, h)
            right_ear = _ear(lm, RIGHT_EYE, w, h)
            ear = (left_ear + right_ear) / 2

            # Cast numpy.bool_ → Python bool (FastAPI can't serialize numpy types)
            eyes_open = bool(ear > 0.22)
            asleep = bool(ear < 0.18)

            # ===== Blink Rate =====
            blink_rate = float(_update_blink_rate(face_idx, ear))

            # ===== Gaze Detection =====
            gaze_away = False
            gaze = 0.5
            try:
                lg = _gaze_ratio(lm, LEFT_EYE, LEFT_IRIS, w, h)
                rg = _gaze_ratio(lm, RIGHT_EYE, RIGHT_IRIS, w, h)
                gaze = float((lg + rg) / 2)
                gaze_away = bool(gaze < 0.25 or gaze > 0.75)
            except Exception:
                pass

            # ===== Yawning (temporal) =====
            mar = float(_mar(lm, w, h))
            yawning = bool(_update_yawn_state(face_idx, mar))

            # ===== Emotion (Simple Heuristic) =====
            if asleep:
                emotion = "Sleepy"
            elif yawning:
                emotion = "Bored"
            elif gaze_away:
                emotion = "Distracted"
            else:
                emotion = "Focused"

            faces.append({
                "face_id": int(face_idx),
                "bbox": tuple(int(v) for v in bbox),
                "eyes_open": eyes_open,
                "asleep": asleep,
                "gaze_away": gaze_away,
                "gaze": round(float(gaze), 3),
                "yawning": yawning,
                "emotion": emotion,
                "ear": round(float(ear), 3),
                "mar": round(float(mar), 3),
                "blink_rate": blink_rate,
                "landmarks": lm,       # pass to pose.py for reuse
            })

        except Exception as e:
            print(f"[FaceDetector] Face {face_idx} processing error: {e}")

    return faces