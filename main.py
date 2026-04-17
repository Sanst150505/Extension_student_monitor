"""
main.py
-------
FastAPI entry point for AI Student Engagement Monitor.
Now refactored to use modular routes.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import modular routers
from routes import analyze, question, answer, events, stats

app = FastAPI(title="AI Engagement Monitor", version="2.0.0")

# ── CORS Configuration ────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://meet.google.com",
        "chrome-extension://*",
        "http://localhost:3000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Include Routers ───────────────────────────────────────────────────────────
app.include_router(analyze.router)
app.include_router(question.router)
app.include_router(answer.router)
app.include_router(events.router)
app.include_router(stats.router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)