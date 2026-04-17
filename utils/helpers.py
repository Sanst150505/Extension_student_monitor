"""
utils/helpers.py
----------------
  - draw_overlay()  : renders all HUD elements on the frame
  - AlertManager    : throttled "Please focus" alerts (screen + optional TTS)
  - FPSCounter      : rolling FPS calculation
"""

import time
import cv2
import numpy as np
from collections import deque

# ── Optional TTS ──────────────────────────────────────────────────────────────
_tts_engine = None
def _get_tts():
    global _tts_engine
    if _tts_engine is not None:
        return _tts_engine
    try:
        import pyttsx3
        _tts_engine = pyttsx3.init()
        _tts_engine.setProperty("rate", 160)
    except Exception:
        _tts_engine = False
    return _tts_engine


# ── Colour palette ────────────────────────────────────────────────────────────
C_GREEN   = (50,  220, 80)
C_YELLOW  = (30,  200, 240)
C_RED     = (50,  50,  240)
C_WHITE   = (255, 255, 255)
C_BLACK   = (0,   0,   0)
C_CYAN    = (220, 210, 50)
C_ORANGE  = (0,   165, 255)
C_PURPLE  = (200, 80,  180)

STATUS_COLORS = {
    "Engaged":    C_GREEN,
    "Neutral":    C_YELLOW,
    "Distracted": C_RED,
}


# ── FPS Counter ───────────────────────────────────────────────────────────────
class FPSCounter:
    def __init__(self, window: int = 30):
        self._times: deque = deque(maxlen=window)

    def tick(self):
        self._times.append(time.time())

    @property
    def fps(self) -> float:
        if len(self._times) < 2:
            return 0.0
        return (len(self._times) - 1) / (self._times[-1] - self._times[0] + 1e-6)


# ── Alert Manager ─────────────────────────────────────────────────────────────
class AlertManager:
    def __init__(self, score_threshold: int = 40, cooldown: float = 10.0):
        self.threshold  = score_threshold
        self.cooldown   = cooldown
        self._last_time = 0.0
        self.active     = False   # True while alert banner is showing

    def update(self, score: int):
        now = time.time()
        if score < self.threshold and (now - self._last_time) > self.cooldown:
            self.active     = True
            self._last_time = now
            self._speak("Please focus")
        elif score >= self.threshold:
            self.active = False

    def _speak(self, text: str):
        tts = _get_tts()
        if tts and tts is not False:
            try:
                tts.say(text)
                tts.runAndWait()
            except Exception:
                pass


# ── Overlay drawing ───────────────────────────────────────────────────────────
def _pill(img, x, y, w, h, color, alpha=0.55):
    """Semi-transparent rounded-rectangle background."""
    overlay = img.copy()
    cv2.rectangle(overlay, (x, y), (x + w, y + h), color, -1, cv2.LINE_AA)
    cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, img)


def _text(img, txt, x, y, scale=0.55, color=C_WHITE, thickness=1):
    cv2.putText(img, txt, (x, y), cv2.FONT_HERSHEY_DUPLEX,
                scale, C_BLACK, thickness + 1, cv2.LINE_AA)
    cv2.putText(img, txt, (x, y), cv2.FONT_HERSHEY_DUPLEX,
                scale, color,   thickness,     cv2.LINE_AA)


def draw_overlay(
    frame,
    score_data:   dict,
    face_results: list,
    pose_result:  dict,
    phone_result: dict,
    emotion:      str,
    fps:          float,
    alert:        bool,
    debug:        bool = False,
    paused:       bool = False,
):
    """Draw all HUD elements directly onto `frame` (in-place)."""
    h, w = frame.shape[:2]
    smooth  = score_data.get("smooth_score", 0)
    status  = score_data.get("status", "Distracted")
    s_color = STATUS_COLORS.get(status, C_WHITE)

    # ── Score panel (top-left) ────────────────────────────────────────────────
    _pill(frame, 8, 8, 220, 110, C_BLACK)
    _text(frame, "ENGAGEMENT MONITOR", 16, 30, 0.50, C_CYAN)
    _text(frame, f"Score : {smooth:3d} / 100", 16, 55,  0.65, s_color, 1)
    _text(frame, f"Status: {status}",           16, 78,  0.60, s_color)
    _text(frame, f"FPS   : {fps:4.1f}",         16, 100, 0.48, C_WHITE)

    # Score bar
    bar_x, bar_y = 8, 118
    bar_w, bar_h = 220, 10
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (60,60,60), -1)
    fill = int(bar_w * smooth / 100)
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + fill, bar_y + bar_h), s_color, -1)

    # ── State tags (top-right) ────────────────────────────────────────────────
    tags = []
    if face_results:
        face = face_results[0]
        if face.get("yawning"):          tags.append(("! Yawning",       C_ORANGE))
        if face.get("gaze_away"):        tags.append(("! Looking Away",   C_YELLOW))
        if face.get("asleep"):           tags.append(("! Eyes Closed",    C_RED))
        if phone_result.get("phone_detected"): tags.append(("! Phone Detected", C_RED))
        if pose_result.get("hand_raised"):     tags.append(("+ Hand Raised",     C_GREEN))
        head_dir = pose_result.get("head_direction", "Forward")
        if head_dir != "Forward":
            tags.append((f"! Head {head_dir}", C_YELLOW))
        tags.append((f"Emotion: {emotion}", C_CYAN))
    else:
        tags.append(("! No Face Detected", C_RED))

    if len(face_results) > 1:
        tags.append((f"! {len(face_results)} Faces", C_ORANGE))

    tag_x = w - 190
    for i, (label, col) in enumerate(tags):
        ty = 30 + i * 24
        _pill(frame, tag_x - 4, ty - 18, 188, 22, C_BLACK, 0.5)
        _text(frame, label, tag_x, ty, 0.48, col)

    # ── Face bounding boxes ───────────────────────────────────────────────────
    for fr in face_results:
        bbox = fr.get("bbox")
        if not bbox:
            continue
        x1, y1, x2, y2 = bbox
        fid = fr.get("face_id", 0)
        color = s_color if fid == 0 else C_PURPLE
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2, cv2.LINE_AA)
        _text(frame, f"Face {fid}", x1 + 4, y1 - 6, 0.45, color)

    # ── Phone bounding boxes ──────────────────────────────────────────────────
    for phone_box in phone_result.get("phone_boxes", []):
        # Handle both 5-tuple and 6-tuple (x1, y1, x2, y2, conf[, label])
        px1, py1, px2, py2 = int(phone_box[0]), int(phone_box[1]), int(phone_box[2]), int(phone_box[3])
        conf = phone_box[4] if len(phone_box) > 4 else 0.0
        label = phone_box[5] if len(phone_box) > 5 else "Phone"
        cv2.rectangle(frame, (px1, py1), (px2, py2), C_RED, 2, cv2.LINE_AA)
        _text(frame, f"{label} {conf:.0%}", px1 + 4, py1 - 6, 0.45, C_RED)

    # ── Debug panel (bottom-left) ─────────────────────────────────────────────
    if debug and face_results:
        face = face_results[0]
        comp = score_data.get("components", {})
        lines = [
            f"EAR:{face.get('ear', 0):.2f}  MAR:{face.get('mar', 0):.2f}  Blinks:{face.get('blink_rate', 0):.0f}/m",
            f"Yaw:{pose_result.get('yaw', 0):.0f}  Pitch:{pose_result.get('pitch', 0):.0f}",
            f"EyeScore:{comp.get('eye',0):3.0f}  HeadScore:{comp.get('head',0):3.0f}",
            f"Fatigue:{comp.get('fatigue',0):3.0f}  Phone:{comp.get('phone',0):3.0f}",
        ]
        by = h - 10 - len(lines) * 20
        _pill(frame, 4, by - 6, 320, len(lines) * 20 + 12, C_BLACK)
        for i, ln in enumerate(lines):
            _text(frame, ln, 10, by + i * 20, 0.42, C_WHITE)

    # ── Alert banner ──────────────────────────────────────────────────────────
    if alert:
        bw, bh = 360, 44
        bx, by = (w - bw) // 2, h // 2 - bh // 2
        _pill(frame, bx, by, bw, bh, C_RED, 0.75)
        cv2.rectangle(frame, (bx, by), (bx + bw, by + bh), C_RED, 2, cv2.LINE_AA)
        _text(frame, "!  Please Focus  !", bx + 30, by + 28, 0.85, C_WHITE, 2)

    # ── Paused banner ─────────────────────────────────────────────────────────
    if paused:
        _pill(frame, w // 2 - 70, 8, 140, 32, (50, 50, 50))
        _text(frame, "PAUSED  [Space]", w // 2 - 62, 28, 0.55, C_YELLOW)