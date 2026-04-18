import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

db = None
engagement_logs = None
events_logs = None
sessions = None
question_logs = None
answer_logs = None
assessments = None
voice_logs = None

if not MONGO_URI:
    print("[MongoDB] WARNING: MONGO_URI not set in .env - running WITHOUT persistence.")
    print("[MongoDB] Detectors will still work, but data will not be stored.")
else:
    try:
        from pymongo import MongoClient, ASCENDING
        from pymongo.errors import OperationFailure

        client = MongoClient(
            MONGO_URI,
            maxPoolSize=50,
            minPoolSize=5,
            serverSelectionTimeoutMS=10000,
            connectTimeoutMS=10000,
            retryWrites=True,
            tlsAllowInvalidCertificates=True,
        )

        db = client["ai_monitor"]
        engagement_logs = db["engagement_logs"]
        events_logs = db["events_logs"]
        sessions = db["sessions"]
        question_logs = db["question_logs"]
        answer_logs = db["answer_logs"]
        assessments = db["assessments"]
        voice_logs = db["voice_logs"]

        print("[MongoDB] Client initialized (Lazy Mode).")

        def ensure_index(collection, keys, **kwargs):
            try:
                collection.create_index(keys, **kwargs)
            except OperationFailure as exc:
                if exc.code in {85, 11000} or "already exists with a different name" in str(exc):
                    print(f"[MongoDB] Index already exists, skipping: {kwargs.get('name', keys)}")
                else:
                    raise

        ensure_index(
            engagement_logs,
            [("student_id", ASCENDING), ("subject", ASCENDING), ("batch", ASCENDING), ("session_id", ASCENDING), ("timestamp", ASCENDING)],
            name="idx_engagement_student_scope_time",
            background=True,
        )
        ensure_index(
            engagement_logs,
            [("subject", ASCENDING), ("batch", ASCENDING), ("session_id", ASCENDING), ("timestamp", ASCENDING)],
            name="idx_engagement_scope_time",
            background=True,
        )
        ensure_index(
            events_logs,
            [("student_id", ASCENDING), ("timestamp", ASCENDING)],
            name="idx_events_student_timestamp",
            background=True,
        )
        ensure_index(
            sessions,
            [("student_id", ASCENDING)],
            name="idx_student",
            background=True,
        )
        ensure_index(
            question_logs,
            [("question_id", ASCENDING)],
            name="idx_question_id",
            unique=True,
            background=True,
        )
        ensure_index(
            question_logs,
            [("student_id", ASCENDING), ("subject", ASCENDING), ("batch", ASCENDING), ("session_id", ASCENDING), ("timestamp", ASCENDING)],
            name="idx_question_scope_time",
            background=True,
        )
        ensure_index(
            answer_logs,
            [("student_id", ASCENDING), ("timestamp", ASCENDING)],
            name="idx_answer_student_timestamp",
            background=True,
        )
        ensure_index(
            assessments,
            [("student_id", ASCENDING), ("subject", ASCENDING), ("batch", ASCENDING), ("session_id", ASCENDING), ("timestamp", ASCENDING)],
            name="idx_assessment_scope_time",
            background=True,
        )
        ensure_index(
            assessments,
            [("question_id", ASCENDING)],
            name="idx_assessment_question",
            background=True,
        )
        ensure_index(
            voice_logs,
            [("student_id", ASCENDING), ("subject", ASCENDING), ("batch", ASCENDING), ("session_id", ASCENDING), ("timestamp", ASCENDING)],
            name="idx_voice_scope_time",
            background=True,
        )
        print("[MongoDB] Indexes created/verified.")

    except Exception as e:
        print(f"[MongoDB] Connection failed: {e}")
        print("[MongoDB] Running WITHOUT persistence.")
        db = None
        engagement_logs = None
        events_logs = None
        sessions = None
        question_logs = None
        answer_logs = None
        assessments = None
        voice_logs = None
