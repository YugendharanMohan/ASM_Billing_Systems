from datetime import datetime, timedelta
from google.cloud.firestore_v1 import Increment
from .database import db
from .plans import create_trial_subscription, TRIAL_PLAN


class CRUD:
    """
    Multi-tenant CRUD operations.
    
    All data is scoped under /organizations/{org_id}/ in Firestore.
    The org_id is extracted from Firebase custom claims by the auth middleware.
    
    Firestore structure:
        organizations/{org_id}/
            members/{uid_or_doc_id}   (user-to-org mapping, can have role 'Worker' or other roles)
            sheds/{shed_id}/looms/{loom_id}
            production/{entry_id}
    """

    # --------------------------------------------------
    # HELPER: Get org-scoped collection reference
    # --------------------------------------------------
    def _org_ref(self, org_id: str):
        """Returns the Firestore document reference for an organization."""
        return db.collection("organizations").document(org_id)

    def _col(self, org_id: str, collection_name: str):
        """Returns an org-scoped collection reference."""
        return self._org_ref(org_id).collection(collection_name)

    # --------------------------------------------------
    # ORGANIZATION MANAGEMENT
    # --------------------------------------------------
    def create_organization(self, data: dict, owner_uid: str, owner_email: str):
        """Creates a new organization with a 14-day Pro trial."""
        org_ref = db.collection("organizations").document()
        
        org_data = {
            **data,
            "owner_uid": owner_uid,
            "owner_email": owner_email,
            "created_at": datetime.utcnow().isoformat(),
            "plan": TRIAL_PLAN,
            "member_count": 1,
        }
        org_ref.set(org_data)
        
        # Add the creator as a member with Owner role
        org_ref.collection("members").document(owner_uid).set({
            "email": owner_email,
            "name": "Owner",
            "role": "Owner",
            "joined_at": datetime.utcnow().isoformat(),
        })
        
        # Auto-provision 14-day Pro trial
        trial_sub = create_trial_subscription()
        org_ref.collection("subscription").document("current").set(trial_sub)
        
        return {"id": org_ref.id, **org_data}

    def get_organization(self, org_id: str):
        """Returns organization details."""
        doc = self._org_ref(org_id).get()
        if not doc.exists:
            return None
        return {"id": doc.id, **doc.to_dict()}

    def update_organization(self, org_id: str, data: dict):
        """Updates organization details (name, phone, address, etc.)."""
        org_ref = self._org_ref(org_id)
        if not org_ref.get().exists:
            return None
        
        update_data = {k: v for k, v in data.items() if v is not None}
        if update_data:
            org_ref.update(update_data)
        
        doc = org_ref.get()
        return {"id": doc.id, **doc.to_dict()}

    def get_org_members(self, org_id: str):
        """Returns all members of an organization."""
        members = self._org_ref(org_id).collection("members").stream()
        return [{"uid": m.id, **m.to_dict()} for m in members]

    def add_member(self, org_id: str, uid: str, email: str, role: str, name: str = None):
        """Adds a user as a member of the organization."""
        self._org_ref(org_id).collection("members").document(uid).set({
            "email": email,
            "name": name,
            "role": role,
            "joined_at": datetime.utcnow().isoformat(),
        })
        
        # Atomically update member count
        self._org_ref(org_id).update({"member_count": Increment(1)})
        
        return {"uid": uid, "email": email, "role": role}

    def update_member_role(self, org_id: str, uid: str, new_role: str):
        """Updates a member's role within the organization."""
        member_ref = self._org_ref(org_id).collection("members").document(uid)
        if not member_ref.get().exists:
            return None
        member_ref.update({"role": new_role})
        return {"uid": uid, "role": new_role}

    def remove_member(self, org_id: str, uid: str):
        """Removes a member from the organization."""
        member_ref = self._org_ref(org_id).collection("members").document(uid)
        if not member_ref.get().exists:
            return False
        member_ref.delete()
        
        # Atomically decrement member count
        self._org_ref(org_id).update({"member_count": Increment(-1)})
        return True

    # -------------------------------------------------
    # SUBSCRIPTION MANAGEMENT
    # -------------------------------------------------
    def get_subscription(self, org_id: str):
        """Returns the current subscription for an org."""
        doc = self._org_ref(org_id).collection("subscription").document("current").get()
        if not doc.exists:
            return None
        return doc.to_dict()

    def update_subscription(self, org_id: str, data: dict):
        """Updates subscription fields (plan, status, razorpay IDs, etc.)."""
        sub_ref = self._org_ref(org_id).collection("subscription").document("current")
        sub_ref.set(data, merge=True)
        
        # Also update the plan field on the org doc for quick access
        if "plan" in data:
            self._org_ref(org_id).update({"plan": data["plan"]})
        
        return sub_ref.get().to_dict()

    def get_usage(self, org_id: str):
        """Returns current usage counts for plan limit enforcement."""
        members_query = self._org_ref(org_id).collection("members").stream()
        all_members = list(members_query)
        members_count = len(all_members)
        # Workers = members with role Worker (not Owner/Admin/Supervisor)
        NON_WORKER_ROLES = ("Owner", "Admin", "Supervisor")
        workers_count = sum(
            1 for m in all_members
            if m.to_dict().get("role") not in NON_WORKER_ROLES
        )
        sheds_count = len(list(self._col(org_id, "sheds").stream()))
        
        # Count production entries this month
        now = datetime.utcnow()
        month_start = now.replace(day=1).strftime("%Y-%m-%d")
        month_end = now.strftime("%Y-%m-%d")
        prod_query = self._col(org_id, "production") \
            .where("date", ">=", month_start) \
            .where("date", "<=", month_end)
        production_this_month = len(list(prod_query.stream()))
        
        return {
            "workers": workers_count,
            "sheds": sheds_count,
            "members": members_count,
            "production_entries_this_month": production_this_month,
        }

    def add_invoice(self, org_id: str, invoice_data: dict):
        """Stores an invoice record."""
        doc_ref = self._org_ref(org_id).collection("invoices").document()
        doc_ref.set(invoice_data)
        return {"id": doc_ref.id, **invoice_data}

    def get_invoices(self, org_id: str):
        """Returns all invoices for an org, newest first."""
        docs = self._org_ref(org_id).collection("invoices") \
            .order_by("created_at", direction="DESCENDING").stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]

    # -------------------------------------------------
    # WORKER OPERATIONS (Stored as members with role='Worker')
    # ------------------------------------------------- 
    # Roles that are NOT workers (used for filtering)
    NON_WORKER_ROLES = ("Owner", "Admin", "Supervisor")

    def create_worker(self, org_id: str, worker_data: dict):
        doc_ref = self._org_ref(org_id).collection("members").document()
        record = {
            "role": "Worker",
            **worker_data,
            "joined_at": datetime.utcnow().isoformat()
        }
        doc_ref.set(record)
        
        # Atomically increment member count
        self._org_ref(org_id).update({"member_count": Increment(1)})
        
        return {"id": doc_ref.id, **record}

    def get_workers(self, org_id: str):
        """Returns worker-role members only (excludes Owner, Admin, Supervisor)."""
        docs = self._org_ref(org_id).collection("members").stream()
        return [
            {"id": doc.id, **doc.to_dict()}
            for doc in docs
            if doc.to_dict().get("role") not in self.NON_WORKER_ROLES
        ]

    def update_worker(self, org_id: str, worker_id: str, data: dict):
        doc_ref = self._org_ref(org_id).collection("members").document(worker_id)
        doc = doc_ref.get()
        if not doc.exists:
            return None
        
        update_data = {k: v for k, v in data.items() if v is not None}
        if update_data:
            doc_ref.update(update_data)
        
        # Read fresh data after update
        updated_doc = doc_ref.get()
        return {**updated_doc.to_dict(), "id": worker_id}

    def delete_worker(self, org_id: str, worker_id: str):
        doc_ref = self._org_ref(org_id).collection("members").document(worker_id)
        if not doc_ref.get().exists:
            return False
        doc_ref.delete()
        
        # Atomically decrement member count
        self._org_ref(org_id).update({"member_count": Increment(-1)})
        
        return True

    # -------------------------------------------------
    # SHED / LOOM OPERATIONS (org-scoped)
    # -------------------------------------------------
    def create_shed(self, org_id: str, name: str):
        doc_ref = self._col(org_id, "sheds").document()
        doc_ref.set({"name": name.upper()})
        return {"id": doc_ref.id, "name": name.upper()}

    def create_loom(self, org_id: str, shed_id: str, loom_number: str):
        doc_ref = self._col(org_id, "sheds").document(shed_id).collection("looms").document()
        doc_ref.set({"loom_number": loom_number})
        return {"id": doc_ref.id, "loom_number": loom_number}

    def get_hierarchy(self, org_id: str):
        sheds_docs = self._col(org_id, "sheds").stream()
        hierarchy = []

        for shed_doc in sheds_docs:
            shed_data = shed_doc.to_dict()
            shed_id = shed_doc.id
            
            looms_docs = self._col(org_id, "sheds").document(shed_id).collection("looms").stream()
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
    # PRODUCTION ENTRY (org-scoped)
    # -------------------------------------------------
    def add_production(self, org_id: str, data: dict):
        total_amount = data['meters'] * data['rate']
        record = {
            **data,
            "total_amount": total_amount,
            "date": str(data['date'])
        }
        
        doc_ref = self._col(org_id, "production").document()
        doc_ref.set(record)
        return {"id": doc_ref.id, **record}

    # -------------------------------------------------
    # SALARY CALCULATION (org-scoped)
    # -------------------------------------------------
    def calculate_salary(self, org_id: str, worker_id: str, start: str, end: str):
        query = self._col(org_id, "production") \
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
    # PRODUCTION REPORTS (org-scoped)
    # -------------------------
    def get_production_history(self, org_id: str, start_date: str, end_date: str, worker_id: str = None):
        query = self._col(org_id, "production").where("date", ">=", start_date).where("date", "<=", end_date)
        
        if worker_id:
            query = query.where("worker_id", "==", worker_id)
            
        docs = query.stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]

    def get_analytics(self, org_id: str, start_date: str, end_date: str):
        docs = self._col(org_id, "production").where("date", ">=", start_date).where("date", "<=", end_date).stream()
        
        records = [{"id": doc.id, **doc.to_dict()} for doc in docs]
        
        total_meters = sum(r.get('meters', 0) for r in records)
        total_salary = sum(r.get('total_amount', 0) for r in records)
        
        worker_totals = {}
        for r in records:
            w_id = r.get('worker_id')
            worker_totals[w_id] = worker_totals.get(w_id, 0) + r.get('meters', 0)
        
        top_worker_id = max(worker_totals, key=worker_totals.get) if worker_totals else None
        active_workers = len(worker_totals.keys())

        return {
            "total_production": total_meters,
            "total_salary": total_salary,
            "active_workers": active_workers,
            "top_worker_id": top_worker_id
        }

    # -------------------------
    # PRODUCTION ENTRY MANAGEMENT (org-scoped)
    # -------------------------
    def delete_production(self, org_id: str, entry_id: str):
        doc_ref = self._col(org_id, "production").document(entry_id)
        if not doc_ref.get().exists:
            return False
        doc_ref.delete()
        return True

    def update_production(self, org_id: str, entry_id: str, updates: dict):
        doc_ref = self._col(org_id, "production").document(entry_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return None

        current_data = doc.to_dict()
        update_data = {}

        if "shift" in updates and updates["shift"] is not None:
            update_data["shift"] = updates["shift"]

        if "meters" in updates and updates["meters"] is not None:
            new_meters = updates["meters"]
            update_data["meters"] = new_meters
            rate = current_data.get("rate", 0)
            new_total = new_meters * rate
            update_data["total_amount"] = new_total
            update_data["earnings"] = new_total

        if update_data:
            doc_ref.update(update_data)
            return {**current_data, **update_data, "id": entry_id}
        
        return {**current_data, "id": entry_id}


crud = CRUD()