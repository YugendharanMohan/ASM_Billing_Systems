// API Configuration - Update this URL for production
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

// Get the stored auth token
const getAuthToken = (): string | null => {
  return localStorage.getItem("asm_token");
};

// Generic fetch wrapper with auth
async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// =====================
// AUTH API
// =====================
export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface UserInfo {
  status: string;
  email: string;
  role: string;
  org_role: string;
  org_id: string | null;
  uid: string;
  is_super_admin: boolean;
  linked_worker_id: string | null;
}

export const authApi = {
  // login is now handled by Firebase JS SDK directly in AuthContext
  // The backend /auth/login endpoint is kept for Swagger/testing only

  getMe: async (): Promise<UserInfo> => {
    return fetchWithAuth<UserInfo>("/auth/me");
  },

  register: async (name: string, role: string): Promise<UserInfo> => {
    return fetchWithAuth<UserInfo>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, role }),
    });
  },
};

// =====================
// WORKERS API
// =====================
export interface Worker {
  id: string;
  name: string;
  phone?: string;
  is_active?: boolean;
  role?: string;
}

export const workersApi = {
  getAll: async (): Promise<Worker[]> => {
    return fetchWithAuth<Worker[]>("/workers/");
  },

  create: async (data: { name: string; phone?: string; role?: string }): Promise<Worker> => {
    return fetchWithAuth<Worker>("/workers/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: { name?: string; phone?: string; is_active?: boolean; role?: string }): Promise<Worker> => {
    return fetchWithAuth<Worker>(`/workers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<void> => {
    return fetchWithAuth<void>(`/workers/${id}`, {
      method: "DELETE",
    });
  },
};

// =====================
// SHEDS & LOOMS API
// =====================
export interface Loom {
  id: string;
  loom_number: string;
}

export interface Shed {
  id: string;
  name: string;
  looms: Loom[];
}

export const shedsApi = {
  getHierarchy: async (): Promise<Shed[]> => {
    return fetchWithAuth<Shed[]>("/sheds-looms/");
  },

  createShed: async (name: string): Promise<{ id: string; name: string }> => {
    const response = await fetch(`${API_BASE_URL}/sheds/?name=${encodeURIComponent(name)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to create shed" }));
      throw new Error(error.detail || "Failed to create shed");
    }

    return response.json();
  },

  createLoom: async (shedId: string, loomNumber: string): Promise<Loom> => {
    const response = await fetch(
      `${API_BASE_URL}/looms/?shed_id=${encodeURIComponent(shedId)}&loom_num=${encodeURIComponent(loomNumber)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to create loom" }));
      throw new Error(error.detail || "Failed to create loom");
    }

    return response.json();
  },
};

// =====================
// PRODUCTION API
// =====================
export interface ProductionEntry {
  worker_id: string;
  loom_id: string;
  shed_name: string;
  loom_number: string;
  date: string;
  shift: "Day" | "Night";
  meters: number;
  rate: number;
}

export interface ProductionRecord {
  id: string;
  date: string;
  shift: string;
  meters: number;
  loom_number: string;
  loom_id: string;
}

export interface ProductionHistoryItem {
  id: string;
  worker_id: string;
  worker_name: string;
  loom_id: string;
  loom_number: string;
  shed_name: string;
  date: string;
  shift: "Day" | "Night";
  meters: number;
  rate: number;
  earnings: number;
}

export interface ProductionAnalytics {
  daily_production: { date: string; meters: number; earnings: number }[];
  top_performers: { worker_id: string; worker_name: string; total_meters: number; total_earnings: number }[];
  loom_utilization: { loom_id: string; loom_number: string; shed_name: string; total_meters: number; usage_count: number }[];
  summary: {
    total_meters: number;
    total_earnings: number;
    avg_daily_meters: number;
    active_workers: number;
    active_looms: number;
  };
}

// NEW: Interface for Updates
export interface ProductionUpdateEntry {
  worker_id?: string;
  loom_id?: string;
  shed_name?: string;
  loom_number?: string;
  date?: string;
  shift?: "Day" | "Night";
  meters?: number;
  rate?: number;
}

export const productionApi = {
  add: async (entry: ProductionEntry): Promise<ProductionRecord> => {
    return fetchWithAuth<ProductionRecord>("/production/", {
      method: "POST",
      body: JSON.stringify(entry),
    });
  },

  // NEW: Update Method
  update: async (id: string, data: ProductionUpdateEntry): Promise<ProductionHistoryItem> => {
    return fetchWithAuth<ProductionHistoryItem>(`/production/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // NEW: Delete Method
  delete: async (id: string): Promise<void> => {
    return fetchWithAuth<void>(`/production/${id}`, {
      method: "DELETE",
    });
  },

  getHistory: async (startDate: string, endDate: string, workerId?: string): Promise<ProductionHistoryItem[]> => {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (workerId) params.append("worker_id", workerId);
    return fetchWithAuth<ProductionHistoryItem[]>(`/production/history?${params.toString()}`);
  },

  getAnalytics: async (startDate: string, endDate: string): Promise<ProductionAnalytics> => {
    return fetchWithAuth<ProductionAnalytics>(`/production/analytics?start_date=${startDate}&end_date=${endDate}`);
  },
};

// =====================
// SALARY API
// =====================
export interface SalaryDetail {
  date: string;
  shift: string;
  meters: number;
  loom: string;
  loom_id: string;
}

export interface SalarySummary {
  total_meters: number;
  total_salary: number;
}

export interface SalaryResponse {
  details: SalaryDetail[];
  summary: SalarySummary;
}

export const salaryApi = {
  calculate: async (workerId: string, startDate: string, endDate: string): Promise<SalaryResponse> => {
    return fetchWithAuth<SalaryResponse>(
      `/salary/calculate?worker_id=${encodeURIComponent(workerId)}&start_date=${startDate}&end_date=${endDate}`
    );
  },
};

// =====================
// ORGANIZATION API
// =====================
export interface Organization {
  id: string;
  name: string;
  industry?: string;
  phone?: string;
  address?: string;
  owner_uid: string;
  owner_email: string;
  plan: string;
  member_count: number;
  created_at: string;
}

export interface OrgMember {
  uid: string;
  email?: string;
  name?: string;
  role: string;
  joined_at: string;
}

export const orgApi = {
  create: async (data: { name: string; industry?: string; phone?: string; address?: string }): Promise<Organization> => {
    return fetchWithAuth<Organization>("/organizations/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getMyOrg: async (): Promise<Organization> => {
    return fetchWithAuth<Organization>("/organizations/me");
  },

  update: async (data: { name?: string; industry?: string; phone?: string; address?: string }): Promise<Organization> => {
    return fetchWithAuth<Organization>("/organizations/me", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};

export const membersApi = {
  list: async (): Promise<OrgMember[]> => {
    return fetchWithAuth<OrgMember[]>("/organizations/members");
  },

  invite: async (email: string, role: string, name: string, password: string): Promise<any> => {
    return fetchWithAuth("/organizations/members/invite", {
      method: "POST",
      body: JSON.stringify({ email, role, name, password }),
    });
  },

  updateRole: async (uid: string, role: string): Promise<any> => {
    return fetchWithAuth(`/organizations/members/${uid}`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
  },

  remove: async (uid: string): Promise<any> => {
    return fetchWithAuth(`/organizations/members/${uid}`, {
      method: "DELETE",
    });
  },
};

// =====================
// BILLING API
// =====================
export interface PlanInfo {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  trial_days: number;
  limits: {
    max_workers: number;
    max_sheds: number;
    max_looms_per_shed: number;
    max_production_entries_per_month: number;
    history_days: number;
    allow_pdf_export: boolean;
    allow_csv_export: boolean;
    allow_invite_members: boolean;
    max_members: number;
  };
}

export interface SubscriptionInfo {
  plan: string;
  plan_name: string;
  status: string;
  is_active: boolean;
  trial_start?: string;
  trial_end?: string;
  current_period_start?: string;
  current_period_end?: string;
  razorpay_subscription_id?: string;
  billing_cycle?: string;
  plan_limits: PlanInfo["limits"];
}

export interface UsageInfo {
  plan: string;
  usage: {
    workers: number;
    sheds: number;
    members: number;
    production_entries_this_month: number;
  };
  limits: PlanInfo["limits"];
  utilization: Record<string, string>;
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  method: string;
  razorpay_payment_id?: string;
}

export interface CheckoutResponse {
  subscription_id: string;
  razorpay_key_id: string;
  plan: string;
  amount: number;
}

export const billingApi = {
  getPlans: async (): Promise<PlanInfo[]> => {
    return fetchWithAuth<PlanInfo[]>("/billing/plans");
  },

  getSubscription: async (): Promise<SubscriptionInfo> => {
    return fetchWithAuth<SubscriptionInfo>("/billing/subscription");
  },

  getUsage: async (): Promise<UsageInfo> => {
    return fetchWithAuth<UsageInfo>("/billing/usage");
  },

  getInvoices: async (): Promise<Invoice[]> => {
    return fetchWithAuth<Invoice[]>("/billing/invoices");
  },

  checkout: async (planId: string, billingCycle: string = "monthly"): Promise<CheckoutResponse> => {
    return fetchWithAuth<CheckoutResponse>(
      `/billing/checkout?plan_id=${planId}&billing_cycle=${billingCycle}`,
      { method: "POST" }
    );
  },

  downgrade: async (): Promise<any> => {
    return fetchWithAuth("/billing/downgrade-to-free", { method: "POST" });
  },
};