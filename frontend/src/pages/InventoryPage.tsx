import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Package, Loader2, Plus, AlertTriangle, ArrowDown, ArrowUp,
    Truck, Trash2,
} from "lucide-react";

interface InventoryItem {
    id: string;
    name: string;
    category: string;
    unit: string;
    current_stock: number;
    min_stock_threshold: number;
    rate_per_unit: number;
    is_low_stock: boolean;
    supplier_id: string;
}

interface Supplier {
    id: string;
    name: string;
    phone: string;
    gst_number: string;
}

async function api<T>(url: string, opts?: RequestInit): Promise<T> {
    const token = localStorage.getItem("asm_token");
    const base = import.meta.env.VITE_API_URL || "";
    const res = await fetch(`${base}${url}`, {
        ...opts,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) },
    });
    if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
    return res.json();
}

export default function Inventory() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [tab, setTab] = useState<"items" | "suppliers">("items");
    const [showForm, setShowForm] = useState(false);
    const [showTxn, setShowTxn] = useState<string | null>(null);
    const [txnType, setTxnType] = useState<"in" | "out">("in");
    const [txnQty, setTxnQty] = useState("");
    const [txnSaving, setTxnSaving] = useState(false);
    const [itemForm, setItemForm] = useState({ name: "", category: "Yarn", unit: "kg", current_stock: "0", min_stock_threshold: "10", rate_per_unit: "0" });
    const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", gst_number: "", contact: "", payment_terms: "" });
    const [saving, setSaving] = useState(false);
    const [showSupplierForm, setShowSupplierForm] = useState(false);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [itemsData, suppliersData] = await Promise.all([
                api<InventoryItem[]>("/inventory/"),
                api<Supplier[]>("/suppliers/"),
            ]);
            setItems(itemsData);
            setSuppliers(suppliersData);
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
    };

    const handleAddItem = async () => {
        if (!itemForm.name) return;
        setSaving(true);
        try {
            await api("/inventory/", {
                method: "POST",
                body: JSON.stringify({
                    ...itemForm,
                    current_stock: parseFloat(itemForm.current_stock),
                    min_stock_threshold: parseFloat(itemForm.min_stock_threshold),
                    rate_per_unit: parseFloat(itemForm.rate_per_unit),
                }),
            });
            setShowForm(false);
            setItemForm({ name: "", category: "Yarn", unit: "kg", current_stock: "0", min_stock_threshold: "10", rate_per_unit: "0" });
            await fetchData();
        } catch (err) { console.error(err); }
        finally { setSaving(false); }
    };

    const handleAddSupplier = async () => {
        if (!supplierForm.name) return;
        setSaving(true);
        try {
            await api("/suppliers/", { method: "POST", body: JSON.stringify(supplierForm) });
            setShowSupplierForm(false);
            setSupplierForm({ name: "", phone: "", gst_number: "", contact: "", payment_terms: "" });
            await fetchData();
        } catch (err) { console.error(err); }
        finally { setSaving(false); }
    };

    const handleTransaction = async (itemId: string) => {
        if (!txnQty || parseFloat(txnQty) <= 0) return;
        setTxnSaving(true);
        try {
            await api("/inventory/transaction", {
                method: "POST",
                body: JSON.stringify({
                    item_id: itemId,
                    type: txnType,
                    quantity: parseFloat(txnQty),
                    date: new Date().toISOString().slice(0, 10),
                }),
            });
            setShowTxn(null);
            setTxnQty("");
            await fetchData();
        } catch (err: any) {
            alert(err.message);
        } finally { setTxnSaving(false); }
    };

    const lowStockCount = items.filter((i) => i.is_low_stock).length;

    return (
        <div className="pb-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
                <div className="flex gap-2">
                    <div className="flex gap-1 bg-muted rounded-lg p-1">
                        <button className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "items" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setTab("items")}>Items</button>
                        <button className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "suppliers" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setTab("suppliers")}>Suppliers</button>
                    </div>
                </div>
            </div>

            {/* Low Stock Alert */}
            {lowStockCount > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertTriangle className="w-4 h-4" /> {lowStockCount} item(s) below minimum stock level
                </div>
            )}

            {tab === "items" && (
                <>
                    <div className="flex justify-end">
                        <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="w-4 h-4 mr-1" /> Add Item</Button>
                    </div>

                    {showForm && (
                        <div className="card-elevated p-4 space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div><label className="form-label">Name</label><input type="text" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} className="form-field" /></div>
                                <div><label className="form-label">Category</label>
                                    <Select value={itemForm.category} onValueChange={(v) => setItemForm({ ...itemForm, category: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{["Yarn", "Thread", "Dye", "Chemical", "Spare Parts", "Other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div><label className="form-label">Unit</label><input type="text" value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} className="form-field" /></div>
                                <div><label className="form-label">Stock</label><input type="number" value={itemForm.current_stock} onChange={(e) => setItemForm({ ...itemForm, current_stock: e.target.value })} className="form-field" /></div>
                                <div><label className="form-label">Min Threshold</label><input type="number" value={itemForm.min_stock_threshold} onChange={(e) => setItemForm({ ...itemForm, min_stock_threshold: e.target.value })} className="form-field" /></div>
                                <div><label className="form-label">Rate/Unit (₹)</label><input type="number" value={itemForm.rate_per_unit} onChange={(e) => setItemForm({ ...itemForm, rate_per_unit: e.target.value })} className="form-field" /></div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                                <Button size="sm" onClick={handleAddItem} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Add</Button>
                            </div>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                    ) : (
                        <div className="space-y-2">
                            {items.map((item) => (
                                <div key={item.id} className={`p-3 rounded-lg border transition-colors ${item.is_low_stock ? "border-destructive/50 bg-destructive/5" : "border-border hover:bg-muted/50"}`}>
                                    <div className="flex items-center gap-3">
                                        <Package className={`w-4 h-4 ${item.is_low_stock ? "text-destructive" : "text-muted-foreground"}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-foreground">{item.name} <span className="text-xs text-muted-foreground">({item.category})</span></div>
                                            <div className="text-xs text-muted-foreground">
                                                Stock: <span className={item.is_low_stock ? "text-destructive font-medium" : ""}>{item.current_stock} {item.unit}</span>
                                                {item.is_low_stock && " ⚠️"} • Min: {item.min_stock_threshold} • ₹{item.rate_per_unit}/{item.unit}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600" onClick={() => { setShowTxn(item.id); setTxnType("in"); }}>
                                                <ArrowDown className="w-3.5 h-3.5 mr-1" />In
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-7 px-2 text-orange-500" onClick={() => { setShowTxn(item.id); setTxnType("out"); }}>
                                                <ArrowUp className="w-3.5 h-3.5 mr-1" />Out
                                            </Button>
                                        </div>
                                    </div>
                                    {showTxn === item.id && (
                                        <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                                            <span className="text-xs font-medium">{txnType === "in" ? "Stock In" : "Stock Out"}:</span>
                                            <input type="number" value={txnQty} onChange={(e) => setTxnQty(e.target.value)} className="form-field w-24 h-7 text-sm" placeholder="Qty" />
                                            <Button size="sm" className="h-7" onClick={() => handleTransaction(item.id)} disabled={txnSaving}>
                                                {txnSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-7" onClick={() => setShowTxn(null)}>Cancel</Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {items.length === 0 && (
                                <div className="text-center text-muted-foreground py-8">
                                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    No inventory items. Add your first item.
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {tab === "suppliers" && (
                <>
                    <div className="flex justify-end">
                        <Button size="sm" onClick={() => setShowSupplierForm(!showSupplierForm)}><Plus className="w-4 h-4 mr-1" /> Add Supplier</Button>
                    </div>

                    {showSupplierForm && (
                        <div className="card-elevated p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="form-label">Name</label><input type="text" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} className="form-field" /></div>
                                <div><label className="form-label">Phone</label><input type="tel" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} className="form-field" /></div>
                                <div><label className="form-label">GST Number</label><input type="text" value={supplierForm.gst_number} onChange={(e) => setSupplierForm({ ...supplierForm, gst_number: e.target.value })} className="form-field" /></div>
                                <div><label className="form-label">Payment Terms</label><input type="text" value={supplierForm.payment_terms} onChange={(e) => setSupplierForm({ ...supplierForm, payment_terms: e.target.value })} className="form-field" /></div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setShowSupplierForm(false)}>Cancel</Button>
                                <Button size="sm" onClick={handleAddSupplier} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Add</Button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        {suppliers.map((s) => (
                            <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                                <Truck className="w-4 h-4 text-muted-foreground" />
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-foreground">{s.name}</div>
                                    <div className="text-xs text-muted-foreground">{s.phone} {s.gst_number && `• GST: ${s.gst_number}`}</div>
                                </div>
                            </div>
                        ))}
                        {suppliers.length === 0 && (
                            <div className="text-center text-muted-foreground py-8">
                                <Truck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                No suppliers added yet.
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
