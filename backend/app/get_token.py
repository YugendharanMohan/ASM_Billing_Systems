import requests
import json

# ----------------------------------------------------
# CONFIGURATION
# ----------------------------------------------------
FIREBASE_WEB_API_KEY = "AIzaSyCF0EQpmBGAT_Wo4elFmUCgVYLhuzquZqM" 

def get_id_token(email, password):
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_WEB_API_KEY}"
    payload = {
        "email": email,
        "password": password,
        "returnSecureToken": True
    }
    
    response = requests.post(url, json=payload)
    
    if response.status_code == 200:
        token = response.json()['idToken']
        print(f"\nSUCCESS! Copy this token for {email}:\n")
        print(token)
        print("\n" + "-"*60 + "\n")
    else:
        print(f"\nFAILED for {email}:", response.text)

# Run for Admin
print("--- GENERATING ADMIN TOKEN ---")
get_id_token("yugendharanmohan@gmail.com", "Yugu@2005")

# Run for User (Create a fake user in Firebase Console first if needed)
print("--- GENERATING USER TOKEN ---")
get_id_token("user@gmail.com", "User@1234")