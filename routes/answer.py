from fastapi import APIRouter, Body
from datetime import datetime, timezone
from db import answer_logs

router = APIRouter()

@router.post("/answer")
async def handle_answer(
    data: dict = Body(...)
):
    """
    Evaluates student answer and logs results.
    """
    selected = data.get("selected")
    correct = data.get("correct")
    
    is_correct = (selected == correct)
    delta = 10 if is_correct else -5

    # Log to MongoDB
    if answer_logs is not None:
        try:
            log_doc = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "student_id": "demo_user",
                "selected": selected,
                "correct": correct,
                "result": "correct" if is_correct else "wrong",
                "score_change": delta
            }
            answer_logs.insert_one(log_doc)
        except Exception as e:
            print(f"[MongoDB] ⚠️ Failed to log answer: {e}")

    return {
        "correct": is_correct,
        "delta": delta,
        "message": "Great job!" if is_correct else "Better luck next time!"
    }
