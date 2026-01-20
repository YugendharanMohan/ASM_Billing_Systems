import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { workersApi, Worker } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  UserCheck,
  UserX,
} from "lucide-react";

export default function Workers() {
  const { toast } = useToast();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      setIsLoading(true);
      const data = await workersApi.getAll();
      setWorkers(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Failed to fetch workers:", error);
      toast({
        title: "Error",
        description: "Failed to load workers",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formName.trim()) {
      toast({ title: "Error", description: "Enter worker name", variant: "destructive" });
      return;
    }

    try {
      setIsSubmitting(true);
      const newWorker = await workersApi.create({
        name: formName.trim(),
        phone: formPhone.trim() || undefined,
      });
      // Add and re-sort
      setWorkers([...workers, newWorker].sort((a, b) => a.name.localeCompare(b.name)));
      setIsAddOpen(false);
      resetForm();
      toast({ title: "Success", description: "Worker added successfully" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add worker",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedWorker || !formName.trim()) return;

    try {
      setIsSubmitting(true);
      const updatedWorker = await workersApi.update(selectedWorker.id, {
        name: formName.trim(),
        phone: formPhone.trim() || undefined,
      });
      
      setWorkers(
        workers
          .map((w) => (w.id === selectedWorker.id ? updatedWorker : w))
          .sort((a, b) => a.name.localeCompare(b.name)) 
      );
      
      setIsEditOpen(false);
      resetForm();
      toast({ title: "Success", description: "Worker updated successfully" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update worker",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedWorker) return;

    try {
      setIsSubmitting(true);
      await workersApi.delete(selectedWorker.id);
      setWorkers(workers.filter((w) => w.id !== selectedWorker.id));
      setIsDeleteOpen(false);
      setSelectedWorker(null);
      toast({ title: "Success", description: "Worker deleted successfully" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete worker",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (worker: Worker) => {
    try {
      const updatedWorker = await workersApi.update(worker.id, {
        is_active: !worker.is_active,
      });
      setWorkers(workers.map((w) => (w.id === worker.id ? updatedWorker : w)));
      toast({
        title: "Success",
        description: `Worker ${updatedWorker.is_active ? "activated" : "deactivated"}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update worker status",
        variant: "destructive",
      });
    }
  };

  const openEditModal = (worker: Worker) => {
    setSelectedWorker(worker);
    setFormName(worker.name);
    setFormPhone(worker.phone || "");
    setIsEditOpen(true);
  };

  const openDeleteModal = (worker: Worker) => {
    setSelectedWorker(worker);
    setIsDeleteOpen(true);
  };

  const resetForm = () => {
    setFormName("");
    setFormPhone("");
    setSelectedWorker(null);
  };

  const filteredWorkers = workers.filter((w) =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pt-28 md:pt-20 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Workers Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Add, edit, and manage workers
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Worker
        </Button>
      </div>

      {/* Search */}
      <div className="card-elevated p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search workers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Workers Table */}
      <div className="card-elevated overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkers.map((worker) => (
                <TableRow key={worker.id}>
                  <TableCell className="font-medium">{worker.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {worker.phone || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={worker.is_active !== false ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => handleToggleActive(worker)}
                    >
                      {worker.is_active !== false ? (
                        <>
                          <UserCheck className="w-3 h-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <UserX className="w-3 h-3 mr-1" />
                          Inactive
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(worker)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => openDeleteModal(worker)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredWorkers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "No workers found matching your search" : "No workers yet"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add Worker Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Worker</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="form-label">Name *</label>
              <Input
                placeholder="Worker name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Phone (optional)</label>
              <Input
                placeholder="Phone number"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Worker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Worker Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Worker</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="form-label">Name *</label>
              <Input
                placeholder="Worker name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Phone (optional)</label>
              <Input
                placeholder="Phone number"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Worker</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete <strong>{selectedWorker?.name}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}