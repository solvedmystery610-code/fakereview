
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from database import reviews_collection

# Check recent reviews
recent_reviews = list(reviews_collection.find().sort('timestamp', -1).limit(10))

for r in recent_reviews:
    print(f"Timestamp: {r.get('timestamp')}")
    print(f"User: {r.get('username')}")
    print(f"Result: {r.get('result')}")
    print(f"Prob Fake: {r.get('prob_fake')}")
    print(f"Text: {r.get('review')[:50]}...")
    print("-" * 50)
