
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from analyzer import analyze_review, warm_model_async, get_model_status
import time

# Wait for model to be ready if it's training
print("Checking model status...")
status = get_model_status()
print(f"Initial status: {status}")

if not status['ready'] and status['model'] == 'training':
    print("Waiting for model to train...")
    for _ in range(30):
        time.sleep(2)
        status = get_model_status()
        if status['ready']:
            break
    print(f"Final status: {status}")

test_reviews = [
    {
        "text": "This is a great product! I love it so much. Everything works perfectly.",
        "rating": 5
    },
    {
        "text": "The item was broken on arrival. Very disappointed with the quality.",
        "rating": 1
    },
    {
        "text": "It's okay, does what it says but not very durable.",
        "rating": 3
    },
    {
        "text": "AMAZING PRODUCT!!! I LOVE IT SO MUCH!!! BEST THING EVER!!! BUY NOW!!!",
        "rating": 5
    },
    {
        "text": "I got this for free in exchange for a review. It is okay.",
        "rating": 4
    },
    {
        "text": "Works as described.",
        "rating": 5
    }
]

for review in test_reviews:
    result = analyze_review(review['text'], review['rating'])
    print("-" * 50)
    print(f"Review: {review['text']}")
    print(f"Rating: {review['rating']}")
    print(f"Status: {result['status']}")
    print(f"Prob Fake: {result['prob_fake']}")
    print(f"Confidence: {result['confidence']}")
    print(f"Analysis: {result['analysis']}")
