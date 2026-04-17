"""
detectors/pose.py
-----------------
Handles:
  - Head pose estimation (forward / left / right / down / up)
  - Hand raise detection (wrist above shoulder via MediaPipe Pose)

Note on pitch sign convention:
  cv2.decomposeProjectionMatrix returns pitch where positive = looking down
  in most webcam setups. If your camera is mounted differently, you may need
  to negate the pitch value.
"""

import numpy as np
import mediapipe as mp

# ── MediaPipe Pose ────────────────────────────────────────────────────────────
_mp_pose = mp.solutions.pose
POSE = _mp_pose.Pose(
    static_image_mode=False,
    model_complexity=0,          # 0 = fastest (Lite)
    smooth_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

# ── MediaPipe Face-Mesh (used only for head-pose; reuse frame result) ─────────
_mp_face_mesh = mp.solutions.face_mesh
_HEAD_POSE_MESH = _mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=False,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

# ── 3-D model points for solvePnP ────────────────────────────────────────────
# Generic human face model (mm units, origin at nose tip)
_MODEL_POINTS = np.array([
    (0.0,     0.0,    0.0),    # Nose tip          (1)
    (0.0,   -63.6,  -12.5),   # Chin              (152)
    (-43.3,  32.7,  -26.0),   # Left eye corner   (263)
    (43.3,   32.7,  -26.0),   # Right eye corner  (33)
    (-28.9, -28.9,  -24.1),   # Left mouth corner (287)
    (28.9,  -28.9,  -24.1),   # Right mouth corner(57)
], dtype=np.float64)

# Corresponding landmark indices in Face Mesh
_LM_IDX = [1, 152, 263, 33, 287, 57]


def _head_pose(frame, face_landmarks) -> dict:
    """
    Estimate yaw / pitch / roll from face landmarks.
    Returns dict with keys: yaw, pitch, roll, direction
    direction ∈ {'Forward', 'Left', 'Right', 'Down', 'Up'}
    """
    h, w = frame.shape[:2]
    focal   = w
    cam_mat = np.array([
        [focal, 0,     w / 2],
        [0,     focal, h / 2],
        [0,     0,     1    ],
    ], dtype=np.float64)
    dist_coeffs = np.zeros((4, 1), dtype=np.float64)

    # Extract 2-D image points
    img_pts = []
    for idx in _LM_IDX:
        lm = face_landmarks[idx]
        img_pts.append((lm.x * w, lm.y * h))
    img_pts = np.array(img_pts, dtype=np.float64)

    ok, rvec, tvec = _cv_solvePnP(_MODEL_POINTS, img_pts, cam_mat, dist_coeffs)
    if not ok:
        return {"yaw": 0, "pitch": 0, "roll": 0, "direction": "Forward"}

    # Convert rotation vector to Euler angles
    cv2 = _import_cv2()
    rot_mat, _ = cv2.Rodrigues(rvec)
    proj_mat    = np.hstack((rot_mat, tvec))
    _, _, _, _, _, _, euler = cv2.decomposeProjectionMatrix(proj_mat)
    pitch, yaw, roll = [float(a) for a in euler.flatten()]

    # Direction heuristic
    if pitch > 10:
        direction = "Down"
    elif pitch < -10:
        direction = "Up"
    elif yaw < -20:
        direction = "Right"
    elif yaw > 20:
        direction = "Left"
    else:
        direction = "Forward"

    return {
        "yaw":       round(yaw,   1),
        "pitch":     round(pitch, 1),
        "roll":      round(roll,  1),
        "direction": direction,
    }


# ── Lazy OpenCV import (avoids circular issues) ───────────────────────────────
_cv2 = None
def _import_cv2():
    global _cv2
    if _cv2 is None:
        import cv2 as _cv2_mod
        _cv2 = _cv2_mod
    return _cv2

def _cv_solvePnP(obj_pts, img_pts, cam_mat, dist):
    cv2 = _import_cv2()
    return cv2.solvePnP(obj_pts, img_pts, cam_mat, dist, flags=cv2.SOLVEPNP_ITERATIVE)


# ── Hand raise detection ──────────────────────────────────────────────────────
def _hand_raised(pose_landmarks, h) -> bool:
    """Return True if either wrist is above the corresponding shoulder."""
    lm = pose_landmarks.landmark
    L  = _mp_pose.PoseLandmark

    left_wrist    = lm[L.LEFT_WRIST].y    * h
    right_wrist   = lm[L.RIGHT_WRIST].y   * h
    left_shoulder = lm[L.LEFT_SHOULDER].y * h
    right_shoulder= lm[L.RIGHT_SHOULDER].y* h

    # In image coordinates y increases downward, so wrist ABOVE shoulder ⟺ wrist.y < shoulder.y
    return bool((left_wrist < left_shoulder - 20) or (right_wrist < right_shoulder - 20))


# ── Public API ────────────────────────────────────────────────────────────────
def detect_pose(frame, face_landmarks=None) -> dict:
    """
    Process one BGR frame.
    face_landmarks: optional pre-computed mediapipe face landmark list (face 0).
                    Pass face_result["landmarks"] from face.py to avoid running
                    a second FaceMesh instance.

    Returns dict:
        head_direction : str
        yaw / pitch / roll : float
        hand_raised    : bool
    """
    h, w = frame.shape[:2]
    rgb  = frame[:, :, ::-1].copy()

    # ── Head pose ─────────────────────────────────────────────────────────────
    head_result = {"yaw": 0.0, "pitch": 0.0, "roll": 0.0, "direction": "Forward"}

    lm_source = face_landmarks
    if lm_source is None:
        # Run a dedicated single-face mesh just for head pose
        res = _HEAD_POSE_MESH.process(rgb)
        if res.multi_face_landmarks:
            lm_source = res.multi_face_landmarks[0].landmark

    if lm_source is not None:
        try:
            head_result = _head_pose(frame, lm_source)
        except Exception as e:
            print(f"[PoseDetector] Head pose error: {e}")

    # ── Hand raise via Pose ───────────────────────────────────────────────────
    pose_res   = POSE.process(rgb)
    hand_raised = False
    if pose_res.pose_landmarks:
        try:
            hand_raised = bool(_hand_raised(pose_res.pose_landmarks, h))
        except Exception as e:
            print(f"[PoseDetector] Hand raise error: {e}")

    return {
        "head_direction": str(head_result["direction"]),
        "yaw":            float(head_result["yaw"]),
        "pitch":          float(head_result["pitch"]),
        "roll":           float(head_result["roll"]),
        "hand_raised":    bool(hand_raised),
    }