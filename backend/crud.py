from database import supabase
from schemas import *

class CRUD:
    # --- Worker Operations ---
    @staticmethod
    def create_worker(worker: WorkerCreate):
        return supabase.table("workers").insert(worker.dict()).execute()

    @staticmethod
    def get_workers():
        return supabase.table("workers").select("*").execute()

    # --- Shed/Loom Operations ---
    @staticmethod
    def create_shed(name: str):
        return supabase.table("sheds").insert({"name": name.upper()}).execute()

    @staticmethod
    def create_loom(shed_id: int, loom_number: str):
        return supabase.table("looms").insert({"shed_id": shed_id, "loom_number": loom_number}).execute()

    @staticmethod
    def get_hierarchy():
        # Fetches Sheds and their related Looms in one call
        return supabase.table("sheds").select("id, name, looms(id, loom_number)").execute()

    # --- Production & Salary ---
    @staticmethod
    def add_production(data: ProductionCreate):
        return supabase.table("production_records").insert(data.dict()).execute()

    @staticmethod
    def calculate_salary(worker_id: int, start: str, end: str):
        res = supabase.table("production_records") \
            .select("total_amount, meters_produced, date, shift, looms(loom_number, sheds(name))") \
            .eq("worker_id", worker_id) \
            .gte("date", start) \
            .lte("date", end) \
            .execute()
        return res.data

crud = CRUD()