import os

from pymongo import MongoClient


def _load_local_env():
    env_values = {}
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    try:
        with open(env_path, "r", encoding="utf-8") as handle:
            for line in handle:
                raw = line.strip()
                if not raw or raw.startswith("#") or "=" not in raw:
                    continue
                key, value = raw.split("=", 1)
                env_values.setdefault(key.strip(), value.strip().strip("\"'"))
    except OSError:
        pass
    return env_values


_LOCAL_ENV = _load_local_env()
MONGO_URI = os.getenv("MONGO_URI") or os.getenv("MONGODB_URI") or _LOCAL_ENV.get("MONGO_URI") or _LOCAL_ENV.get("MONGODB_URI") or "mongodb://localhost:27017/"
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME") or _LOCAL_ENV.get("MONGO_DB_NAME") or "fake_review_db"

# Fail faster when MongoDB is unavailable so requests do not hang for 30 seconds.
client = MongoClient(
    MONGO_URI,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000,
    socketTimeoutMS=5000,
)

# Database
db = client[MONGO_DB_NAME]

# Collections
users_collection = db["users"]
reviews_collection = db["reviews"]
request_logs_collection = db["request_logs"]
download_logs_collection = db["download_logs"]
upload_logs_collection = db["upload_logs"]
audit_logs_collection = db["audit_logs"]
feedback_collection = db["feedback"]

try:
    client.admin.command('ping')
    print("✅ MongoDB connected successfully!")
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")

