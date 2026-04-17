"""
db.py
-----
MongoDB Atlas connection module.

- Loads MONGO_URI from .env
- Creates a connection-pooled MongoClient singleton
- Exposes collection handles for engagement_logs, events_logs, sessions
- Creates indexes on first import
"""

import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

# ── Graceful fallback if URI is missing ───────────────────────────────────────
db = None
engagement_logs = None
events_logs = None
sessions = None
question_logs = None
answer_logs = None

if not MONGO_URI:
    print("[MongoDB] ⚠️  MONGO_URI not set in .env — running WITHOUT persistence.")
    print("[MongoDB]    Detectors will still work, but data won't be stored.")
else:
    try:
        from pymongo import MongoClient, ASCENDING

        client = MongoClient(
            MONGO_URI,
            maxPoolSize=50,
            minPoolSize=5,
            serverSelectionTimeoutMS=10000, 
            connectTimeoutMS=10000,
            retryWrites=True,
            tlsAllowInvalidCertificates=True
        )

        db = client["ai_monitor"]
        engagement_logs = db["engagement_logs"]
        events_logs = db["events_logs"]
        sessions = db["sessions"]
        question_logs = db["question_logs"]
        answer_logs = db["answer_logs"]

        print("[MongoDB] ⚡ Client initialized (Lazy Mode).")

        # ── Create indexes (idempotent — safe to call every startup) ──────────
        engagement_logs.create_index(
            [("student_id", ASCENDING), ("timestamp", ASCENDING)],
            name="idx_student_timestamp",
            background=True,
        )
        engagement_logs.create_index(
            [("session_id", ASCENDING)],
            name="idx_session",
            background=True,
        )
        events_logs.create_index(
            [("student_id", ASCENDING), ("timestamp", ASCENDING)],
            name="idx_student_timestamp",
            background=True,
        )
        sessions.create_index(
            [("student_id", ASCENDING)],
            name="idx_student",
            background=True,
        )
        question_logs.create_index(
            [("student_id", ASCENDING), ("timestamp", ASCENDING)],
            name="idx_student_timestamp",
            background=True,
        )
        answer_logs.create_index(
            [("student_id", ASCENDING), ("timestamp", ASCENDING)],
            name="idx_student_timestamp",
            background=True,
        )
        print("[MongoDB] ✅ Indexes created/verified.")

    except Exception as e:
        print(f"[MongoDB] ❌ Connection failed: {e}")
        print("[MongoDB]    Running WITHOUT persistence.")
        db = None
        engagement_logs = None
        events_logs = None
        sessions = None
        question_logs = None
        answer_logs = None
