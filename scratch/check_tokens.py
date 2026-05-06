
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from analyzer import get_model
import time

model = get_model()
if not model or not model.ready:
    print("Model not ready. Training...")
    time.sleep(10) # wait a bit
    model = get_model()

if model and model.ready:
    print(f"Top 20 'Fake' Tokens (Class 1): {list(model.top_fake_tokens)[:20]}")
    print(f"Top 20 'Genuine' Tokens (Class 0): {list(model.top_genuine_tokens)[:20]}")
else:
    print("Model still not ready.")
