import { useState, useEffect, useMemo } from "react";
import { productionApi, ProductionHistoryItem } from "@/lib/api";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { 
  TrendingUp, Users, Activity, Calendar, 
  Loader2, Gauge, DollarSign, Target 
} from "lucide-react";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface AnalyticsDashboardProps {
  startDate: string;
  endDate: string;
}

export function AnalyticsDashboard({ startDate, endDate }: AnalyticsDashboardProps) {
  const [history, setHistory] = useState<ProductionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch Raw History Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // We use getHistory because it contains all the raw data we need
        const data = await productionApi.getHistory(startDate, endDate);
        setHistory(data);
      } catch (error) {
        console.error("Failed to fetch history for analytics:", error);
        setHistory([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  // 2. Client-Side Aggregation (Calculations)
  const analytics = useMemo(() => {
    if (history.length === 0) return null;

    // --- A. Summary Totals ---
    const total_meters = history.reduce((sum, item) => sum + item.meters, 0);
    const total_earnings = history.reduce((sum, item) => sum + (item.earnings || (item.meters * item.rate)), 0);
    
    // Estimate active workers/looms (unique count)
    const uniqueWorkers = new Set(history.map(h => h.worker_id));
    const uniqueLooms = new Set(history.map(h => h.loom_id));
    
    // Days diff for average
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayDiff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    // --- B. Daily Production (Area Chart) ---
    const dailyMap = new Map<string, { date: string; meters: number }>();
    history.forEach(item => {
      const current = dailyMap.get(item.date) || { date: item.date, meters: 0 };
      current.meters += item.meters;
      dailyMap.set(item.date, current);
    });
    // Sort by date
    const daily_production = Array.from(dailyMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // --- C. Top Performers (Bar Chart) ---
    const workerMap = new Map<string, { worker_name: string; total_meters: number }>();
    history.forEach(item => {
      const current = workerMap.get(item.worker_id) || { worker_name: item.worker_name || "Unknown", total_meters: 0 };
      current.total_meters += item.meters;
      // Update name if we found a better one (not Unknown)
      if (item.worker_name && current.worker_name === "Unknown") current.worker_name = item.worker_name;
      workerMap.set(item.worker_id, current);
    });
    const top_performers = Array.from(workerMap.values())
      .sort((a, b) => b.total_meters - a.total_meters);

    // --- D. Loom Utilization (Bar Chart) ---
    const loomMap = new Map<string, { loom_number: string; shed_name: string; total_meters: number; usage_count: number }>();
    history.forEach(item => {
      const current = loomMap.get(item.loom_id) || { 
        loom_number: item.loom_number, 
        shed_name: item.shed_name, 
        total_meters: 0, 
        usage_count: 0 
      };
      current.total_meters += item.meters;
      current.usage_count += 1;
      loomMap.set(item.loom_id, current);
    });
    // Sort logic: Shed Name then Loom Number
    const loom_utilization = Array.from(loomMap.values()).sort((a, b) => {
      if (a.shed_name !== b.shed_name) return a.shed_name.localeCompare(b.shed_name);
      return a.loom_number.localeCompare(b.loom_number, undefined, { numeric: true });
    });

    return {
      daily_production,
      top_performers,
      loom_utilization,
      summary: {
        total_meters,
        total_earnings,
        avg_daily_meters: total_meters / dayDiff,
        active_workers: uniqueWorkers.size,
        active_looms: uniqueLooms.size
      }
    };
  }, [history, startDate, endDate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-8 text-muted-foreground card-elevated">
        <p>No analytics data available for this period.</p>
        <p className="text-sm mt-1">Try selecting a different date range.</p>
      </div>
    );
  }

  const { daily_production, top_performers, loom_utilization, summary } = analytics;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card-elevated p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{summary.total_meters.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-muted-foreground">Total Meters</p>
          </div>
        </div>

        <div className="card-elevated p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">₹{summary.total_earnings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-muted-foreground">Total Earnings</p>
          </div>
        </div>

        <div className="card-elevated p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-chart-2" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{summary.avg_daily_meters.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Avg Daily Meters</p>
          </div>
        </div>

        <div className="card-elevated p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-chart-3" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{summary.active_workers}</p>
            <p className="text-xs text-muted-foreground">Active Workers</p>
          </div>
        </div>

        <div className="card-elevated p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
            <Gauge className="w-5 h-5 text-chart-4" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{summary.active_looms}</p>
            <p className="text-xs text-muted-foreground">Active Looms</p>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Production Trend */}
        <div className="card-elevated p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Daily Production</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily_production} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorDailyMeters" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  fontSize={10}
                  tickLine={false}
                  className="fill-muted-foreground"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                  }}
                />
                <YAxis fontSize={12} tickLine={false} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)} m`, "Meters"]}
                />
                <Area
                  type="monotone"
                  dataKey="meters"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorDailyMeters)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Performers */}
        <div className="card-elevated p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Top Performers</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top_performers.slice(0, 5)}
                layout="vertical"
                margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" fontSize={12} tickLine={false} className="fill-muted-foreground" />
                <YAxis
                  type="category"
                  dataKey="worker_name"
                  fontSize={11}
                  tickLine={false}
                  className="fill-muted-foreground"
                  width={80}
                  tickFormatter={(value) => (value.length > 10 ? `${value.slice(0, 10)}...` : value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)} m`, "Total Meters"]}
                />
                <Bar dataKey="total_meters" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Loom Utilization */}
      <div className="card-elevated p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Loom Utilization</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={loom_utilization.slice(0, 15)} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="loom_number"
                fontSize={11}
                tickLine={false}
                className="fill-muted-foreground"
                tickFormatter={(value, index) => {
                  const item = loom_utilization[index];
                  // Keep simple formatting
                  return item ? `${item.shed_name}-${value}` : value;
                }}
              />
              <YAxis fontSize={12} tickLine={false} className="fill-muted-foreground" />
              {/* ✅ FIX APPLIED HERE:
                 Typed payload as 'any' to avoid strict TypeScript overload errors 
                 from Recharts types.
              */}
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelFormatter={(label, payload: any) => {
                  if (payload && payload[0]) {
                    const data = payload[0].payload;
                    return `${data.shed_name} - Loom ${data.loom_number}`;
                  }
                  return label;
                }}
                formatter={(value: number, name: string) => [
                  name === "total_meters" ? `${value.toFixed(1)} m` : value,
                  name === "total_meters" ? "Total Meters" : "Usage Count",
                ]}
              />
              <Legend />
              <Bar dataKey="total_meters" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Total Meters" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}