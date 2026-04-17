from fastapi import APIRouter
from services import analytics
from db import db

router = APIRouter()

@router.get("/stats")
async def stats():
    return analytics.get_recent_stats(limit=100)

@router.get("/summary")
async def summary():
    return analytics.get_summary()

@router.get("/student/{student_id}")
async def student_profile(student_id: str):
    return analytics.get_student_profile(student_id)

@router.get("/health")
async def health():
    mongo_status = "connected" if db is not None else "disconnected"
    return {
        "status": "ok",
        "mongo": mongo_status,
    }
