
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

import analyzer
import time

# Force re-train by resetting global model
analyzer._MODEL = None
analyzer.warm_model_async()

print("Triggered re-train with corrected labels. Waiting...")

for i in range(45):
    status = analyzer.get_model_status()
    if status['ready']:
        print(f"\nModel ready after {i*2}s!")
        break
    print(".", end="", flush=True)
    time.sleep(2)

test_reviews = [
    {
        "text": "This is a great product! I love it so much. Everything works perfectly.",
        "rating": 5,
        "expected": "Genuine"
    },
    {
        "text": "The item was broken on arrival. Very disappointed with the quality.",
        "rating": 1,
        "expected": "Genuine"
    },
    {
        "text": "Works as described.",
        "rating": 5,
        "expected": "Genuine"
    },
    {
        "text": "AMAZING PRODUCT!!! I LOVE IT SO MUCH!!! BEST THING EVER!!! BUY NOW!!!",
        "rating": 5,
        "expected": "Fake"
    }
]

failures = 0
for review in test_reviews:
    result = analyzer.analyze_review(review['text'], review['rating'])
    print("-" * 50)
    print(f"Review: {review['text']}")
    print(f"Status: {result['status']} (Expected: {review['expected']})")
    print(f"Prob Fake: {result['prob_fake']}")
    print(f"Analysis: {result['analysis']}")
    if result['status'] != review['expected']:
        print("!!! MISMATCH !!!")
        failures += 1

if failures == 0:
    print("\nALL tests passed! Logic is now correct.")
else:
    print(f"\n{failures} tests FAILED. Please check logic.")
