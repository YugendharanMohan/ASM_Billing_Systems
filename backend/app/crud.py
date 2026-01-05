from datetime import date
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

crud = CRUD()