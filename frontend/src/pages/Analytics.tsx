import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    TrendingUp, TrendingDown, Minus, Loader2, Download,
    BarChart3, Users, DollarSign, Factory, Calendar,
    ArrowUpRight, ArrowDownRight,
} from "lucide-react";

interface CompareData {
    current_period: { start: string; end: string };
    previous_period: { start: string; end: string };
    period_days: number;
    production: { current: number; previous: number; change_pct: number };
    salary: { current: number; previous: number; change_pct: number };
    workers: { current: number; previous: number; change_pct: number };
}

interface WorkerPerf {
    worker_id: string; worker_name: string; total_meters: number;
    total_entries: number; total_salary: number; avg_meters_per_entry: number;
    attendance_rate: number; overall_score: number;
}

interface LoomEff {
    loom_id: string; loom_label: string; total_meters: number;
    total_entries: number; avg_meters_per_entry: number; unique_workers: number;
}

interface PnL {
    revenue: number; expenses: { total: number; by_category: Record<string, number> };
    salaries: number; gross_profit: number; margin_pct: number;
}

interface TrendPoint { date: string; meters: number; entries: number; salary: number; }

async function api<T>(url: string): Promise<T> {
    const token = localStorage.getItem("asm_token");
    const base = import.meta.env.VITE_API_URL || "";
    const res = await fetch(`${base}${url}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
    return res.json();
}

function getDateRange(preset: string): [string, string] {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    switch (preset) {
        case "this_month": {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            return [fmt(start), fmt(now)];
        }
        case "last_month": {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            return [fmt(start), fmt(end)];
        }
        case "this_quarter": {
            const q = Math.floor(now.getMonth() / 3);
            const start = new Date(now.getFullYear(), q * 3, 1);
            return [fmt(start), fmt(now)];
        }
        case "this_year": {
            const start = new Date(now.getFullYear(), 0, 1);
            return [fmt(start), fmt(now)];
        }
        default: {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            return [fmt(start), fmt(now)];
        }
    }
}

function ChangeIndicator({ value }: { value: number }) {
    if (value > 0) return <span className="flex items-center gap-0.5 text-green-500 text-xs font-medium"><ArrowUpRight className="w-3 h-3" />+{value}%</span>;
    if (value < 0) return <span className="flex items-center gap-0.5 text-destructive text-xs font-medium"><ArrowDownRight className="w-3 h-3" />{value}%</span>;
    return <span className="text-muted-foreground text-xs">0%</span>;
}

export default function Analytics() {
    const [preset, setPreset] = useState("this_month");
    const [isLoading, setIsLoading] = useState(true);
    const [compare, setCompare] = useState<CompareData | null>(null);
    const [workers, setWorkers] = useState<WorkerPerf[]>([]);
    const [looms, setLooms] = useState<LoomEff[]>([]);
    const [pnl, setPnl] = useState<PnL | null>(null);
    const [trend, setTrend] = useState<TrendPoint[]>([]);

    useEffect(() => { fetchAll(); }, [preset]);

    const fetchAll = async () => {
        setIsLoading(true);
        const [start, end] = getDateRange(preset);
        const qs = `start_date=${start}&end_date=${end}`;
        try {
            const [c, w, l, p, t] = await Promise.all([
                api<CompareData>(`/analytics/compare?${qs}`),
                api<WorkerPerf[]>(`/analytics/worker-performance?${qs}`),
                api<LoomEff[]>(`/analytics/loom-efficiency?${qs}`),
                api<PnL>(`/analytics/pnl?${qs}`),
                api<TrendPoint[]>(`/analytics/production-trend?${qs}`),
            ]);
            setCompare(c); setWorkers(w); setLooms(l); setPnl(p); setTrend(t);
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
    };

    const handleExport = (type: string) => {
        const [start, end] = getDateRange(preset);
        const token = localStorage.getItem("asm_token");
        const base = import.meta.env.VITE_API_URL || "";
        window.open(`${base}/export/${type}?start_date=${start}&end_date=${end}&token=${token}`, "_blank");
    };

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="pb-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
                <div className="flex items-center gap-3">
                    <Select value={preset} onValueChange={setPreset}>
                        <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="this_month">This Month</SelectItem>
                            <SelectItem value="last_month">Last Month</SelectItem>
                            <SelectItem value="this_quarter">This Quarter</SelectItem>
                            <SelectItem value="this_year">This Year</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select onValueChange={handleExport}>
                        <SelectTrigger className="w-[130px] h-9"><Download className="w-4 h-4 mr-2" /><SelectValue placeholder="Export" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="production">Production</SelectItem>
                            <SelectItem value="workers">Workers</SelectItem>
                            <SelectItem value="attendance">Attendance</SelectItem>
                            <SelectItem value="expenses">Expenses</SelectItem>
                            <SelectItem value="inventory">Inventory</SelectItem>
                            <SelectItem value="orders">Orders</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Comparative KPIs */}
            {compare && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { label: "Production", value: `${compare.production.current.toLocaleString("en-IN")} m`, change: compare.production.change_pct, icon: Factory, color: "text-blue-500" },
                        { label: "Salaries Paid", value: `₹${compare.salary.current.toLocaleString("en-IN")}`, change: compare.salary.change_pct, icon: DollarSign, color: "text-green-500" },
                        { label: "Active Workers", value: String(compare.workers.current), change: compare.workers.change_pct, icon: Users, color: "text-purple-500" },
                    ].map((kpi) => {
                        const Icon = kpi.icon;
                        return (
                            <div key={kpi.label} className="card-elevated p-4">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <Icon className={`w-4 h-4 ${kpi.color}`} />
                                        <span className="text-sm text-muted-foreground">{kpi.label}</span>
                                    </div>
                                    <ChangeIndicator value={kpi.change} />
                                </div>
                                <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* P&L */}
            {pnl && (
                <div className="card-elevated p-5">
                    <h2 className="text-lg font-semibold text-foreground mb-3">Profit & Loss</h2>
                    <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">Revenue</div>
                            <div className="text-xl font-bold text-green-500">₹{pnl.revenue.toLocaleString("en-IN")}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">Expenses</div>
                            <div className="text-xl font-bold text-destructive">₹{pnl.expenses.total.toLocaleString("en-IN")}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">Salaries</div>
                            <div className="text-xl font-bold text-orange-500">₹{pnl.salaries.toLocaleString("en-IN")}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">Profit</div>
                            <div className={`text-xl font-bold ${pnl.gross_profit >= 0 ? "text-green-500" : "text-destructive"}`}>
                                ₹{pnl.gross_profit.toLocaleString("en-IN")}
                            </div>
                            <div className="text-xs text-muted-foreground">{pnl.margin_pct}% margin</div>
                        </div>
                    </div>
                    {/* Expense breakdown */}
                    {Object.keys(pnl.expenses.by_category).length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                            <div className="text-xs text-muted-foreground mb-2">Expense Breakdown</div>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(pnl.expenses.by_category).sort(([, a], [, b]) => b - a).map(([cat, amt]) => (
                                    <span key={cat} className="px-2 py-1 text-xs rounded-md bg-muted text-foreground">
                                        {cat}: ₹{amt.toLocaleString("en-IN")}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Production Trend (simple bar representation) */}
            {trend.length > 0 && (
                <div className="card-elevated p-5">
                    <h2 className="text-lg font-semibold text-foreground mb-3">Daily Production</h2>
                    <div className="flex items-end gap-1 h-32">
                        {(() => {
                            const maxMeters = Math.max(...trend.map((t) => t.meters), 1);
                            return trend.map((t, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                                    <div
                                        className="w-full bg-primary/80 rounded-t hover:bg-primary transition-colors cursor-pointer min-h-[2px]"
                                        style={{ height: `${(t.meters / maxMeters) * 100}%` }}
                                        title={`${t.date}: ${t.meters}m`}
                                    />
                                    {trend.length <= 15 && (
                                        <span className="text-[9px] text-muted-foreground">{t.date.slice(5)}</span>
                                    )}
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            )}

            {/* Worker Performance */}
            {workers.length > 0 && (
                <div className="card-elevated p-5">
                    <h2 className="text-lg font-semibold text-foreground mb-3">Worker Performance</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                    <th className="pb-2 font-medium">#</th>
                                    <th className="pb-2 font-medium">Worker</th>
                                    <th className="pb-2 font-medium text-right">Meters</th>
                                    <th className="pb-2 font-medium text-right">Entries</th>
                                    <th className="pb-2 font-medium text-right">Avg/Entry</th>
                                    <th className="pb-2 font-medium text-right">Attendance</th>
                                    <th className="pb-2 font-medium text-right">Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {workers.slice(0, 10).map((w, i) => (
                                    <tr key={w.worker_id} className="border-b border-border/50">
                                        <td className="py-2 text-muted-foreground">{i + 1}</td>
                                        <td className="py-2 font-medium text-foreground">{w.worker_name}</td>
                                        <td className="py-2 text-right">{w.total_meters.toLocaleString("en-IN")}</td>
                                        <td className="py-2 text-right">{w.total_entries}</td>
                                        <td className="py-2 text-right">{w.avg_meters_per_entry}</td>
                                        <td className="py-2 text-right">{w.attendance_rate}%</td>
                                        <td className="py-2 text-right">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${w.overall_score >= 70 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                : w.overall_score >= 40 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                }`}>
                                                {w.overall_score}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Loom Efficiency */}
            {looms.length > 0 && (
                <div className="card-elevated p-5">
                    <h2 className="text-lg font-semibold text-foreground mb-3">Loom Efficiency</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                    <th className="pb-2 font-medium">Loom</th>
                                    <th className="pb-2 font-medium text-right">Total Meters</th>
                                    <th className="pb-2 font-medium text-right">Entries</th>
                                    <th className="pb-2 font-medium text-right">Avg/Entry</th>
                                    <th className="pb-2 font-medium text-right">Workers</th>
                                </tr>
                            </thead>
                            <tbody>
                                {looms.map((l) => (
                                    <tr key={l.loom_id} className="border-b border-border/50">
                                        <td className="py-2 font-medium text-foreground">{l.loom_label || l.loom_id}</td>
                                        <td className="py-2 text-right">{l.total_meters.toLocaleString("en-IN")}</td>
                                        <td className="py-2 text-right">{l.total_entries}</td>
                                        <td className="py-2 text-right">{l.avg_meters_per_entry}</td>
                                        <td className="py-2 text-right">{l.unique_workers}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
