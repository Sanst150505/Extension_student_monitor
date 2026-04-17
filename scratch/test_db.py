import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()
uri = os.getenv("MONGO_URI")

try:
    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    client.admin.command('ping')
    print("SUCCESS: Connected to MongoDB Atlas!")
except Exception as e:
    print(f"FAILED: {e}")
