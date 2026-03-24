import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
    Wallet, Plus, Minus, DollarSign, Play, History, User,
    ChevronDown, ChevronUp, Loader2, Download, FileText,
    Banknote, TrendingDown, Gift, ArrowRight,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

interface PayslipData {
    worker_id: string;
    worker_name: string;
    period_start: string;
    period_end: string;
    total_meters: number;
    base_salary: number;
    bonuses: number;
    allowances: number;
    deductions: number;
    advance_deduction: number;
    gross_salary: number;
    net_salary: number;
    components: { name: string; type: string; amount: number }[];
}

interface PayrollRun {
    id: string;
    period_start: string;
    period_end: string;
    worker_count: number;
    total_payout: number;
    status: string;
    generated_at: string;
    generated_by: string;
    notes: string;
}

interface Advance {
    id: string;
    worker_id: string;
    amount: number;
    balance: number;
    reason: string;
    issued_date: string;
    status: string;
}

interface SalaryComponent {
    id: string;
    worker_id: string;
    type: string;
    name: string;
    amount: number;
    recurring: boolean;
}

interface Worker {
    id: string;
    name: string;
}

export default function PayrollPage() {
    const { token } = useAuth();
    const [tab, setTab] = useState<"run" | "components" | "advances" | "history">("run");
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(false);

    // Payroll run
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        return d.toISOString().split("T")[0];
    });
    const [payslips, setPayslips] = useState<PayslipData[]>([]);
    const [runResult, setRunResult] = useState<any>(null);
    const [expandedWorker, setExpandedWorker] = useState<string | null>(null);

    // Components
    const [components, setComponents] = useState<SalaryComponent[]>([]);
    const [compForm, setCompForm] = useState({ worker_id: "", type: "bonus", name: "", amount: "" });

    // Advances
    const [advances, setAdvances] = useState<Advance[]>([]);
    const [advForm, setAdvForm] = useState({ worker_id: "", amount: "", reason: "" });
    const [repayForm, setRepayForm] = useState<{ id: string; amount: string } | null>(null);

    // History
    const [runs, setRuns] = useState<PayrollRun[]>([]);

    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    useEffect(() => {
        fetchWorkers();
    }, []);

    useEffect(() => {
        if (tab === "components") fetchComponents();
        if (tab === "advances") fetchAdvances();
        if (tab === "history") fetchRuns();
    }, [tab]);

    const fetchWorkers = async () => {
        const res = await fetch(`${API}/workers`, { headers });
        if (res.ok) setWorkers(await res.json());
    };

    const fetchComponents = async () => {
        const res = await fetch(`${API}/payroll/components`, { headers });
        if (res.ok) setComponents(await res.json());
    };

    const fetchAdvances = async () => {
        const res = await fetch(`${API}/payroll/advances`, { headers });
        if (res.ok) setAdvances(await res.json());
    };

    const fetchRuns = async () => {
        const res = await fetch(`${API}/payroll/runs`, { headers });
        if (res.ok) setRuns(await res.json());
    };

    const runPayroll = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/payroll/run`, {
                method: "POST",
                headers,
                body: JSON.stringify({ start_date: startDate, end_date: endDate }),
            });
            if (res.ok) {
                const data = await res.json();
                setRunResult(data);
                setPayslips(data.payslips || []);
            }
        } finally {
            setLoading(false);
        }
    };

    const addComponent = async () => {
        if (!compForm.worker_id || !compForm.name || !compForm.amount) return;
        await fetch(`${API}/payroll/components`, {
            method: "POST",
            headers,
            body: JSON.stringify({ ...compForm, amount: parseFloat(compForm.amount) }),
        });
        setCompForm({ worker_id: "", type: "bonus", name: "", amount: "" });
        fetchComponents();
    };

    const deleteComponent = async (id: string) => {
        await fetch(`${API}/payroll/components/${id}`, { method: "DELETE", headers });
        fetchComponents();
    };

    const issueAdvance = async () => {
        if (!advForm.worker_id || !advForm.amount) return;
        await fetch(`${API}/payroll/advances`, {
            method: "POST",
            headers,
            body: JSON.stringify({ ...advForm, amount: parseFloat(advForm.amount) }),
        });
        setAdvForm({ worker_id: "", amount: "", reason: "" });
        fetchAdvances();
    };

    const repayAdvance = async (advanceId: string, amount: string) => {
        await fetch(`${API}/payroll/advances/${advanceId}/repay`, {
            method: "POST",
            headers,
            body: JSON.stringify({ amount: parseFloat(amount) }),
        });
        setRepayForm(null);
        fetchAdvances();
    };

    const workerName = (id: string) => workers.find((w) => w.id === id)?.name || id;

    const tabs = [
        { key: "run" as const, label: "Run Payroll", icon: Play },
        { key: "components" as const, label: "Components", icon: DollarSign },
        { key: "advances" as const, label: "Advances", icon: Banknote },
        { key: "history" as const, label: "History", icon: History },
    ];

    return (
        <div className="pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Advanced Payroll</h1>
                    <p className="text-sm text-muted-foreground">Salary components, advances & payroll runs</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit">
                {tabs.map((t) => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* ============ RUN PAYROLL ============ */}
            {tab === "run" && (
                <div className="space-y-6">
                    <div className="bg-card border rounded-xl p-6">
                        <h2 className="font-semibold text-foreground mb-4">Execute Payroll Run</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                            <div>
                                <label className="form-label">Start Date</label>
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-field" />
                            </div>
                            <div>
                                <label className="form-label">End Date</label>
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-field" />
                            </div>
                            <Button onClick={runPayroll} disabled={loading} className="h-11">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                                Run Payroll
                            </Button>
                        </div>
                    </div>

                    {/* Run Result Summary */}
                    {runResult && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-card border rounded-xl p-5">
                                <p className="text-sm text-muted-foreground">Workers Processed</p>
                                <p className="text-2xl font-bold text-foreground">{runResult.worker_count}</p>
                            </div>
                            <div className="bg-card border rounded-xl p-5">
                                <p className="text-sm text-muted-foreground">Total Payout</p>
                                <p className="text-2xl font-bold text-foreground">₹{runResult.total_payout?.toLocaleString()}</p>
                            </div>
                            <div className="bg-card border rounded-xl p-5">
                                <p className="text-sm text-muted-foreground">Period</p>
                                <p className="text-lg font-semibold text-foreground">{runResult.period_start} → {runResult.period_end}</p>
                            </div>
                        </div>
                    )}

                    {/* Payslips */}
                    {payslips.length > 0 && (
                        <div className="bg-card border rounded-xl overflow-hidden">
                            <div className="p-4 border-b bg-muted/30">
                                <h3 className="font-semibold text-foreground">
                                    <FileText className="w-4 h-4 inline mr-2" />
                                    Payslips ({payslips.length})
                                </h3>
                            </div>
                            {payslips.map((ps) => (
                                <div key={ps.worker_id} className="border-b last:border-b-0">
                                    <button
                                        onClick={() => setExpandedWorker(expandedWorker === ps.worker_id ? null : ps.worker_id)}
                                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium text-foreground">{ps.worker_name}</span>
                                            <span className="text-xs text-muted-foreground">{ps.total_meters.toLocaleString()}m</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-lg font-bold text-foreground">₹{ps.net_salary.toLocaleString()}</span>
                                            {expandedWorker === ps.worker_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </div>
                                    </button>
                                    {expandedWorker === ps.worker_id && (
                                        <div className="px-4 pb-4 bg-muted/10 space-y-2 animate-in fade-in">
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                                <div><span className="text-muted-foreground">Base:</span> <span className="font-medium">₹{ps.base_salary.toLocaleString()}</span></div>
                                                <div className="text-green-600"><span className="text-muted-foreground">Bonuses:</span> +₹{ps.bonuses.toLocaleString()}</div>
                                                <div className="text-green-600"><span className="text-muted-foreground">Allowances:</span> +₹{ps.allowances.toLocaleString()}</div>
                                                <div className="text-red-600"><span className="text-muted-foreground">Deductions:</span> -₹{ps.deductions.toLocaleString()}</div>
                                            </div>
                                            {ps.advance_deduction > 0 && (
                                                <div className="text-sm text-red-600">
                                                    <span className="text-muted-foreground">Advance Deduction:</span> -₹{ps.advance_deduction.toLocaleString()}
                                                </div>
                                            )}
                                            {ps.components.length > 0 && (
                                                <div className="mt-2">
                                                    <p className="text-xs text-muted-foreground mb-1">Components:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {ps.components.map((c, i) => (
                                                            <span
                                                                key={i}
                                                                className={`text-xs px-2 py-1 rounded-md ${c.type === "bonus" ? "bg-green-500/10 text-green-600" :
                                                                    c.type === "allowance" ? "bg-blue-500/10 text-blue-600" :
                                                                        "bg-red-500/10 text-red-600"
                                                                    }`}
                                                            >
                                                                {c.name}: ₹{c.amount}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center pt-2 border-t mt-2">
                                                <span className="text-sm text-muted-foreground">Gross: ₹{ps.gross_salary.toLocaleString()}</span>
                                                <span className="text-lg font-bold text-foreground">Net: ₹{ps.net_salary.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ============ COMPONENTS ============ */}
            {tab === "components" && (
                <div className="space-y-6">
                    <div className="bg-card border rounded-xl p-6">
                        <h2 className="font-semibold text-foreground mb-4">Add Salary Component</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                            <div>
                                <label className="form-label">Worker</label>
                                <select value={compForm.worker_id} onChange={(e) => setCompForm({ ...compForm, worker_id: e.target.value })} className="form-field">
                                    <option value="">Select...</option>
                                    {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Type</label>
                                <select value={compForm.type} onChange={(e) => setCompForm({ ...compForm, type: e.target.value })} className="form-field">
                                    <option value="bonus">Bonus</option>
                                    <option value="allowance">Allowance</option>
                                    <option value="deduction">Deduction</option>
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Name</label>
                                <input value={compForm.name} onChange={(e) => setCompForm({ ...compForm, name: e.target.value })} className="form-field" placeholder="e.g. Festival Bonus" />
                            </div>
                            <div>
                                <label className="form-label">Amount (₹)</label>
                                <input type="number" value={compForm.amount} onChange={(e) => setCompForm({ ...compForm, amount: e.target.value })} className="form-field" />
                            </div>
                            <Button onClick={addComponent}><Plus className="w-4 h-4 mr-1" /> Add</Button>
                        </div>
                    </div>

                    <div className="bg-card border rounded-xl overflow-hidden">
                        <div className="p-4 border-b bg-muted/30">
                            <h3 className="font-semibold">Active Components ({components.filter(c => c.recurring !== false).length})</h3>
                        </div>
                        {components.length === 0 ? (
                            <p className="p-8 text-center text-muted-foreground">No salary components added yet</p>
                        ) : (
                            components.map((c) => (
                                <div key={c.id} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 hover:bg-muted/20">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${c.type === "bonus" ? "bg-green-500" : c.type === "allowance" ? "bg-blue-500" : "bg-red-500"}`} />
                                        <div>
                                            <span className="font-medium text-foreground">{c.name}</span>
                                            <span className="text-xs text-muted-foreground ml-2">({workerName(c.worker_id)})</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`font-semibold ${c.type === "deduction" ? "text-red-600" : "text-green-600"}`}>
                                            {c.type === "deduction" ? "-" : "+"}₹{c.amount.toLocaleString()}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${c.type === "bonus" ? "bg-green-500/10 text-green-600" : c.type === "allowance" ? "bg-blue-500/10 text-blue-600" : "bg-red-500/10 text-red-600"}`}>
                                            {c.type}
                                        </span>
                                        <Button variant="ghost" size="sm" onClick={() => deleteComponent(c.id)} className="text-muted-foreground hover:text-destructive">
                                            <Minus className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* ============ ADVANCES ============ */}
            {tab === "advances" && (
                <div className="space-y-6">
                    <div className="bg-card border rounded-xl p-6">
                        <h2 className="font-semibold text-foreground mb-4">Issue Advance</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                            <div>
                                <label className="form-label">Worker</label>
                                <select value={advForm.worker_id} onChange={(e) => setAdvForm({ ...advForm, worker_id: e.target.value })} className="form-field">
                                    <option value="">Select...</option>
                                    {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Amount (₹)</label>
                                <input type="number" value={advForm.amount} onChange={(e) => setAdvForm({ ...advForm, amount: e.target.value })} className="form-field" />
                            </div>
                            <div>
                                <label className="form-label">Reason</label>
                                <input value={advForm.reason} onChange={(e) => setAdvForm({ ...advForm, reason: e.target.value })} className="form-field" placeholder="Optional" />
                            </div>
                            <Button onClick={issueAdvance}><Plus className="w-4 h-4 mr-1" /> Issue</Button>
                        </div>
                    </div>

                    {/* Summary cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-card border rounded-xl p-5">
                            <p className="text-sm text-muted-foreground">Total Issued</p>
                            <p className="text-2xl font-bold text-foreground">₹{advances.reduce((s, a) => s + a.amount, 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-card border rounded-xl p-5">
                            <p className="text-sm text-muted-foreground">Outstanding</p>
                            <p className="text-2xl font-bold text-red-600">₹{advances.filter(a => a.status === "active").reduce((s, a) => s + a.balance, 0).toLocaleString()}</p>
                        </div>
                        <div className="bg-card border rounded-xl p-5">
                            <p className="text-sm text-muted-foreground">Active Advances</p>
                            <p className="text-2xl font-bold text-foreground">{advances.filter(a => a.status === "active").length}</p>
                        </div>
                    </div>

                    <div className="bg-card border rounded-xl overflow-hidden">
                        <div className="p-4 border-b bg-muted/30">
                            <h3 className="font-semibold">All Advances</h3>
                        </div>
                        {advances.length === 0 ? (
                            <p className="p-8 text-center text-muted-foreground">No advances issued yet</p>
                        ) : (
                            advances.map((a) => (
                                <div key={a.id} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 hover:bg-muted/20">
                                    <div>
                                        <span className="font-medium text-foreground">{workerName(a.worker_id)}</span>
                                        <span className="text-xs text-muted-foreground ml-2">{a.issued_date}</span>
                                        {a.reason && <span className="text-xs text-muted-foreground ml-2">— {a.reason}</span>}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="font-semibold text-foreground">₹{a.amount.toLocaleString()}</p>
                                            <p className="text-xs text-muted-foreground">Balance: ₹{a.balance.toLocaleString()}</p>
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded ${a.status === "active" ? "bg-yellow-500/10 text-yellow-600" : "bg-green-500/10 text-green-600"}`}>
                                            {a.status}
                                        </span>
                                        {a.status === "active" && (
                                            repayForm?.id === a.id ? (
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        value={repayForm.amount}
                                                        onChange={(e) => setRepayForm({ ...repayForm, amount: e.target.value })}
                                                        className="form-field w-24 h-8 text-sm"
                                                        placeholder="Amount"
                                                    />
                                                    <Button size="sm" onClick={() => repayAdvance(a.id, repayForm.amount)}>
                                                        <ArrowRight className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button variant="outline" size="sm" onClick={() => setRepayForm({ id: a.id, amount: "" })}>
                                                    Repay
                                                </Button>
                                            )
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* ============ HISTORY ============ */}
            {tab === "history" && (
                <div className="bg-card border rounded-xl overflow-hidden">
                    <div className="p-4 border-b bg-muted/30">
                        <h3 className="font-semibold">Payroll Run History</h3>
                    </div>
                    {runs.length === 0 ? (
                        <p className="p-8 text-center text-muted-foreground">No payroll runs yet. Run your first payroll above.</p>
                    ) : (
                        runs.map((r) => (
                            <div key={r.id} className="flex items-center justify-between px-4 py-4 border-b last:border-b-0 hover:bg-muted/20">
                                <div>
                                    <p className="font-medium text-foreground">{r.period_start} → {r.period_end}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {r.worker_count} workers • Generated by {r.generated_by} • {new Date(r.generated_at).toLocaleDateString()}
                                    </p>
                                    {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
                                </div>
                                <div className="text-right">
                                    <p className="text-xl font-bold text-foreground">₹{r.total_payout.toLocaleString()}</p>
                                    <span className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-600">{r.status}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
