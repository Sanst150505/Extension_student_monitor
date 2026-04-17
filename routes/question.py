from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Query

from db import question_logs
from services.monitoring import mark_question_sent
from services.scoring import mark_question_sent as mark_legacy_question_sent
from services.question import generate_mcq

router = APIRouter()


@router.get("/generate-question")
async def get_question(
    student_id: str = Query("demo_user"),
    student_name: str = Query("Student"),
    subject: str = Query("General"),
    batch: str = Query("General"),
    session_id: str = Query("demo_session"),
    topic: str = Query("General Knowledge"),
    difficulty: str = Query("medium"),
):
    question_data = generate_mcq(topic or subject, difficulty)
    question_id = uuid4().hex

    payload = {
        "question_id": question_id,
        "student_id": student_id,
        "student_name": student_name,
        "subject": subject,
        "batch": batch,
        "session_id": session_id,
        "difficulty": difficulty,
        "topic": topic or subject,
        "question": question_data["question"],
        "options": question_data["options"],
        "answer": question_data["answer"],
        "timestamp": datetime.now(timezone.utc),
    }

    if question_logs is not None:
        try:
            question_logs.insert_one(payload)
        except Exception as exc:
            print(f"[MongoDB] Failed to log question: {exc}")

    mark_question_sent(
        {
            "student_id": student_id,
            "subject": subject,
            "batch": batch,
            "session_id": session_id,
        },
        question_id,
    )
    mark_legacy_question_sent()

    return {
        "question_id": question_id,
        "student_id": student_id,
        "student_name": student_name,
        "subject": subject,
        "batch": batch,
        "session_id": session_id,
        "difficulty": difficulty,
        "topic": topic or subject,
        "question": question_data["question"],
        "options": question_data["options"],
        "answer": question_data["answer"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
