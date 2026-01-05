import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

URL: str = os.getenv("SUPABASE_URL")
KEY: str = os.getenv("SUPABASE_KEY")

if not URL or not KEY:
    raise ValueError("SUPABASE_URL or SUPABASE_KEY not found in environment variables")

supabase: Client = create_client(URL, KEY)