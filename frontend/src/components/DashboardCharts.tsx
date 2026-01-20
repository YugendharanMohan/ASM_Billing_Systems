import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Shed } from "@/lib/api";
import { TrendingUp, PieChart as PieChartIcon, Users } from "lucide-react"; 

interface DashboardChartsProps {
  sheds: Shed[];
  workersCount: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function DashboardCharts({ sheds, workersCount }: DashboardChartsProps) {
  const loomsBySheds = useMemo(() => {
    return sheds.map((shed) => ({
      name: `${shed.name}`,
      looms: shed.looms.length,
    }));
  }, [sheds]);

  const pieData = useMemo(() => {
    return sheds.map((shed, index) => ({
      name: `${shed.name}`,
      value: shed.looms.length,
      color: COLORS[index % COLORS.length],
    }));
  }, [sheds]);

  const totalLooms = sheds.reduce((acc, s) => acc + s.looms.length, 0);

  if (sheds.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Add sheds and looms to see analytics
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Bar Chart - Looms per Shed */}
      <div className="card-elevated p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Looms per Shed</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={loomsBySheds} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="name" 
                fontSize={12} 
                tickLine={false}
                className="fill-muted-foreground"
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
              />
              <Bar 
                dataKey="looms" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
                name="Looms"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie Chart - Distribution */}
      <div className="card-elevated p-6">
        <div className="flex items-center gap-2 mb-4">
          <PieChartIcon className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Loom Distribution</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => 
                  `${name} (${(percent * 100).toFixed(0)}%)`
                }
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Added Workers Count to the Stats Grid */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold text-foreground">{sheds.length}</p>
            <p className="text-xs text-muted-foreground">Total Sheds</p>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold text-foreground">{totalLooms}</p>
            <p className="text-xs text-muted-foreground">Total Looms</p>
          </div>
          <div className="p-3 bg-muted rounded-lg">
             {/* ✅ Added this block to use the workersCount prop */}
            <p className="text-2xl font-bold text-foreground">{workersCount}</p>
            <p className="text-xs text-muted-foreground">Workers</p>
          </div>
        </div>
      </div>
    </div>
  );
}