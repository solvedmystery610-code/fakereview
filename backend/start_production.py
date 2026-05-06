"""
Production startup script for FakeReview backend.
Uses waitress (Windows-compatible WSGI server) instead of Flask dev server.

Install:  pip install waitress
Run:      python start_production.py
"""
import logging
import os
import sys

try:
    from waitress import serve
except ImportError:
    print("[ERROR] waitress not installed. Run: pip install waitress")
    sys.exit(1)

from app import app

HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "5000"))
THREADS = int(os.environ.get("THREADS", "4"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

if __name__ == "__main__":
    print(f"\n🚀 FakeReview API running at http://{HOST}:{PORT}")
    print(f"   Threads : {THREADS}")
    print(f"   Mode    : Production (waitress)\n")
    serve(app, host=HOST, port=PORT, threads=THREADS)
