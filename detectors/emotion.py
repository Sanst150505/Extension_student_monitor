def classify_emotion(face_result: dict, frame=None) -> str:
    if not face_result:
        return "No Face"

    closed_frames = int(face_result.get("closed_frames", 0))

    if closed_frames >= 18:
        return "Sleepy"
    if face_result.get("yawning") or closed_frames >= 10 or face_result.get("eyes_closed"):
        return "Drowsy"
    if face_result.get("gaze_away"):
        return "Distracted"
    return "Engaged"
