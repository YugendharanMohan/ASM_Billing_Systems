import { useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ProductionHistoryItem } from "@/lib/api";
import { TrendingUp, Users } from "lucide-react";

interface ProductionChartsProps {
  history: ProductionHistoryItem[];
}

export function ProductionCharts({ history }: ProductionChartsProps) {
  // Group by date for trend chart
  const dailyData = useMemo(() => {
    const grouped = history.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = { date: item.date, meters: 0, earnings: 0 };
      }
      acc[item.date].meters += item.meters;
      // Safety: Use earnings if available, otherwise default to 0
      acc[item.date].earnings += (item.earnings || 0);
      return acc;
    }, {} as Record<string, { date: string; meters: number; earnings: number }>);

    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [history]);

  // Group by worker for performance chart
  const workerData = useMemo(() => {
    const grouped = history.reduce((acc, item) => {
      if (!acc[item.worker_id]) {
        acc[item.worker_id] = {
          // Safety: Fallback to "Unknown" if name is missing
          name: item.worker_name || "Unknown",
          meters: 0,
          earnings: 0,
        };
      }
      acc[item.worker_id].meters += item.meters;
      acc[item.worker_id].earnings += (item.earnings || 0);
      return acc;
    }, {} as Record<string, { name: string; meters: number; earnings: number }>);

    return Object.values(grouped)
      .sort((a, b) => b.meters - a.meters)
      .slice(0, 10);
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground card-elevated">
        No data to display. Adjust your filters to see production trends.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Daily Production Trend */}
      <div className="card-elevated p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Daily Production Trend</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorMeters" x1="0" y1="0" x2="0" y2="1">
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
              <YAxis
                fontSize={12}
                tickLine={false}
                allowDecimals={false}
                className="fill-muted-foreground"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number, name: string) => [
                  name === "meters" ? `${value.toFixed(2)} m` : `₹${value.toFixed(2)}`,
                  name === "meters" ? "Meters" : "Earnings",
                ]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="meters"
                stroke="hsl(var(--primary))"
                fillOpacity={1}
                fill="url(#colorMeters)"
                name="Meters"
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
              data={workerData}
              layout="vertical"
              margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" fontSize={12} tickLine={false} className="fill-muted-foreground" />
              <YAxis
                type="category"
                dataKey="name"
                fontSize={11}
                tickLine={false}
                className="fill-muted-foreground"
                width={80}
                tickFormatter={(value) => value.length > 10 ? `${value.slice(0, 10)}...` : value}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => [
                  name === "meters" ? `${value.toFixed(2)} m` : `₹${value.toFixed(2)}`,
                  name === "meters" ? "Total Meters" : "Total Earnings",
                ]}
              />
              <Bar dataKey="meters" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} name="meters" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}