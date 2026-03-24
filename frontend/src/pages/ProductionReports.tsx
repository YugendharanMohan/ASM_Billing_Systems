import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  productionApi, workersApi, shedsApi,
  ProductionHistoryItem, Worker, Shed, ProductionUpdateEntry
} from "@/lib/api";
import { ProductionCharts } from "@/components/ProductionCharts";
import { ProductionEditModal } from "@/components/ProductionEditModal";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import {
  Calendar, FileText, Download, Loader2, Filter,
  TrendingUp, Search, X, Edit2, Trash2
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Helper interface to handle potential backend data mismatch
interface BackendProductionRecord extends Omit<ProductionHistoryItem, 'earnings'> {
  total_amount?: number;
  earnings?: number;
}

export default function ProductionReports() {
  const { toast } = useToast();

  // Filter states
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstDay.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedWorker, setSelectedWorker] = useState<string>("all");
  const [selectedLoom, setSelectedLoom] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Data states
  const [history, setHistory] = useState<BackendProductionRecord[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sheds, setSheds] = useState<Shed[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);

  // New State for Modals
  const [editEntry, setEditEntry] = useState<BackendProductionRecord | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<BackendProductionRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch filter options
  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        const [workersData, shedsData] = await Promise.all([
          workersApi.getAll(),
          shedsApi.getHierarchy(),
        ]);
        setWorkers(workersData.sort((a, b) => a.name.localeCompare(b.name)));
        setSheds(shedsData);
      } catch (error) {
        console.error("Failed to fetch filter data:", error);
      } finally {
        setIsLoadingFilters(false);
      }
    };
    fetchFilterData();
  }, []);

  // Fetch production history
  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const workerParam = selectedWorker === "all" ? undefined : selectedWorker;

      const data = await productionApi.getHistory(
        startDate,
        endDate,
        workerParam
      );
      setHistory(data);
    } catch (error) {
      console.error("Failed to fetch production history:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load production history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [startDate, endDate, selectedWorker]);

  // Handle Edit Save
  const handleEditSave = async (id: string, data: ProductionUpdateEntry) => {
    try {
      await productionApi.update(id, data);
      toast({
        title: "Entry Updated",
        description: "Production entry has been updated successfully.",
      });
      setEditEntry(null);
      fetchHistory(); // Refresh data
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update entry.",
        variant: "destructive",
      });
    }
  };

  // Handle Delete
  const handleDelete = async () => {
    if (!deleteEntry) return;
    try {
      setIsDeleting(true);
      await productionApi.delete(deleteEntry.id);
      toast({
        title: "Entry Deleted",
        description: "Production entry has been deleted.",
      });
      setDeleteEntry(null);
      fetchHistory(); // Refresh data
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete entry.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Get all looms from sheds and SORT them
  const allLooms = sheds.flatMap((shed) =>
    shed.looms.map((loom) => ({
      id: loom.id,
      label: `${loom.loom_number}`,
      loom_number: loom.loom_number,
      shed_name: shed.name
    }))
  ).sort((a, b) => {
    if (a.shed_name !== b.shed_name) return a.shed_name.localeCompare(b.shed_name);
    return a.loom_number.localeCompare(b.loom_number, undefined, { numeric: true });
  });

  // Process Data
  const processedHistory = history.map(item => {
    const worker = workers.find(w => w.id === item.worker_id);
    const workerName = worker ? worker.name : (item.worker_name || "Unknown");
    const earnings = item.total_amount !== undefined ? item.total_amount : (item.earnings || 0);
    return { ...item, worker_name: workerName, earnings };
  });

  // Filter history (Client Side)
  const filteredHistory = processedHistory.filter((item) => {
    if (selectedLoom !== "all" && item.loom_id !== selectedLoom) return false;
    const term = searchTerm.toLowerCase();
    const wName = item.worker_name ? item.worker_name.toLowerCase() : "";
    const lNum = item.loom_number ? item.loom_number.toLowerCase() : "";
    const sName = item.shed_name ? item.shed_name.toLowerCase() : "";
    return wName.includes(term) || lNum.includes(term) || sName.includes(term);
  });

  // Calculate totals
  const totals = filteredHistory.reduce(
    (acc, item) => ({
      meters: acc.meters + item.meters,
      earnings: acc.earnings + item.earnings,
    }),
    { meters: 0, earnings: 0 }
  );

  const clearFilters = () => {
    setSelectedWorker("all");
    setSelectedLoom("all");
    setSearchTerm("");
  };

  const exportToPDF = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Production Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; color: #333; }
          .meta { text-align: center; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          tr:nth-child(even) { background-color: #fafafa; }
          .totals { margin-top: 20px; font-weight: bold; text-align: right; }
        </style>
      </head>
      <body>
        <h1>Production Report</h1>
        <p class="meta">${startDate} to ${endDate}</p>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Worker</th><th>Shed</th><th>Loom</th><th>Shift</th><th>Meters</th><th>Rate</th><th>Earnings</th>
            </tr>
          </thead>
          <tbody>
            ${filteredHistory.map(item => `
              <tr>
                <td>${item.date}</td><td>${item.worker_name}</td><td>${item.shed_name}</td><td>${item.loom_number}</td>
                <td>${item.shift}</td><td>${item.meters.toFixed(2)}</td><td>₹${item.rate}</td><td>₹${item.earnings.toFixed(2)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
        <div class="totals"><p>Total Meters: ${totals.meters.toFixed(2)}</p><p>Total Earnings: ₹${totals.earnings.toFixed(2)}</p></div>
      </body>
      </html>
    `;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Production Reports
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            View, edit, and analyze production history with filters and charts
          </p>
        </div>
        <Button onClick={exportToPDF} disabled={filteredHistory.length === 0}>
          <Download className="w-4 h-4" /> Export PDF
        </Button>
      </div>

      <div className="card-elevated p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm text-foreground">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div><label className="form-label flex items-center gap-1"><Calendar className="w-3 h-3" /> Start Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-field" /></div>
          <div><label className="form-label flex items-center gap-1"><Calendar className="w-3 h-3" /> End Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-field" /></div>
          <div><label className="form-label">Worker</label><Select value={selectedWorker} onValueChange={setSelectedWorker}><SelectTrigger disabled={isLoadingFilters}><SelectValue placeholder="All Workers" /></SelectTrigger><SelectContent><SelectItem value="all">All Workers</SelectItem>{workers.map((w) => (<SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>))}</SelectContent></Select></div>
          <div><label className="form-label">Loom</label><Select value={selectedLoom} onValueChange={setSelectedLoom}><SelectTrigger disabled={isLoadingFilters}><SelectValue placeholder="All Looms" /></SelectTrigger><SelectContent><SelectItem value="all">All Looms</SelectItem>{allLooms.map((loom) => (<SelectItem key={loom.id} value={loom.id}>{loom.label}</SelectItem>))}</SelectContent></Select></div>
          <div><label className="form-label">Search</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..." className="form-field pl-9" /></div></div>
        </div>
        {(selectedWorker !== "all" || selectedLoom !== "all" || searchTerm) && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-3"><X className="w-3 h-3" /> Clear Filters</Button>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-primary" /><h2 className="font-semibold text-foreground">Production Trends</h2></div>
        <ProductionCharts history={filteredHistory as any} />
      </div>

      <div className="card-elevated overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold text-foreground">Production History</h3>
          <span className="text-sm text-muted-foreground">{filteredHistory.length} records</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No production records found for the selected filters</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Worker</TableHead><TableHead>Shed</TableHead><TableHead>Loom</TableHead><TableHead>Shift</TableHead>
                    <TableHead className="text-right">Meters</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Earnings</TableHead>
                    <TableHead className="w-24">Actions</TableHead> {/* ✅ Added Actions Column */}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.date}</TableCell>
                      <TableCell>{item.worker_name}</TableCell>
                      <TableCell>{item.shed_name}</TableCell>
                      <TableCell>{item.loom_number}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.shift === "Day" ? "bg-warning/20 text-warning" : "bg-secondary text-secondary-foreground"}`}>{item.shift}</span>
                      </TableCell>
                      <TableCell className="text-right">{item.meters.toFixed(2)}</TableCell>
                      <TableCell className="text-right">₹{item.rate}</TableCell>
                      <TableCell className="text-right font-semibold">₹{item.earnings.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditEntry(item)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteEntry(item)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="p-4 bg-muted/50 border-t flex justify-end gap-8">
              <div className="text-right"><span className="text-sm text-muted-foreground">Total Meters</span><p className="text-lg font-bold text-foreground">{totals.meters.toFixed(2)}</p></div>
              <div className="text-right"><span className="text-sm text-muted-foreground">Total Earnings</span><p className="text-lg font-bold text-primary">₹{totals.earnings.toFixed(2)}</p></div>
            </div>
          </>
        )}
      </div>

      {/*  Add Modals Here */}
      {editEntry && (
        <ProductionEditModal
          entry={editEntry}
          open={!!editEntry}
          onClose={() => setEditEntry(null)}
          onSave={handleEditSave}
          workers={workers}
          sheds={sheds}
        />
      )}

      {deleteEntry && (
        <DeleteConfirmDialog
          open={!!deleteEntry}
          onClose={() => setDeleteEntry(null)}
          onConfirm={handleDelete}
          title="Delete Production Entry"
          description={`Are you sure you want to delete this entry for ${deleteEntry.worker_name} on ${deleteEntry.date}? This action cannot be undone.`}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}