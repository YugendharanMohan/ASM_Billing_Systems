import os
import firebase_admin
from firebase_admin import credentials, firestore
from pathlib import Path

# --------------------------------------------------
# Firebase Firestore Initialization
# --------------------------------------------------

# Get the absolute path to the service account JSON
# This assumes the JSON is in the 'backend/' folder (one level up from 'app/')
base_dir = Path(__file__).resolve().parent.parent
cred_path = base_dir / "firebase-service-account.json"

# Initialize the Firebase app only if it hasn't been initialized already
if not firebase_admin._apps:
    if not cred_path.exists():
        raise FileNotFoundError(
            f"Firebase service account file not found at: {cred_path}. "
            "Please ensure you have downloaded it from the Firebase Console."
        )
    
    cred = credentials.Certificate(str(cred_path))
    firebase_admin.initialize_app(cred)

# --------------------------------------------------
# Firestore Database Client
# --------------------------------------------------
# This 'db' object replaces your old 'engine' and 'SessionLocal'
# You will use this directly in your crud.py and main.py
db = firestore.client()

def get_firestore_db():
    """
    Returns the Firestore client. 
    Unlike the old SQL get_db, this does not need to be closed.
    """
    return db