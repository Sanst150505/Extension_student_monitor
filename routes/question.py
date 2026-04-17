from fastapi import APIRouter, Query
from datetime import datetime, timezone
from services.question import generate_mcq
from services.scoring import mark_question_sent
from db import question_logs

router = APIRouter()

@router.get("/generate-question")
async def get_question(
    topic: str = Query("General Knowledge"),
    difficulty: str = Query("medium")
):
    """
    Triggers AI question generation and logs it.
    """
    # 1. Generate Question
    question_data = generate_mcq(topic, difficulty)

    # 2. Log to MongoDB
    if question_logs is not None:
        try:
            log_doc = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "student_id": "demo_user",
                "question": question_data["question"],
                "options": question_data["options"],
                "correct_answer": question_data["answer"],
                "difficulty": difficulty,
                "topic": topic
            }
            question_logs.insert_one(log_doc)
        except Exception as e:
            print(f"[MongoDB] ⚠️ Failed to log question: {e}")

    # 3. Update cooldown timer
    mark_question_sent()

    return question_data
