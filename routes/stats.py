from fastapi import APIRouter, Query

from db import db
from services import analytics

router = APIRouter()


@router.get("/stats")
async def stats(
    subject: str | None = Query(default=None),
    batch: str | None = Query(default=None),
    session_id: str | None = Query(default=None),
):
    return analytics.get_recent_stats(limit=100, subject=subject, batch=batch, session_id=session_id)


@router.get("/summary")
async def summary(
    subject: str | None = Query(default=None),
    batch: str | None = Query(default=None),
    session_id: str | None = Query(default=None),
):
    return analytics.get_summary(subject=subject, batch=batch, session_id=session_id)


@router.get("/student/{student_id}")
async def student_profile(
    student_id: str,
    subject: str | None = Query(default=None),
    batch: str | None = Query(default=None),
    session_id: str | None = Query(default=None),
):
    return analytics.get_student_profile(student_id, subject=subject, batch=batch, session_id=session_id)


@router.get("/students")
async def students(
    subject: str | None = Query(default=None),
    batch: str | None = Query(default=None),
    session_id: str | None = Query(default=None),
):
    return analytics.get_students_overview(subject=subject, batch=batch, session_id=session_id)


@router.get("/health")
async def health():
    mongo_status = "connected" if db is not None else "disconnected"
    return {
        "status": "ok",
        "mongo": mongo_status,
    }
