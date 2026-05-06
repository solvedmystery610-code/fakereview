
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from analyzer import analyze_review, get_model
import time

model = get_model()
if not model or not model.ready:
    time.sleep(5)

test_cases = [
    {
        "name": "Very Generic Positive (Likely Fake)",
        "text": "This product is the best thing ever. I love it. Great quality. Buy it now. You will not regret.",
        "rating": 5
    },
    {
        "name": "Specific Negative (Likely Genuine)",
        "text": "The zipper on this bag broke after two days. I am returning it. It was too small for my gym gear anyway.",
        "rating": 1
    }
]

for case in test_cases:
    result = analyze_review(case['text'], case['rating'])
    print(f"CASE: {case['name']}")
    print(f"Status: {result['status']}, Prob Fake: {result['prob_fake']}")
    print(f"Reasons: {result['analysis']}")
    print("-" * 50)
