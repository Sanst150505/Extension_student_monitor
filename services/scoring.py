import time

# ── Configuration ────────────────────────────────────────────────────────────
WINDOW_SIZE = 5
LOW_SCORE_THRESHOLD = 40
COOLDOWN_SECONDS = 60

# ── State ────────────────────────────────────────────────────────────────────
attention_buffer = []      # stores last 5 scores
last_question_time = 0      # timestamp of last triggered question

def compute_engagement_score(
    face_detected: bool,
    phone_detected: bool,
    asleep: bool,
    gaze_away: bool,
    yawning: bool,
) -> float:
    """
    Compute a simple engagement score (0–100) for storage and analytics.
    """
    if not face_detected:
        return 0.0

    score = 100.0

    if phone_detected:
        score -= 30
    if asleep:
        score -= 40
    if gaze_away:
        score -= 20
    if yawning:
        score -= 15

    return max(0.0, min(100.0, score))


def update_attention_and_check_trigger(score: float):
    """
    Updates the sliding window and checks if a question should be triggered.
    Returns: (ask_question: bool, difficulty: str)
    """
    global attention_buffer

    # Update buffer
    attention_buffer.append(score)
    if len(attention_buffer) > WINDOW_SIZE:
        attention_buffer.pop(0)

    # Check if we have enough data
    if len(attention_buffer) < WINDOW_SIZE:
        return False, "medium"

    # Trigger conditions
    avg_score = sum(attention_buffer) / len(attention_buffer)
    low_scores_count = sum(1 for s in attention_buffer if s < LOW_SCORE_THRESHOLD)

    trigger = (avg_score < LOW_SCORE_THRESHOLD) or (low_scores_count >= 3)
    
    # ── Debug Logging ────────────────────────────────────────────────────────
    print(f"[Scoring] Buffer: {len(attention_buffer)}/{WINDOW_SIZE}, Avg: {avg_score:.1f}, LowCount: {low_scores_count}")

    if trigger and _can_ask():
        difficulty = get_difficulty(avg_score)
        print(f"  >> TRIGGER CONDITION MET (Difficulty: {difficulty})")
        return True, difficulty

    return False, "medium"


def _can_ask():
    """Checks the 60s cooldown."""
    global last_question_time
    now = time.time()
    if now - last_question_time > COOLDOWN_SECONDS:
        # We don't update last_question_time here, 
        # but in the route when the question is actually sent.
        return True
    return False


def mark_question_sent():
    """Updates the cooldown timer."""
    global last_question_time
    last_question_time = time.time()


def get_difficulty(avg_score: float) -> str:
    """Difficulty selection based on engagement score."""
    if avg_score < 30:
        return "easy"
    elif avg_score < 60:
        return "medium"
    else:
        return "hard"