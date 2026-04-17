"""
detectors/emotion.py
--------------------
Standalone emotion classification.

Primary:  heuristic from face.py output (zero extra cost, runs always).
Optional: DeepFace backend (slower, ~1 fps) activated with USE_DEEPFACE=True.

Exported labels: Happy | Neutral | Confused | Bored | Sleepy | Surprised | Focused | Distracted
"""

import time

# Set True to enable DeepFace (requires `pip install deepface tf-keras`)
USE_DEEPFACE = False

_deepface    = None
_last_df_run = 0.0
_DF_INTERVAL = 2.0   # run DeepFace at most every 2 s to keep it real-time


def _try_load_deepface():
    global _deepface
    if _deepface is not None:
        return _deepface
    try:
        from deepface import DeepFace as _df
        _deepface = _df
        print("[EmotionDetector] DeepFace backend loaded.")
    except Exception:
        _deepface = False   # sentinel: tried and failed
        print("[EmotionDetector] DeepFace not available, using heuristic only.")
    return _deepface


# Mapping DeepFace → our labels
_DF_MAP = {
    "happy":    "Happy",
    "neutral":  "Neutral",
    "sad":      "Bored",
    "angry":    "Confused",
    "disgust":  "Confused",
    "fear":     "Confused",
    "surprise": "Surprised",
}

# Cached last DeepFace result
_last_df_emotion = "Neutral"


def classify_emotion(face_result: dict, frame=None) -> str:
    """
    Returns an emotion string given a face_result dict from detectors/face.py.

    face_result keys used: asleep, yawning, ear, emotion (heuristic from face.py)
    frame: optional raw BGR frame for DeepFace fallback.
    """
    global _last_df_run, _last_df_emotion

    # ── DeepFace (optional, throttled) ───────────────────────────────────────
    if USE_DEEPFACE and frame is not None:
        now = time.time()
        if now - _last_df_run >= _DF_INTERVAL:
            _last_df_run = now
            df = _try_load_deepface()
            if df and df is not False:
                try:
                    analysis = df.analyze(
                        frame,
                        actions=["emotion"],
                        enforce_detection=False,
                        silent=True,
                    )
                    raw = analysis[0]["dominant_emotion"].lower()
                    _last_df_emotion = _DF_MAP.get(raw, "Neutral")
                except Exception as e:
                    print(f"[EmotionDetector] DeepFace error: {e}")
        return _last_df_emotion

    # ── Heuristic (always available) ─────────────────────────────────────────
    # face.py already computed a heuristic; just return it.
    return face_result.get("emotion", "Neutral")