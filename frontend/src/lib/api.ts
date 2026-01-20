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
  uid: string;
}

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Login failed" }));
      throw new Error(error.detail || "Login failed");
    }

    return response.json();
  },

  getMe: async (): Promise<UserInfo> => {
    return fetchWithAuth<UserInfo>("/auth/me");
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
}

export const workersApi = {
  getAll: async (): Promise<Worker[]> => {
    return fetchWithAuth<Worker[]>("/workers/");
  },

  create: async (data: { name: string; phone?: string }): Promise<Worker> => {
    return fetchWithAuth<Worker>("/workers/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: { name?: string; phone?: string; is_active?: boolean }): Promise<Worker> => {
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

  getHistory: async (startDate: string, endDate: string, workerId?: string, loomId?: string): Promise<ProductionHistoryItem[]> => {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (workerId) params.append("worker_id", workerId);
    if (loomId) params.append("loom_id", loomId);
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