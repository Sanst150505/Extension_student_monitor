"""
main.py
-------
FastAPI entry point for AI Student Engagement Monitor.
Optimized version (no structural changes).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import modular routers
from routes import analyze, question, answer, events, stats, voice

# 🚀 App initialization
app = FastAPI(
    title="AI Engagement Monitor",
    version="2.0.1",  # slight bump
)


# ── CORS Configuration (OPTIMIZED) ────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 🔥 Reliable for extension + Meet
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Include Routers ───────────────────────────────────────────────────────────
app.include_router(analyze.router, tags=["Analyze"])
app.include_router(question.router, tags=["Question"])
app.include_router(answer.router, tags=["Answer"])
app.include_router(events.router, tags=["Events"])
app.include_router(stats.router, tags=["Stats"])
app.include_router(voice.router, tags=["Voice"])


# ── Health Check (VERY USEFUL for debugging) ──────────────────────────────────
@app.get("/")
def root():
    return {"status": "AI Engagement Monitor running 🚀"}


@app.get("/health")
def health():
    return {"status": "ok"}


# ── Run Server ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",  # cleaner logs
    )
