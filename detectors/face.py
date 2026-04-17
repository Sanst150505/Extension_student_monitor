"""
detectors/face.py
-----------------
Simple and stable face signal extraction for demo use.

Outputs:
- face detected
- eye openness using EAR
- gaze direction
- yawning
"""

import numpy as np
import mediapipe as mp

mp_face_mesh = mp.solutions.face_mesh

FACE_MESH = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

LEFT_EYE = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]
LEFT_IRIS = [468, 469, 470, 471, 472]
RIGHT_IRIS = [473, 474, 475, 476, 477]

MOUTH_TOP = 13
MOUTH_BOTTOM = 14
MOUTH_LEFT = 61
MOUTH_RIGHT = 291

EAR_THRESHOLD = 0.20
CLOSED_EYE_FRAMES = 8
YAWN_THRESHOLD = 0.55
YAWN_CONSECUTIVE_FRAMES = 3
GAZE_LEFT_THRESHOLD = 0.42
GAZE_RIGHT_THRESHOLD = 0.58

_eye_state = {
    "closed_frames": 0,
}
_yawn_state = {
    "frames": 0,
}


def _dist(p1, p2):
    return np.linalg.norm(np.array(p1) - np.array(p2))


def _ear(landmarks, indexes, width, height):
    points = [(landmarks[i].x * width, landmarks[i].y * height) for i in indexes]
    vertical = (_dist(points[1], points[5]) + _dist(points[2], points[4])) / 2.0
    horizontal = _dist(points[0], points[3]) + 1e-6
    return vertical / horizontal


def _mar(landmarks, width, height):
    top = (landmarks[MOUTH_TOP].x * width, landmarks[MOUTH_TOP].y * height)
    bottom = (landmarks[MOUTH_BOTTOM].x * width, landmarks[MOUTH_BOTTOM].y * height)
    left = (landmarks[MOUTH_LEFT].x * width, landmarks[MOUTH_LEFT].y * height)
    right = (landmarks[MOUTH_RIGHT].x * width, landmarks[MOUTH_RIGHT].y * height)
    return _dist(top, bottom) / (_dist(left, right) + 1e-6)


def _gaze_ratio(landmarks, eye_indexes, iris_indexes, width):
    eye_points = [(landmarks[i].x * width) for i in eye_indexes]
    iris_points = [(landmarks[i].x * width) for i in iris_indexes]
    iris_center = float(np.mean(iris_points))
    eye_left = eye_points[0]
    eye_right = eye_points[3]
    return (iris_center - eye_left) / (eye_right - eye_left + 1e-6)


def _bbox(landmarks, width, height):
    xs = [int(point.x * width) for point in landmarks[:468]]
    ys = [int(point.y * height) for point in landmarks[:468]]
    return (min(xs), min(ys), max(xs), max(ys))


def detect_face(frame):
    height, width = frame.shape[:2]
    rgb = frame[:, :, ::-1]

    result = FACE_MESH.process(rgb)
    if not result.multi_face_landmarks:
      _eye_state["closed_frames"] = 0
      _yawn_state["frames"] = 0
      return []

    face_landmarks = result.multi_face_landmarks[0].landmark

    left_ear = _ear(face_landmarks, LEFT_EYE, width, height)
    right_ear = _ear(face_landmarks, RIGHT_EYE, width, height)
    ear = (left_ear + right_ear) / 2.0

    if ear < EAR_THRESHOLD:
        _eye_state["closed_frames"] += 1
    else:
        _eye_state["closed_frames"] = 0

    eyes_closed = _eye_state["closed_frames"] >= CLOSED_EYE_FRAMES

    mar = _mar(face_landmarks, width, height)
    if mar > YAWN_THRESHOLD:
        _yawn_state["frames"] += 1
    else:
        _yawn_state["frames"] = 0
    yawning = _yawn_state["frames"] >= YAWN_CONSECUTIVE_FRAMES

    gaze_left = _gaze_ratio(face_landmarks, LEFT_EYE, LEFT_IRIS, width)
    gaze_right = _gaze_ratio(face_landmarks, RIGHT_EYE, RIGHT_IRIS, width)
    gaze_ratio = (gaze_left + gaze_right) / 2.0

    if gaze_ratio < GAZE_LEFT_THRESHOLD:
        gaze_direction = "Left"
    elif gaze_ratio > GAZE_RIGHT_THRESHOLD:
        gaze_direction = "Right"
    else:
        gaze_direction = "Center"

    gaze_away = gaze_direction != "Center"

    return [
        {
            "face_id": 0,
            "bbox": _bbox(face_landmarks, width, height),
            "ear": round(ear, 3),
            "mar": round(mar, 3),
            "eyes_open": not eyes_closed,
            "eyes_closed": eyes_closed,
            "closed_frames": _eye_state["closed_frames"],
            "yawning": yawning,
            "gaze_ratio": round(gaze_ratio, 3),
            "gaze_direction": gaze_direction,
            "gaze_away": gaze_away,
            "landmarks": face_landmarks,
        }
    ]
