from database import supabase
from schemas import AdminAuth
from fastapi import HTTPException

def signup_admin(auth: AdminAuth):
    try:
        return supabase.auth.sign_up({
            "email": auth.email,
            "password": auth.password
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


def login_admin(auth: AdminAuth):
    try:
        return supabase.auth.sign_in_with_password({
            "email": auth.email,
            "password": auth.password
        })
    except Exception as e:
        print("SUPABASE LOGIN ERROR:", e)
        raise HTTPException(status_code=401, detail=str(e))
