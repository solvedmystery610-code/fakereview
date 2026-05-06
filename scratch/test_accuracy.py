import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from analyzer import get_model, analyze_review, tokenize

def test_model():
    model = get_model()
    if not model:
        print("Model not ready")
        return

    # Test case 1: "You will love it!..." (Row 0 in CSV, Label 0)
    text1 = "You will love it! It’s battery powered! Love love it! Works perfectly I don’t care what the negative comments are- nothing negative about it. Great for the purse or cosmetic bag. Travels great!"
    res1 = analyze_review(text1, 5)
    print(f"Test 1 (Label 0 Expected): Result={res1['status']}, Confidence={res1['confidence']}, Prob={res1['prob_fake']}")

    # Test case 2: "Love It !!!" (Row 2 in CSV, Label 1)
    text2 = "Love It !!! I've had this for a little over a month now and I have NOTHING bad to say. Gives a close shave and is VERY QUIET !!!"
    res2 = analyze_review(text2, 5)
    print(f"Test 2 (Label 1 Expected): Result={res2['status']}, Confidence={res2['confidence']}, Prob={res2['prob_fake']}")

if __name__ == "__main__":
    test_model()
