import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from analyzer import get_model, analyze_review

def test_user_case():
    model = get_model()
    if not model:
        print("Model not ready")
        return

    text = "This is anamzing product"
    res = analyze_review(text, 5)
    print(f"User Input: '{text}'")
    print(f"Result: {res['status']}")
    print(f"Confidence: {res['confidence']}")
    print(f"Prob Fake: {res['prob_fake']}")
    print(f"Reasons: {res['analysis']}")

if __name__ == "__main__":
    test_user_case()
