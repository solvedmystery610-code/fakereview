
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from database import reviews_collection

# Check recent reviews
recent_reviews = list(reviews_collection.find().sort('timestamp', -1).limit(20))

for r in recent_reviews:
    print(f"Timestamp: {r.get('timestamp')}")
    print(f"User: {r.get('username') or 'N/A'}")
    print(f"Result: {r.get('result') or 'N/A'}")
    print(f"Prob Fake: {r.get('prob_fake', 'N/A')}")
    review_text = r.get('review') or r.get('text') or ''
    print(f"Text: {review_text[:50]}...")
    print("-" * 50)
