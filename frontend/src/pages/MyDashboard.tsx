import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart3, CalendarCheck, TrendingUp, Clock } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

interface ProductionEntry {
    date: string;
    meters: number;
    total_amount: number;
    loom: string;
    shift: string;
}

interface MyAnalytics {
    total_meters: number;
    total_earnings: number;
    entries: number;
    history: ProductionEntry[];
}

export default function MyDashboard() {
    const { token, user } = useAuth();
    const [analytics, setAnalytics] = useState<MyAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Default to current month
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    ).padStart(2, "0")}`;

    useEffect(() => {
        if (!token) return;
        setLoading(true);
        fetch(`${API_BASE_URL}/me/analytics?start_date=${startDate}&end_date=${endDate}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(async (res) => {
                if (!res.ok) {
                    const err = await res.json().catch(() => ({ detail: "Failed to load" }));
                    throw new Error(err.detail || "Failed");
                }
                return res.json();
            })
            .then((data) => setAnalytics(data))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [token, startDate, endDate]);

    const recentEntries = useMemo(() => {
        if (!analytics?.history) return [];
        return [...analytics.history]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 10);
    }, [analytics]);

    const monthName = now.toLocaleString("default", { month: "long", year: "numeric" });

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center pb-8">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 pb-8">
                <div className="bg-destructive/10 text-destructive rounded-xl p-6 max-w-md text-center">
                    <h2 className="text-lg font-semibold mb-2">Unable to load your data</h2>
                    <p className="text-sm">{error}</p>
                    <p className="text-xs mt-3 text-muted-foreground">
                        If this persists, ask your admin to link your worker profile.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background px-4 pb-8 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-foreground">
                        Welcome, {user?.name || "Operator"} 👋
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Your production summary for <span className="font-medium text-foreground">{monthName}</span>
                    </p>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-card rounded-xl border p-5 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-primary" />
                            </div>
                            <span className="text-sm text-muted-foreground font-medium">Total Meters</span>
                        </div>
                        <p className="text-3xl font-bold text-foreground">
                            {analytics?.total_meters?.toLocaleString() ?? 0}
                        </p>
                    </div>

                    <div className="bg-card rounded-xl border p-5 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <BarChart3 className="w-5 h-5 text-green-600" />
                            </div>
                            <span className="text-sm text-muted-foreground font-medium">Total Earnings</span>
                        </div>
                        <p className="text-3xl font-bold text-foreground">
                            ₹{analytics?.total_earnings?.toLocaleString() ?? 0}
                        </p>
                    </div>

                    <div className="bg-card rounded-xl border p-5 shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <CalendarCheck className="w-5 h-5 text-blue-600" />
                            </div>
                            <span className="text-sm text-muted-foreground font-medium">Entries</span>
                        </div>
                        <p className="text-3xl font-bold text-foreground">
                            {analytics?.entries ?? 0}
                        </p>
                    </div>
                </div>

                {/* Recent Production */}
                <div className="bg-card rounded-xl border shadow-sm">
                    <div className="p-5 border-b">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Clock className="w-5 h-5 text-muted-foreground" />
                            Recent Production
                        </h2>
                    </div>
                    {recentEntries.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            No production entries this month yet.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                                        <th className="text-left p-3 font-medium text-muted-foreground">Loom</th>
                                        <th className="text-left p-3 font-medium text-muted-foreground">Shift</th>
                                        <th className="text-right p-3 font-medium text-muted-foreground">Meters</th>
                                        <th className="text-right p-3 font-medium text-muted-foreground">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentEntries.map((entry, i) => (
                                        <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                            <td className="p-3">{entry.date}</td>
                                            <td className="p-3">{entry.loom || "—"}</td>
                                            <td className="p-3 capitalize">{entry.shift || "—"}</td>
                                            <td className="p-3 text-right font-medium">{entry.meters}</td>
                                            <td className="p-3 text-right font-medium text-green-600">
                                                ₹{entry.total_amount?.toLocaleString() ?? 0}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
