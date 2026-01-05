import os
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials # NEW: Required for Swagger UI lock button
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from pathlib import Path

# --------------------------------------------------
# Configuration & Constants
# --------------------------------------------------
# CRITICAL: Replace this with your actual Firebase email address
# This ensures you have access even before you set up custom admin claims.
SUPER_ADMIN_EMAIL = "yugendharanmohan@gmail.com" 

# Use absolute path logic to find the JSON file reliably
# This looks for the JSON in the 'backend/' folder
BASE_DIR = Path(__file__).resolve().parent.parent
SERVICE_ACCOUNT_PATH = BASE_DIR / "firebase-service-account.json"

# --------------------------------------------------
# Firebase Admin Initialization (ONCE)
# --------------------------------------------------
if not firebase_admin._apps:
    if not SERVICE_ACCOUNT_PATH.exists():
        raise FileNotFoundError(
            f"Firebase service account file not found at {SERVICE_ACCOUNT_PATH}. "
            "Please download it from Project Settings > Service Accounts in Firebase."
        )
    
    cred = credentials.Certificate(str(SERVICE_ACCOUNT_PATH))
    firebase_admin.initialize_app(cred)

# --------------------------------------------------
# SECURITY SCHEME
# --------------------------------------------------
# This tells FastAPI that we are using Bearer tokens.
# It automatically adds the "Lock" icon to Swagger UI and handles the "Bearer " prefix.
security = HTTPBearer()

# --------------------------------------------------
# 1. Base Token Verification (Internal Use)
# --------------------------------------------------
def verify_firebase_token(creds: HTTPAuthorizationCredentials = Depends(security)):
    """
    Extracts and verifies Firebase ID token.
    FastAPI (HTTPBearer) automatically extracts the token from the header.
    """
    token = creds.credentials # This gets the clean token string

    try:
        # Verifies the token and returns a dict containing uid, email, etc.
        decoded_token = firebase_auth.verify_id_token(token)
        return decoded_token  
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired Firebase token. Please login again."
        )


# --------------------------------------------------
# 2. Regular User Dependency (Allows ANY logged-in user)
# --------------------------------------------------
def get_current_user(user=Depends(verify_firebase_token)):
    """
    Validates that the user is logged in. 
    Does NOT check for admin privileges.
    Use this for endpoints accessible by 'User' role.
    """
    return user


# --------------------------------------------------
# 3. Admin-only Dependency
# --------------------------------------------------
def admin_required(user=Depends(verify_firebase_token)):
    """
    Ensures the logged-in user is an admin.
    Checks for Firebase custom claims OR the fallback super admin email.
    Use this for endpoints accessible ONLY by 'Admin' role.
    """
    is_admin_claim = user.get("admin", False)
    user_email = user.get("email")

    # Grant access if they have the admin claim OR match the super admin email
    if not is_admin_claim and user_email != SUPER_ADMIN_EMAIL:
        raise HTTPException(
            status_code=403,
            detail=f"Access denied for {user_email}. Admin rights required."
        )

    return user