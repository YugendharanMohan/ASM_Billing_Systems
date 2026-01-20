import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductionHistoryItem, ProductionUpdateEntry, Worker, Shed } from "@/lib/api";
import { Loader2, Calendar, Sun, Moon, Ruler, IndianRupee } from "lucide-react";

// Helper type to handle potentially missing earnings in frontend types
interface ExtendedProductionHistoryItem extends Omit<ProductionHistoryItem, 'earnings'> {
  earnings?: number;
  total_amount?: number;
}

interface ProductionEditModalProps {
  entry: ExtendedProductionHistoryItem | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, data: ProductionUpdateEntry) => Promise<void>;
  workers: Worker[];
  sheds: Shed[];
}

export function ProductionEditModal({
  entry,
  open,
  onClose,
  onSave,
  workers,
  sheds,
}: ProductionEditModalProps) {
  const [formData, setFormData] = useState<ProductionUpdateEntry>({
    date: "",
    shift: "Day",
    worker_id: "",
    loom_id: "",
    shed_name: "",
    loom_number: "",
    meters: 0,
    rate: 0,
  });
  
  // Local state for string inputs to handle decimal typing comfortably
  const [metersInput, setMetersInput] = useState("");
  const [rateInput, setRateInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form when entry opens
  useEffect(() => {
    if (entry) {
      setFormData({
        date: entry.date,
        shift: entry.shift as "Day" | "Night",
        worker_id: entry.worker_id,
        loom_id: entry.loom_id,
        shed_name: entry.shed_name,
        loom_number: entry.loom_number,
        meters: entry.meters,
        rate: entry.rate,
      });
      setMetersInput(entry.meters.toString());
      setRateInput(entry.rate.toString());
    }
  }, [entry]);

  // Flatten Looms for easier selection and finding details
  const allLooms = sheds.flatMap((shed) =>
    shed.looms.map((loom) => ({
      id: loom.id,
      label: `${shed.name} - ${loom.loom_number}`,
      shed_name: shed.name,
      loom_number: loom.loom_number
    }))
  );

  const handleLoomChange = (loomId: string) => {
    const selectedLoom = allLooms.find(l => l.id === loomId);
    
    if (selectedLoom) {
      setFormData((prev) => ({
        ...prev,
        loom_id: loomId,
        shed_name: selectedLoom.shed_name,
        loom_number: selectedLoom.loom_number,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;

    setIsSaving(true);
    try {
      await onSave(entry.id, {
        ...formData,
        meters: parseFloat(metersInput),
        rate: parseFloat(rateInput),
      });
      onClose();
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const calculateTotal = () => {
    const meters = parseFloat(metersInput) || 0;
    const rate = parseFloat(rateInput) || 0;
    return (meters * rate).toFixed(2);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Production Entry</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date & Shift */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label flex items-center gap-1.5">
                <Calendar className="w-3 h-3" /> Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                required
                className="form-field"
              />
            </div>
            <div>
              <label className="form-label flex items-center gap-1.5">
                {formData.shift === "Day" ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />} Shift
              </label>
              <Select
                value={formData.shift}
                onValueChange={(value: "Day" | "Night") =>
                  setFormData((prev) => ({ ...prev, shift: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Day">Day Shift</SelectItem>
                  <SelectItem value="Night">Night Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Worker */}
          <div>
            <label className="form-label">Worker</label>
            <Select
              value={formData.worker_id}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, worker_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Worker" />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Loom Selection */}
          <div>
            <label className="form-label">Loom</label>
            <Select value={formData.loom_id} onValueChange={handleLoomChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select Loom" />
              </SelectTrigger>
              <SelectContent>
                {allLooms.map((loom) => (
                  <SelectItem key={loom.id} value={loom.id}>
                    {loom.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Meters & Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label flex items-center gap-1.5">
                <Ruler className="w-3 h-3" /> Meters
              </label>
              <input
                type="number"
                step="0.01"
                value={metersInput}
                onChange={(e) => setMetersInput(e.target.value)}
                required
                className="form-field"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="form-label flex items-center gap-1.5">
                <IndianRupee className="w-3 h-3" /> Rate (₹/m)
              </label>
              <input
                type="number"
                step="0.01"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                required
                className="form-field"
                placeholder="12.50"
              />
            </div>
          </div>

          {/* Total Preview */}
          {metersInput && rateInput && (
            <div className="p-3 bg-accent rounded-lg border border-primary/20">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Calculated Amount</span>
                <span className="text-lg font-bold text-primary">₹{calculateTotal()}</span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}