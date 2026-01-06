"""
database.py
-----------
Single source for Firestore database access.

Firebase initialization is handled in firebase_admin.py.
This file ONLY exposes the Firestore client.
"""

from app.firebase_admin import db

__all__ = ["db"]
