/**
 * StatCard — Reusable summary metric card with optional trend indicator.
 * Used on Dashboard, Analytics, Orders, Attendance, and Expenses pages.
 */

import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    subtitle?: string;
    trend?: number;
}

export default function StatCard({ title, value, icon: Icon, subtitle, trend }: StatCardProps) {
    return (
        <div className="card-interactive p-5">
            <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10">
                    <Icon className="w-5 h-5 text-primary" />
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${trend >= 0 ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
                        }`}>
                        {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {trend >= 0 ? "+" : ""}{trend}%
                    </div>
                )}
            </div>
            <p className="text-sm text-muted-foreground mb-0.5">{title}</p>
            <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
    );
}
