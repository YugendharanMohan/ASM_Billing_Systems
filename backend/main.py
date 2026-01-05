import os
from datetime import date
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from supabase import create_client, Client
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(title="Loom Management & Salary System")

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "Backend running"}

@app.get("/health")
def health():
    return {"status": "ok"}

# Mount the static directory
app.mount("/static", StaticFiles(directory="frontend"), name="static")

# --- HTML ROUTES (THE FIX) ---

@app.get("/", response_class=HTMLResponse)
async def read_login():
    return FileResponse('frontend/index.html')

@app.get("/dashboard", response_class=HTMLResponse)
async def read_dashboard():
    return FileResponse('frontend/dashboard.html')

@app.get("/salary-entry", response_class=HTMLResponse)
async def read_salary_entry():
    return FileResponse('frontend/salary_entry.html')

# --- SUPABASE CONNECTION ---
URL: str = os.getenv("SUPABASE_URL")
KEY: str = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(URL, KEY)

# --- PYDANTIC SCHEMAS ---
class WorkerBase(BaseModel):
    name: str
    phone: Optional[str] = None

class ProductionEntry(BaseModel):
    worker_id: int
    loom_id: int
    date: date
    shift: str
    meters: float
    rate: float

class UserAuth(BaseModel):
    email: str
    password: str

# --- API ENDPOINTS ---

@app.post("/auth/signup")
async def signup(auth: UserAuth):
    return supabase.auth.sign_up({"email": auth.email, "password": auth.password})

@app.post("/auth/login")
async def login(auth: UserAuth):
    return supabase.auth.sign_in_with_password({"email": auth.email, "password": auth.password})

@app.post("/workers/")
async def create_worker(worker: WorkerBase):
    res = supabase.table("workers").insert(worker.dict()).execute()
    return res.data

@app.get("/workers/")
async def list_workers():
    res = supabase.table("workers").select("*").execute()
    return res.data

@app.post("/sheds/")
async def add_shed(name: str):
    res = supabase.table("sheds").insert({"name": name.upper()}).execute()
    return res.data

@app.get("/sheds-looms/")
async def get_shed_hierarchy():
    res = supabase.table("sheds").select("id, name, looms(id, loom_number)").execute()
    return res.data

@app.post("/looms/")
async def add_loom(shed_id: int, loom_num: str):
    res = supabase.table("looms").insert({"shed_id": shed_id, "loom_number": loom_num}).execute()
    return res.data

@app.post("/production/")
async def add_production_record(entry: ProductionEntry):
    if entry.shift not in ["Day", "Night"]:
        raise HTTPException(status_code=400, detail="Shift must be Day or Night")
    
    payload = {
        "worker_id": entry.worker_id,
        "loom_id": entry.loom_id,
        "date": str(entry.date),
        "shift": entry.shift,
        "meters_produced": entry.meters,
        "rate_per_meter": entry.rate
    }
    res = supabase.table("production_records").insert(payload).execute()
    return {"status": "success", "data": res.data}

@app.get("/salary/calculate")
async def get_worker_salary(worker_id: int, start_date: date, end_date: date):
    # 1. Added 'loom_id' to the select string
    res = supabase.table("production_records") \
        .select("total_amount, meters_produced, date, shift, loom_id, looms(loom_number, sheds(name))") \
        .eq("worker_id", worker_id) \
        .gte("date", str(start_date)) \
        .lte("date", str(end_date)) \
        .execute()
    
    records = res.data
    if not records:
        return {"total_salary": 0, "total_meters": 0, "message": "No records found"}

    # Calculate totals using the stored amounts
    # Formula: $$ \text{Total Salary} = \sum (\text{meters\_produced} \times \text{rate\_per\_meter}) $$
    total_salary = sum(float(r['total_amount']) for r in records)
    total_meters = sum(float(r['meters_produced']) for r in records)
    
    breakdown = []
    for r in records:
        # 2. Appended 'loom_id' to each detail record
        breakdown.append({
            "date": r['date'],
            "shift": r['shift'],
            "loom": f"{r['looms']['sheds']['name']}{r['looms']['loom_number']}",
            "loom_id": r['loom_id'],  # Added this line
            "meters": r['meters_produced'],
            "amount": r['total_amount']
        })

    return {
        "summary": {
            "worker_id": worker_id,
            "period": f"{start_date} to {end_date}",
            "total_meters": total_meters,
            "total_salary": total_salary
        },
        "details": breakdown
    }


@app.get("/production_records/")
def get_worker_meters(
        worker_id: int, 
        loom_id: int, 
        date: date
    ):
        """
        Fetches the meters_produced for a specific worker on a specific loom and date.
        """
        
        # ---------------------------------------------------------
        # SQL LOGIC (Pseudo-code for your DB driver)
        # ---------------------------------------------------------
        query = """
            SELECT meters_produced 
            FROM production_records 
            WHERE worker_id = %s 
            AND loom_id = %s 
            AND date = %s;
        """
        
        # Example using a standard cursor (replace with your actual DB call)
        # cursor.execute(query, (worker_id, loom_id, date))
        # result = cursor.fetchone()
        
        # ---------------------------------------------------------
        # MOCK RESPONSE (Delete this and use real DB result above)
        # ---------------------------------------------------------
        result = {"meters_produced": -1} # Simulated data found in DB

        if result:
            return result
        else:
            raise HTTPException(status_code=404, detail="No production record found for these criteria")
        
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)