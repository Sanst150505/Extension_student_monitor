from datetime import datetime, timezone

from fastapi import APIRouter, Body

from db import assessments, answer_logs, question_logs
from services.monitoring import mark_question_answered

router = APIRouter()


def _assessment_score(correct: bool, response_time: float) -> float:
    accuracy_score = 70 if correct else 20
    if response_time <= 10:
        speed_score = 30
    elif response_time <= 20:
        speed_score = 20
    elif response_time <= 30:
        speed_score = 10
    else:
        speed_score = 0
    return float(accuracy_score + speed_score)


@router.post("/answer")
async def handle_answer(data: dict = Body(...)):
    student_id = data.get("student_id", "demo_user")
    subject = data.get("subject", "General")
    batch = data.get("batch", "General")
    session_id = data.get("session_id", "demo_session")
    question_id = data.get("question_id")
    student_answer = data.get("answer") or data.get("selected")
    response_time = float(data.get("response_time", 0) or 0)

    question_doc = None
    if question_logs is not None and question_id:
        question_doc = question_logs.find_one({"question_id": question_id})

    correct_answer = data.get("correct_answer") or data.get("correct")
    if question_doc and not correct_answer:
        correct_answer = question_doc.get("answer")

    is_correct = bool(student_answer and correct_answer and student_answer == correct_answer)
    score = _assessment_score(is_correct, response_time)

    assessment_doc = {
        "student_id": student_id,
        "subject": subject,
        "batch": batch,
        "session_id": session_id,
        "question_id": question_id,
        "student_answer": student_answer,
        "correct_answer": correct_answer,
        "correct": is_correct,
        "response_time": response_time,
        "score": score,
        "timestamp": datetime.now(timezone.utc),
    }

    if question_doc:
        assessment_doc["question"] = question_doc.get("question")

    if assessments is not None:
        try:
            assessments.insert_one(assessment_doc)
        except Exception as exc:
            print(f"[MongoDB] Failed to store assessment: {exc}")

    if answer_logs is not None:
        try:
            answer_logs.insert_one(assessment_doc)
        except Exception as exc:
            print(f"[MongoDB] Failed to log answer: {exc}")

    mark_question_answered(
        {
            "student_id": student_id,
            "subject": subject,
            "batch": batch,
            "session_id": session_id,
        },
        question_id,
    )

    return {
        "correct": is_correct,
        "score": score,
        "response_time": response_time,
        "message": "Correct answer recorded." if is_correct else "Answer recorded.",
    }
