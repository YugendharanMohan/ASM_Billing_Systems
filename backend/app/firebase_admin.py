import os
import json
import firebase_admin
from firebase_admin import credentials, firestore

# --------------------------------------------------
# Firebase Admin Initialization
# Supports:
# 1. Local development using firebase-service-account.json
# 2. Production (Render) using FIREBASE_SERVICE_ACCOUNT env variable
# --------------------------------------------------

def initialize_firebase():
    if firebase_admin._apps:
        return

    # 🔹 CASE 1: Production (Render) — use environment variable
    if "FIREBASE_SERVICE_ACCOUNT" in os.environ:
        try:
            firebase_creds = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT"])
            cred = credentials.Certificate(firebase_creds)
            firebase_admin.initialize_app(cred)
            print("✅ Firebase initialized using environment variable")
            return
        except Exception as e:
            raise RuntimeError(
                "Failed to initialize Firebase from FIREBASE_SERVICE_ACCOUNT env variable"
            ) from e

    # 🔹 CASE 2: Local development — use JSON file
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    SERVICE_ACCOUNT_PATH = os.path.join(BASE_DIR, "firebase-service-account.json")

    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        raise FileNotFoundError(
            f"Firebase service account file not found at {SERVICE_ACCOUNT_PATH}\n"
            "➡️ For local dev: place firebase-service-account.json in backend/app/\n"
            "➡️ For production: set FIREBASE_SERVICE_ACCOUNT env variable"
        )

    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)
    print("✅ Firebase initialized using local service account file")


# Initialize Firebase once
initialize_firebase()

# Firestore client (import this everywhere)
db = firestore.client()
