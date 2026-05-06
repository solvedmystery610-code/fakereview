import sys
import os
import json

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from analyzer import get_model

def get_metrics():
    model = get_model()
    if not model or not model.ready:
        print("Model not ready")
        return

    metrics = model.metrics
    summary = model.training_summary
    
    print("--- Model Performance Metrics ---")
    print(f"Overall Accuracy: {metrics['test']['accuracy'] * 100:.2f}%")
    print(f"Precision (Fake Detection): {metrics['test']['precision'] * 100:.2f}%")
    print(f"Recall (Fake Sensitivity): {metrics['test']['recall'] * 100:.2f}%")
    
    print("\n--- Confusion Matrix (Test Set) ---")
    cm = metrics['test']['confusion_matrix']
    print(f"True Positives (Fake): {cm['tp']}")
    print(f"True Negatives (Genuine): {cm['tn']}")
    print(f"False Positives (Genuine flagged as Fake): {cm['fp']}")
    print(f"False Negatives (Fake flagged as Genuine): {cm['fn']}")
    
    print("\n--- Dataset Info ---")
    print(f"Rows Loaded: {summary['rows_loaded']}")
    print(f"Training Samples: {summary['train_samples']}")
    print(f"Test Samples: {summary['test_samples']}")

if __name__ == "__main__":
    get_metrics()
