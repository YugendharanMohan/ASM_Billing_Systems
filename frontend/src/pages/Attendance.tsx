import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    CalendarCheck, Loader2, Users, CheckCircle2,
    XCircle, Clock, MinusCircle, Send, ChevronLeft, ChevronRight,
} from "lucide-react";

// Types
interface Worker {
    id: string;
    name: string;
}

interface DailyWorker {
    worker_id: string;
    worker_name: string;
    status: string;
    marked_at: string | null;
}

interface DailyReport {
    date: string;
    total_workers: number;
    present: number;
    absent: number;
    half_day: number;
    not_marked: number;
    workers: DailyWorker[];
}

interface LeaveRequest {
    id: string;
    worker_id: string;
    start_date: string;
    end_date: string;
    reason: string;
    status: string;
    created_at: string;
    reviewed_by: string | null;
    reviewer_note: string;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
    Present: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    Absent: <XCircle className="w-4 h-4 text-destructive" />,
    "Half-Day": <MinusCircle className="w-4 h-4 text-yellow-500" />,
    "Not Marked": <Clock className="w-4 h-4 text-muted-foreground" />,
};

const STATUS_COLORS: Record<string, string> = {
    Present: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    Absent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    "Half-Day": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    "Not Marked": "bg-muted text-muted-foreground",
};

// API helpers (inline to keep it simple)
async function fetchWithAuth<T>(url: string, opts?: RequestInit): Promise<T> {
    const token = localStorage.getItem("asm_token");
    const base = import.meta.env.VITE_API_URL || "";
    const res = await fetch(`${base}${url}`, {
        ...opts,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(opts?.headers || {}),
        },
    });
    if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
    return res.json();
}

export default function Attendance() {
    const { user } = useAuth();
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [report, setReport] = useState<DailyReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [savingWorker, setSavingWorker] = useState<string | null>(null);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [tab, setTab] = useState<"attendance" | "leaves">("attendance");

    useEffect(() => {
        fetchDailyReport();
    }, [date]);

    useEffect(() => {
        if (tab === "leaves") fetchLeaves();
    }, [tab]);

    const fetchDailyReport = async () => {
        setIsLoading(true);
        try {
            const data = await fetchWithAuth<DailyReport>(`/attendance/daily/${date}`);
            setReport(data);
        } catch (err) {
            console.error("Failed to load attendance:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLeaves = async () => {
        try {
            const data = await fetchWithAuth<LeaveRequest[]>("/leave/requests");
            setLeaveRequests(data);
        } catch (err) {
            console.error("Failed to load leave requests:", err);
        }
    };

    const markAttendance = async (workerId: string, status: string) => {
        setSavingWorker(workerId);
        try {
            await fetchWithAuth("/attendance/mark", {
                method: "POST",
                body: JSON.stringify({ worker_id: workerId, date, status }),
            });
            // Update local state
            setReport((prev) => {
                if (!prev) return prev;
                const updated = prev.workers.map((w) =>
                    w.worker_id === workerId ? { ...w, status, marked_at: new Date().toISOString() } : w
                );
                return {
                    ...prev,
                    workers: updated,
                    present: updated.filter((w) => w.status === "Present").length,
                    absent: updated.filter((w) => w.status === "Absent").length,
                    half_day: updated.filter((w) => w.status === "Half-Day").length,
                    not_marked: updated.filter((w) => w.status === "Not Marked").length,
                };
            });
        } catch (err) {
            console.error("Failed to mark attendance:", err);
        } finally {
            setSavingWorker(null);
        }
    };

    const reviewLeave = async (requestId: string, status: string) => {
        try {
            await fetchWithAuth(`/leave/requests/${requestId}`, {
                method: "PUT",
                body: JSON.stringify({ status, reviewer_note: "" }),
            });
            setLeaveRequests((prev) =>
                prev.map((lr) => (lr.id === requestId ? { ...lr, status } : lr))
            );
        } catch (err) {
            console.error("Failed to review leave:", err);
        }
    };

    const changeDate = (offset: number) => {
        const d = new Date(date);
        d.setDate(d.getDate() + offset);
        setDate(d.toISOString().slice(0, 10));
    };

    const markAllPresent = async () => {
        if (!report) return;
        const unmarked = report.workers.filter((w) => w.status === "Not Marked");
        if (unmarked.length === 0) return;

        try {
            await fetchWithAuth("/attendance/bulk", {
                method: "POST",
                body: JSON.stringify({
                    date,
                    entries: unmarked.map((w) => ({
                        worker_id: w.worker_id,
                        date,
                        status: "Present",
                    })),
                }),
            });
            await fetchDailyReport();
        } catch (err) {
            console.error("Failed to bulk mark:", err);
        }
    };

    return (
        <div className="pb-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                    <button
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "attendance" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                            }`}
                        onClick={() => setTab("attendance")}
                    >
                        Daily
                    </button>
                    <button
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "leaves" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                            }`}
                        onClick={() => setTab("leaves")}
                    >
                        Leave Requests
                    </button>
                </div>
            </div>

            {tab === "attendance" && (
                <>
                    {/* Date Navigation */}
                    <div className="flex items-center justify-between">
                        <Button variant="ghost" size="sm" onClick={() => changeDate(-1)}>
                            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                        </Button>
                        <div className="flex items-center gap-3">
                            <CalendarCheck className="w-5 h-5 text-primary" />
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="form-field w-auto"
                            />
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => changeDate(1)}>
                            Next <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>

                    {/* Summary Cards */}
                    {report && (
                        <div className="grid grid-cols-4 gap-3">
                            {[
                                { label: "Present", count: report.present, color: "text-green-500" },
                                { label: "Absent", count: report.absent, color: "text-destructive" },
                                { label: "Half-Day", count: report.half_day, color: "text-yellow-500" },
                                { label: "Not Marked", count: report.not_marked, color: "text-muted-foreground" },
                            ].map((s) => (
                                <div key={s.label} className="card-elevated p-3 text-center">
                                    <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
                                    <div className="text-xs text-muted-foreground">{s.label}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Quick Actions */}
                    {report && report.not_marked > 0 && (
                        <div className="flex justify-end">
                            <Button variant="outline" size="sm" onClick={markAllPresent}>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Mark all as Present ({report.not_marked})
                            </Button>
                        </div>
                    )}

                    {/* Worker List */}
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {report?.workers.map((w) => (
                                <div
                                    key={w.worker_id}
                                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        {STATUS_ICONS[w.status]}
                                        <span className="text-sm font-medium text-foreground truncate">
                                            {w.worker_name || w.worker_id}
                                        </span>
                                    </div>

                                    {/* Status Selector */}
                                    <div className="flex gap-1">
                                        {["Present", "Absent", "Half-Day"].map((s) => (
                                            <button
                                                key={s}
                                                disabled={savingWorker === w.worker_id}
                                                onClick={() => markAttendance(w.worker_id, s)}
                                                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${w.status === s
                                                    ? STATUS_COLORS[s]
                                                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                                    }`}
                                            >
                                                {savingWorker === w.worker_id ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    s
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {report?.workers.length === 0 && (
                                <div className="text-center text-muted-foreground py-8">
                                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    No workers found. Add workers first.
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Leave Requests Tab */}
            {tab === "leaves" && (
                <div className="space-y-3">
                    {leaveRequests.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            <Send className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            No leave requests yet.
                        </div>
                    ) : (
                        leaveRequests.map((lr) => (
                            <div
                                key={lr.id}
                                className="card-elevated p-4 flex items-center gap-4"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-foreground">
                                        Worker: {lr.worker_id}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {lr.start_date} → {lr.end_date}
                                        {lr.reason && ` • ${lr.reason}`}
                                    </div>
                                </div>
                                <div>
                                    {lr.status === "pending" ? (
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-green-600"
                                                onClick={() => reviewLeave(lr.id, "approved")}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-destructive"
                                                onClick={() => reviewLeave(lr.id, "rejected")}
                                            >
                                                Reject
                                            </Button>
                                        </div>
                                    ) : (
                                        <span
                                            className={`px-2 py-1 text-xs rounded-full font-medium ${lr.status === "approved"
                                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                }`}
                                        >
                                            {lr.status}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
