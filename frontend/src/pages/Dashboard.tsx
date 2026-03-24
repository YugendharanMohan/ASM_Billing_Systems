import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SalarySlipModal } from "@/components/SalarySlipModal";
import { DashboardCharts } from "@/components/DashboardCharts";
import { useAuth } from "@/contexts/AuthContext";
import { workersApi, shedsApi, salaryApi, Worker, Shed, SalaryResponse } from "@/lib/api";
import {
  Users, Plus, Warehouse, Settings2, FileSpreadsheet, ChevronRight,
  Calendar, Receipt, Loader2, BarChart3
} from "lucide-react";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  // Data states
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [sheds, setSheds] = useState<Shed[]>([]);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(true);
  const [isLoadingSheds, setIsLoadingSheds] = useState(true);

  // Form states
  const [workerName, setWorkerName] = useState("");
  const [shedName, setShedName] = useState("");
  const [selectedShed, setSelectedShed] = useState("");
  const [loomNum, setLoomNum] = useState("");
  const [isAddingWorker, setIsAddingWorker] = useState(false);
  const [isAddingShed, setIsAddingShed] = useState(false);
  const [isAddingLoom, setIsAddingLoom] = useState(false);

  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstDay.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Salary slip modal state
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [selectedWorkerForSlip, setSelectedWorkerForSlip] = useState<{ id: string; name: string } | null>(null);
  const [salaryData, setSalaryData] = useState<SalaryResponse | null>(null);
  const [isLoadingSlip, setIsLoadingSlip] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchWorkers();
    fetchSheds();
  }, []);

  const fetchWorkers = async () => {
    try {
      setIsLoadingWorkers(true);
      const data = await workersApi.getAll();
      setWorkers(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Failed to fetch workers:", error);
      toast({
        title: "Error",
        description: "Failed to load workers. Check your connection.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingWorkers(false);
    }
  };

  const fetchSheds = async () => {
    try {
      setIsLoadingSheds(true);
      const data = await shedsApi.getHierarchy();
      const sortedData = data
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((shed) => ({
          ...shed,
          looms: shed.looms.sort((a, b) =>
            a.loom_number.localeCompare(b.loom_number, undefined, { numeric: true })
          ),
        }));
      setSheds(sortedData);
    } catch (error) {
      console.error("Failed to fetch sheds:", error);
      toast({
        title: "Error",
        description: "Failed to load sheds. Check your connection.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSheds(false);
    }
  };

  const generateSlip = async (workerId: string, workerName: string) => {
    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select Start and End dates first.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoadingSlip(true);
      const data = await salaryApi.calculate(workerId, startDate, endDate);

      if (!data.details || data.details.length === 0) {
        toast({
          title: "No Records",
          description: "No records found for this period.",
          variant: "destructive",
        });
        return;
      }

      setSalaryData(data);
      setSelectedWorkerForSlip({ id: workerId, name: workerName });
      setSlipModalOpen(true);
    } catch (error) {
      console.error("Failed to calculate salary:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch salary data.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSlip(false);
    }
  };

  const addWorker = async () => {
    if (!workerName.trim()) {
      toast({
        title: "Error",
        description: "Enter worker name",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAddingWorker(true);
      const newWorker = await workersApi.create({ name: workerName });
      setWorkers([...workers, newWorker]);
      setWorkerName("");
      toast({
        title: "Success",
        description: "Worker added successfully",
      });
    } catch (error) {
      console.error("Failed to add worker:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add worker",
        variant: "destructive",
      });
    } finally {
      setIsAddingWorker(false);
    }
  };

  const addShed = async () => {
    if (!shedName.trim()) {
      toast({
        title: "Error",
        description: "Enter shed name",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAddingShed(true);
      const newShed = await shedsApi.createShed(shedName);
      setSheds([...sheds, { ...newShed, looms: [] }]);
      setShedName("");
      toast({
        title: "Success",
        description: "Shed added successfully",
      });
    } catch (error) {
      console.error("Failed to add shed:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add shed",
        variant: "destructive",
      });
    } finally {
      setIsAddingShed(false);
    }
  };

  const addLoom = async () => {
    if (!selectedShed || !loomNum.trim()) {
      toast({
        title: "Error",
        description: "Select shed and enter loom number",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAddingLoom(true);
      const newLoom = await shedsApi.createLoom(selectedShed, loomNum);
      setSheds(
        sheds.map((shed) => {
          if (shed.id === selectedShed) {
            return {
              ...shed,
              looms: [...shed.looms, newLoom],
            };
          }
          return shed;
        })
      );
      setLoomNum("");
      toast({
        title: "Success",
        description: "Loom added to shed",
      });
    } catch (error) {
      console.error("Failed to add loom:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add loom",
        variant: "destructive",
      });
    } finally {
      setIsAddingLoom(false);
    }
  };

  return (
    <div className="pb-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage workers, sheds, and looms</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workers Section */}
        <div className="card-elevated p-6 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h2 className="font-bold text-lg text-foreground">Workers</h2>
          </div>

          <div className="space-y-3 mb-5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="form-label flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="form-field text-sm"
                />
              </div>
              <div>
                <label className="form-label flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="form-field text-sm"
                />
              </div>
            </div>

            {isAdmin && (
              <div className="flex gap-2">
                <input
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  placeholder="New Worker Name"
                  className="form-field flex-grow"
                  onKeyDown={(e) => e.key === "Enter" && addWorker()}
                  disabled={isAddingWorker}
                />
                <Button onClick={addWorker} size="icon" disabled={isAddingWorker}>
                  {isAddingWorker ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            {isLoadingWorkers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <ul className="space-y-1 max-h-64 overflow-y-auto">
                {workers.map((w) => (
                  <li
                    key={w.id}
                    onClick={() => generateSlip(w.id, w.name)}
                    className="flex justify-between items-center py-2.5 px-3 rounded-lg hover:bg-accent cursor-pointer group transition-colors"
                  >
                    <span className="font-medium text-foreground">{w.name}</span>
                    <span className="text-xs text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      {isLoadingSlip ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Receipt className="w-3 h-3" /> VIEW SLIP <ChevronRight className="w-3 h-3" />
                        </>
                      )}
                    </span>
                  </li>
                ))}
                {workers.length === 0 && (
                  <li className="text-center py-4 text-muted-foreground text-sm">
                    No workers found
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* Loom Configuration Section */}
        <div className="card-elevated p-6 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-secondary-foreground" />
            </div>
            <h2 className="font-bold text-lg text-foreground">Sheds & Looms</h2>
          </div>

          <div className="space-y-4">
            {/* Add Shed - Admin Only */}
            {isAdmin && (
              <div>
                <label className="form-label">Add New Shed</label>
                <div className="flex gap-2">
                  <input
                    value={shedName}
                    onChange={(e) => setShedName(e.target.value)}
                    placeholder="Shed Name (A, B...)"
                    className="form-field flex-grow"
                    onKeyDown={(e) => e.key === "Enter" && addShed()}
                    disabled={isAddingShed}
                  />
                  <Button onClick={addShed} variant="secondary" disabled={isAddingShed}>
                    {isAddingShed ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                  </Button>
                </div>
              </div>
            )}

            {/* Add Loom to Shed - Admin Only */}
            {isAdmin && (
              <div className="border-t pt-4">
                <label className="form-label">Add Loom to Shed</label>
                <select
                  value={selectedShed}
                  onChange={(e) => setSelectedShed(e.target.value)}
                  className="form-field mb-2"
                  disabled={isAddingLoom}
                >
                  <option value="">Select Shed</option>
                  {sheds.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  value={loomNum}
                  onChange={(e) => setLoomNum(e.target.value)}
                  placeholder="Loom Number"
                  className="form-field mb-2"
                  onKeyDown={(e) => e.key === "Enter" && addLoom()}
                  disabled={isAddingLoom}
                />
                <Button onClick={addLoom} className="w-full" disabled={isAddingLoom}>
                  {isAddingLoom ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Warehouse className="w-4 h-4" />
                      Add Loom to Shed
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Sheds List */}
            <div className={isAdmin ? "border-t pt-4" : ""}>
              <p className="form-label mb-2">Current Sheds</p>
              {isLoadingSheds ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-2">
                  {sheds.map((shed) => (
                    <div key={shed.id} className="p-3 bg-muted rounded-lg">
                      <p className="font-semibold text-foreground text-sm">{shed.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {shed.looms.length} loom{shed.looms.length !== 1 ? "s" : ""}:{" "}
                        {shed.looms.map((l) => l.loom_number).join(", ") || "None"}
                      </p>
                    </div>
                  ))}
                  {sheds.length === 0 && (
                    <p className="text-center py-4 text-muted-foreground text-sm">No sheds found</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions Section */}
        <div
          className="card-elevated p-6 flex flex-col justify-center animate-slide-up"
          style={{ animationDelay: "0.3s" }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-success" />
            </div>
            <h2 className="font-bold text-lg text-foreground">Quick Actions</h2>
          </div>

          <Link to="/salary-entry" className="block">
            <Button variant="success" size="lg" className="w-full h-14 text-base">
              <FileSpreadsheet className="w-5 h-5" />
              Daily Meter Entry
            </Button>
          </Link>

          <p className="text-muted-foreground text-xs text-center mt-6 italic">
            Select a worker above to generate their salary slip
          </p>

          {/* Stats preview */}
          <div className="mt-6 pt-6 border-t grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{workers.length}</p>
              <p className="text-xs text-muted-foreground">Total Workers</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">
                {sheds.reduce((acc, s) => acc + s.looms.length, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Total Looms</p>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-foreground">Analytics</h2>
            <p className="text-muted-foreground text-sm">Overview of your loom infrastructure</p>
          </div>
        </div>
        <DashboardCharts sheds={sheds} workersCount={workers.length} />
      </div>

      {/* Salary Slip Modal */}
      {selectedWorkerForSlip && salaryData && (
        <SalarySlipModal
          isOpen={slipModalOpen}
          onClose={() => setSlipModalOpen(false)}
          workerName={selectedWorkerForSlip.name}
          startDate={startDate}
          endDate={endDate}
          details={salaryData.details}
          summary={salaryData.summary}
        />
      )}
    </div>
  );
}