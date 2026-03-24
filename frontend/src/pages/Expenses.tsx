import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Receipt, Loader2, Plus, Check, X, DollarSign,
    PieChart, Filter,
} from "lucide-react";

interface Expense {
    id: string;
    category: string;
    amount: number;
    description: string;
    date: string;
    status: string;
    submitted_email: string;
}

async function api<T>(url: string, opts?: RequestInit): Promise<T> {
    const token = localStorage.getItem("asm_token");
    const base = import.meta.env.VITE_API_URL || "";
    const res = await fetch(`${base}${url}`, {
        ...opts,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) },
    });
    if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
    return res.json();
}

const CATEGORIES = [
    "Electricity", "Maintenance", "Transport", "Raw Materials",
    "Equipment", "Rent", "Wages (Misc)", "Other",
];

export default function Expenses() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [form, setForm] = useState({ category: "Electricity", amount: "", description: "", date: new Date().toISOString().slice(0, 10) });
    const [saving, setSaving] = useState(false);

    const fetchExpenses = async () => {
        setIsLoading(true);
        try {
            const params = filterStatus !== "all" ? `?status=${filterStatus}` : "";
            const data = await api<Expense[]>(`/expenses/${params}`);
            setExpenses(data);
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchExpenses(); }, [filterStatus]);

    const handleSubmit = async () => {
        if (!form.amount) return;
        setSaving(true);
        try {
            await api("/expenses/", { method: "POST", body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }) });
            setShowForm(false);
            setForm({ category: "Electricity", amount: "", description: "", date: new Date().toISOString().slice(0, 10) });
            await fetchExpenses();
        } catch (err) { console.error(err); }
        finally { setSaving(false); }
    };

    const handleApproval = async (id: string, status: string) => {
        try {
            await api(`/expenses/${id}/approve`, { method: "PUT", body: JSON.stringify({ status, note: "" }) });
            setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, status } : e));
        } catch (err) { console.error(err); }
    };

    const total = expenses.filter((e) => e.status === "approved").reduce((s, e) => s + e.amount, 0);

    return (
        <div className="pb-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
                <Button onClick={() => setShowForm(!showForm)}>
                    <Plus className="w-4 h-4 mr-2" /> Add Expense
                </Button>
            </div>

            {/* Summary */}
            <div className="card-elevated p-4 flex items-center gap-4">
                <DollarSign className="w-5 h-5 text-primary" />
                <div>
                    <div className="text-sm text-muted-foreground">Total Approved</div>
                    <div className="text-xl font-bold text-foreground">₹{total.toLocaleString("en-IN")}</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Add Form */}
            {showForm && (
                <div className="card-elevated p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="form-label">Category</label>
                            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="form-label">Amount (₹)</label>
                            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="form-field" placeholder="0" />
                        </div>
                        <div>
                            <label className="form-label">Date</label>
                            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="form-field" />
                        </div>
                        <div>
                            <label className="form-label">Description</label>
                            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="form-field" placeholder="Optional" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleSubmit} disabled={saving}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Submit
                        </Button>
                    </div>
                </div>
            )}

            {/* List */}
            {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
                <div className="space-y-2">
                    {expenses.map((e) => (
                        <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                            <Receipt className="w-4 h-4 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground">{e.category} — ₹{e.amount.toLocaleString("en-IN")}</div>
                                <div className="text-xs text-muted-foreground">{e.date} {e.description && `• ${e.description}`}</div>
                            </div>
                            {e.status === "pending" ? (
                                <div className="flex gap-1">
                                    <Button size="sm" variant="ghost" className="text-green-600 h-7 px-2" onClick={() => handleApproval(e.id, "approved")}><Check className="w-3.5 h-3.5" /></Button>
                                    <Button size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={() => handleApproval(e.id, "rejected")}><X className="w-3.5 h-3.5" /></Button>
                                </div>
                            ) : (
                                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${e.status === "approved" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                                    {e.status}
                                </span>
                            )}
                        </div>
                    ))}
                    {expenses.length === 0 && (
                        <div className="text-center text-muted-foreground py-8">
                            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            No expenses found.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
