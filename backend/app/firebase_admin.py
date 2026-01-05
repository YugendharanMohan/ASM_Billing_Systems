import os
import firebase_admin
from firebase_admin import credentials

# --------------------------------------------------
# Firebase Admin Initialization (Safe & Robust)
# --------------------------------------------------

# Use absolute path logic to find the JSON file reliably
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_PATH = os.path.join(BASE_DIR, "firebase-service-account.json")

if not firebase_admin._apps:
    # Check if the file exists before attempting to initialize
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        raise FileNotFoundError(
            f"Firebase service account file not found at {SERVICE_ACCOUNT_PATH}. "
            "Please ensure it is placed in the backend/app/ directory."
        )
    
    # Initialize only if no apps are currently running
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)