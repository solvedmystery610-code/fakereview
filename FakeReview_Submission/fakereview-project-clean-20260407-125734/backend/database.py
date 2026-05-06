from pymongo import MongoClient

# MongoDB connection
client = MongoClient("mongodb://localhost:27017/")

# Database
db = client["fake_review_db"]

# Collections
users_collection = db["users"]
reviews_collection = db["reviews"]
request_logs_collection = db["request_logs"]
download_logs_collection = db["download_logs"]
upload_logs_collection = db["upload_logs"]
audit_logs_collection = db["audit_logs"]
feedback_collection = db["feedback"]
