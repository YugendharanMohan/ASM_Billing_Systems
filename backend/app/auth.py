import os
import requests # Make sure to pip install requests if not already included in requirements
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from pathlib import Path

# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------
SUPER_ADMIN_EMAIL = [ "yugendharanmohan@gmail.com", "mohanas510@gmail.com", "jeevankumaram25@gmail.com"]

# ⚠️ MOVE TO ENV VARIABLE IN PRODUCTION
# This is the key from your get_token.py
FIREBASE_WEB_API_KEY = "AIzaSyCF0EQpmBGAT_Wo4elFmUCgVYLhuzquZqM"

BASE_DIR = Path(__file__).resolve().parent.parent
SERVICE_ACCOUNT_PATH = BASE_DIR / "firebase-service-account.json"

# --------------------------------------------------
# FIREBASE INIT
# --------------------------------------------------
if not firebase_admin._apps:
    if not SERVICE_ACCOUNT_PATH.exists():
        # Fallback for Render environment variable check usually handled in firebase_admin.py
        # If this fails, ensure firebase_admin.py is imported in main.py before auth is used.
        pass 
    else:
        cred = credentials.Certificate(str(SERVICE_ACCOUNT_PATH))
        firebase_admin.initialize_app(cred)

# --------------------------------------------------
# AUTH ROUTER & LOGIN LOGIC
# --------------------------------------------------
router = APIRouter()

# 1. DEFINE THE SCHEME
# This tells Swagger: "To get a token, send a POST request to this URL"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# 2. LOGIN ENDPOINT (Replaces get_token.py)
@router.post("/auth/login", tags=["Authentication"])
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Exchanges Email/Password for a Firebase ID Token.
    Used by Swagger UI 'Authorize' button automatically.
    """
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_WEB_API_KEY}"
    payload = {
        "email": form_data.username, # OAuth2 form sends 'username', we use it as email
        "password": form_data.password,
        "returnSecureToken": True
    }
    
    response = requests.post(url, json=payload)
    data = response.json()

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Login Failed: {data.get('error', {}).get('message', 'Unknown error')}"
        )

    # Return the token in the format FastAPI expects
    return {"access_token": data["idToken"], "token_type": "bearer"}

# --------------------------------------------------
# DEPENDENCIES
# --------------------------------------------------

def verify_firebase_token(token: str = Depends(oauth2_scheme)):
    """
    Decodes the token.
    oauth2_scheme automatically extracts the token from the Authorization header.
    """
    try:
        decoded_token = firebase_auth.verify_id_token(token)
        return decoded_token
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(user=Depends(verify_firebase_token)):
    return user

def admin_required(user=Depends(verify_firebase_token)):
    is_admin_claim = user.get("admin", False)
    user_email = user.get("email")

    if not is_admin_claim and user_email not in SUPER_ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied for {user_email}. Admin rights required."
        )
    return user