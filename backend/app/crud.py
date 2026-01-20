from datetime import datetime, timedelta
from .database import db # Import the Firestore client from your new database.py

class CRUD:
    # -------------------------------------------------
    # WORKER OPERATIONS
    # ------------------------------------------------- 
    @staticmethod
    def create_worker(worker_data: dict):
        """
        Input: Dictionary containing worker details.
        Output: The created worker document with its Firestore ID.
        """
        doc_ref = db.collection("workers").document()
        doc_ref.set(worker_data)
        return {"id": doc_ref.id, **worker_data}

    @staticmethod
    def get_workers():
        """Returns all workers from the 'workers' collection."""
        docs = db.collection("workers").stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]

    # -------------------------------------------------
    # SHED / LOOM OPERATIONS
    # -------------------------------------------------
    @staticmethod
    def create_shed(name: str):
        doc_ref = db.collection("sheds").document()
        doc_ref.set({"name": name.upper()})
        return {"id": doc_ref.id, "name": name.upper()}

    @staticmethod
    def create_loom(shed_id: str, loom_number: str):
        # Looms are stored as a sub-collection inside a specific Shed document
        doc_ref = db.collection("sheds").document(shed_id).collection("looms").document()
        doc_ref.set({"loom_number": loom_number})
        return {"id": doc_ref.id, "loom_number": loom_number}

    @staticmethod
    def get_hierarchy():
        """
        Output format MATCHES old SQL response.
        Fetches sheds and then fetches looms for each shed.
        """
        sheds_docs = db.collection("sheds").stream()
        hierarchy = []

        for shed_doc in sheds_docs:
            shed_data = shed_doc.to_dict()
            shed_id = shed_doc.id
            
            # Fetch looms for this specific shed
            looms_docs = db.collection("sheds").document(shed_id).collection("looms").stream()
            looms_list = [
                {"id": loom.id, "loom_number": loom.to_dict().get("loom_number")}
                for loom in looms_docs
            ]

            hierarchy.append({
                "id": shed_id,
                "name": shed_data.get("name"),
                "looms": looms_list
            })
        
        return hierarchy

    # -------------------------------------------------
    # PRODUCTION ENTRY
    # -------------------------------------------------
    @staticmethod
    def add_production(data: dict):
        """
        Calculates total_amount before saving to Firestore.
        'data' should contain worker_id, loom_id, shed_name, etc.
        """
        total_amount = data['meters'] * data['rate']
        record = {
            **data,
            "total_amount": total_amount,
            "date": str(data['date']) # Ensure date is stored as string for querying
        }
        
        doc_ref = db.collection("production").document()
        doc_ref.set(record)
        return {"id": doc_ref.id, **record}

    # -------------------------------------------------
    # SALARY CALCULATION (CRITICAL)
    # -------------------------------------------------
    @staticmethod
    def calculate_salary(worker_id: str, start: str, end: str):
        """
        OUTPUT STRUCTURE UNCHANGED.
        Filters by worker_id and a date range (ISO strings: YYYY-MM-DD).
        Requires a Firestore Index to run.
        """
        # Query Firestore production collection
        query = db.collection("production") \
            .where("worker_id", "==", worker_id) \
            .where("date", ">=", start) \
            .where("date", "<=", end) \
            .order_by("date") \
            .stream()

        details = []
        total_meters = 0
        total_salary = 0

        for doc in query:
            r = doc.to_dict()
            # Combine Shed Name and Loom Number for the UI display
            # Assumes 'shed_name' and 'loom_number' were saved in the production record
            loom_label = f"{r.get('shed_name', '')}{r.get('loom_number', '')}"
            
            details.append({
                "date": r.get("date"),
                "shift": r.get("shift"),
                "meters": r.get("meters"),
                "loom": loom_label,
                "loom_id": r.get("loom_id")
            })
            
            total_meters += r.get("meters", 0)
            total_salary += r.get("total_amount", 0)

        return {
            "details": details,
            "summary": {
                "total_meters": float(total_meters),
                "total_salary": float(total_salary)
            }
        }

    # -------------------------
    # WORKER MANAGEMENT UPDATES
    # -------------------------
    def update_worker(self, worker_id: str, data: dict):
        doc_ref = db.collection("workers").document(worker_id)
        doc = doc_ref.get()
        if not doc.exists:
            return None
        
        # Filter out None values so we don't overwrite with null
        update_data = {k: v for k, v in data.items() if v is not None}
        if update_data:
            doc_ref.update(update_data)
        
        return {**doc.to_dict(), **update_data, "id": worker_id}

    def delete_worker(self, worker_id: str):
        # Hard delete worker document
        db.collection("workers").document(worker_id).delete()
        return True

    # -------------------------
    # PRODUCTION REPORTS
    # -------------------------
    def get_production_history(self, start_date: str, end_date: str, worker_id: str = None):
        query = db.collection("production").where("date", ">=", start_date).where("date", "<=", end_date)
        
        if worker_id:
            query = query.where("worker_id", "==", worker_id)
            
        docs = query.stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]

    def get_analytics(self, start_date: str, end_date: str):
        # Fetch all data for the range
        docs = db.collection("production").where("date", ">=", start_date).where("date", "<=", end_date).stream()
        
        records = [{"id": doc.id, **doc.to_dict()} for doc in docs]
        
        # Calculate aggregates in Python
        total_meters = sum(r.get('meters', 0) for r in records)
        total_salary = sum(r.get('meters', 0) * r.get('rate', 0) for r in records)
        
        # Find top worker
        worker_totals = {}
        for r in records:
            w_id = r.get('worker_id')
            worker_totals[w_id] = worker_totals.get(w_id, 0) + r.get('meters', 0)
        
        top_worker_id = max(worker_totals, key=worker_totals.get) if worker_totals else None
        
        # Get active workers count
        active_workers = len(worker_totals.keys())

        return {
            "total_production": total_meters,
            "total_salary": total_salary,
            "active_workers": active_workers,
            "top_worker_id": top_worker_id
        }

    # -------------------------
    # ✅ NEW: PRODUCTION ENTRY MANAGEMENT (EDIT/DELETE)
    # -------------------------
    def delete_production(self, entry_id: str):
        """Deletes a production entry by ID."""
        doc_ref = db.collection("production").document(entry_id)
        if not doc_ref.get().exists:
            return False
        doc_ref.delete()
        return True

    def update_production(self, entry_id: str, updates: dict):
        """
        Updates meters/shift and recalculates total_amount.
        'updates' is a dict containing 'meters' or 'shift'.
        """
        doc_ref = db.collection("production").document(entry_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return None

        current_data = doc.to_dict()
        update_data = {}

        # 1. Update Shift if provided
        if "shift" in updates and updates["shift"] is not None:
            update_data["shift"] = updates["shift"]

        # 2. Update Meters & Recalculate Salary if provided
        if "meters" in updates and updates["meters"] is not None:
            new_meters = updates["meters"]
            update_data["meters"] = new_meters
            
            # We need the rate to recalculate total_amount. 
            # Use existing rate from DB, fallback to 0 if missing.
            rate = current_data.get("rate", 0)
            
            # Recalculate
            new_total = new_meters * rate
            update_data["total_amount"] = new_total

            # Some frontend views might look for 'earnings', so we keep it consistent
            update_data["earnings"] = new_total

        if update_data:
            doc_ref.update(update_data)
            
            # Return the updated record
            return {**current_data, **update_data, "id": entry_id}
        
        return {**current_data, "id": entry_id}

crud = CRUD()