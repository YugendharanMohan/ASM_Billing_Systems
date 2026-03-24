import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    ShoppingCart, Loader2, Plus, Users, Percent,
    Filter, Trash2,
} from "lucide-react";

interface Customer { id: string; name: string; phone: string; gst_number: string; address: string; }
interface Order {
    id: string; customer_id: string; fabric_type: string; ordered_meters: number;
    produced_meters: number; rate_per_meter: number; total_value: number;
    completion_pct: number; status: string; deadline: string; notes: string;
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

const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    delivered: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

export default function Orders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [tab, setTab] = useState<"orders" | "customers">("orders");
    const [showOrderForm, setShowOrderForm] = useState(false);
    const [showCustForm, setShowCustForm] = useState(false);
    const [filterStatus, setFilterStatus] = useState("all");
    const [orderForm, setOrderForm] = useState({ customer_id: "", fabric_type: "", ordered_meters: "", rate_per_meter: "", deadline: "", notes: "" });
    const [custForm, setCustForm] = useState({ name: "", phone: "", address: "", gst_number: "" });
    const [saving, setSaving] = useState(false);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [o, c] = await Promise.all([api<Order[]>("/orders/"), api<Customer[]>("/customers/")]);
            setOrders(o);
            setCustomers(c);
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
    };

    const handleAddOrder = async () => {
        if (!orderForm.customer_id || !orderForm.ordered_meters) return;
        setSaving(true);
        try {
            await api("/orders/", {
                method: "POST", body: JSON.stringify({
                    ...orderForm,
                    ordered_meters: parseFloat(orderForm.ordered_meters),
                    rate_per_meter: parseFloat(orderForm.rate_per_meter || "0"),
                }),
            });
            setShowOrderForm(false);
            setOrderForm({ customer_id: "", fabric_type: "", ordered_meters: "", rate_per_meter: "", deadline: "", notes: "" });
            await fetchData();
        } catch (err) { console.error(err); }
        finally { setSaving(false); }
    };

    const handleAddCustomer = async () => {
        if (!custForm.name) return;
        setSaving(true);
        try {
            await api("/customers/", { method: "POST", body: JSON.stringify(custForm) });
            setShowCustForm(false);
            setCustForm({ name: "", phone: "", address: "", gst_number: "" });
            await fetchData();
        } catch (err) { console.error(err); }
        finally { setSaving(false); }
    };

    const handleStatusChange = async (orderId: string, status: string) => {
        try {
            await api(`/orders/${orderId}`, { method: "PUT", body: JSON.stringify({ status }) });
            setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
        } catch (err) { console.error(err); }
    };

    const getCustomerName = (id: string) => customers.find((c) => c.id === id)?.name || id;
    const filtered = filterStatus === "all" ? orders : orders.filter((o) => o.status === filterStatus);
    const totalValue = orders.reduce((s, o) => s + (o.total_value || 0), 0);

    return (
        <div className="pb-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">Orders</h1>
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                    <button className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "orders" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setTab("orders")}>Orders</button>
                    <button className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "customers" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setTab("customers")}>Customers</button>
                </div>
            </div>

            {tab === "orders" && (
                <>
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="card-elevated p-3 text-center"><div className="text-2xl font-bold text-foreground">{orders.length}</div><div className="text-xs text-muted-foreground">Total Orders</div></div>
                        <div className="card-elevated p-3 text-center"><div className="text-2xl font-bold text-foreground">₹{totalValue.toLocaleString("en-IN")}</div><div className="text-xs text-muted-foreground">Total Value</div></div>
                        <div className="card-elevated p-3 text-center"><div className="text-2xl font-bold text-green-500">{orders.filter((o) => o.status === "completed" || o.status === "delivered").length}</div><div className="text-xs text-muted-foreground">Completed</div></div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-muted-foreground" />
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="delivered">Delivered</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button size="sm" onClick={() => setShowOrderForm(!showOrderForm)}><Plus className="w-4 h-4 mr-1" /> New Order</Button>
                    </div>

                    {showOrderForm && (
                        <div className="card-elevated p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="form-label">Customer</label>
                                    <Select value={orderForm.customer_id} onValueChange={(v) => setOrderForm({ ...orderForm, customer_id: v })}>
                                        <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                                        <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div><label className="form-label">Fabric Type</label><input type="text" value={orderForm.fabric_type} onChange={(e) => setOrderForm({ ...orderForm, fabric_type: e.target.value })} className="form-field" /></div>
                                <div><label className="form-label">Meters</label><input type="number" value={orderForm.ordered_meters} onChange={(e) => setOrderForm({ ...orderForm, ordered_meters: e.target.value })} className="form-field" /></div>
                                <div><label className="form-label">Rate/Meter (₹)</label><input type="number" value={orderForm.rate_per_meter} onChange={(e) => setOrderForm({ ...orderForm, rate_per_meter: e.target.value })} className="form-field" /></div>
                                <div><label className="form-label">Deadline</label><input type="date" value={orderForm.deadline} onChange={(e) => setOrderForm({ ...orderForm, deadline: e.target.value })} className="form-field" /></div>
                                <div><label className="form-label">Notes</label><input type="text" value={orderForm.notes} onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} className="form-field" /></div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setShowOrderForm(false)}>Cancel</Button>
                                <Button size="sm" onClick={handleAddOrder} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Create</Button>
                            </div>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                    ) : (
                        <div className="space-y-2">
                            {filtered.map((o) => (
                                <div key={o.id} className="card-elevated p-4 space-y-2">
                                    <div className="flex items-center gap-3">
                                        <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-foreground">{getCustomerName(o.customer_id)} — {o.fabric_type}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {o.ordered_meters}m @ ₹{o.rate_per_meter}/m = ₹{o.total_value?.toLocaleString("en-IN")}
                                                {o.deadline && ` • Due: ${o.deadline}`}
                                            </div>
                                        </div>
                                        <Select value={o.status} onValueChange={(v) => handleStatusChange(o.id, v)}>
                                            <SelectTrigger className="w-[130px] h-7 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="pending">Pending</SelectItem>
                                                <SelectItem value="in_progress">In Progress</SelectItem>
                                                <SelectItem value="completed">Completed</SelectItem>
                                                <SelectItem value="delivered">Delivered</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${o.completion_pct || 0}%` }} />
                                        </div>
                                        <span className="text-xs text-muted-foreground w-10 text-right">{o.completion_pct || 0}%</span>
                                    </div>
                                </div>
                            ))}
                            {filtered.length === 0 && (
                                <div className="text-center text-muted-foreground py-8"><ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />No orders found.</div>
                            )}
                        </div>
                    )}
                </>
            )}

            {tab === "customers" && (
                <>
                    <div className="flex justify-end">
                        <Button size="sm" onClick={() => setShowCustForm(!showCustForm)}><Plus className="w-4 h-4 mr-1" /> Add Customer</Button>
                    </div>
                    {showCustForm && (
                        <div className="card-elevated p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="form-label">Name</label><input type="text" value={custForm.name} onChange={(e) => setCustForm({ ...custForm, name: e.target.value })} className="form-field" /></div>
                                <div><label className="form-label">Phone</label><input type="tel" value={custForm.phone} onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })} className="form-field" /></div>
                                <div><label className="form-label">GST Number</label><input type="text" value={custForm.gst_number} onChange={(e) => setCustForm({ ...custForm, gst_number: e.target.value })} className="form-field" /></div>
                                <div><label className="form-label">Address</label><input type="text" value={custForm.address} onChange={(e) => setCustForm({ ...custForm, address: e.target.value })} className="form-field" /></div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setShowCustForm(false)}>Cancel</Button>
                                <Button size="sm" onClick={handleAddCustomer} disabled={saving}>Add</Button>
                            </div>
                        </div>
                    )}
                    <div className="space-y-2">
                        {customers.map((c) => (
                            <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-foreground">{c.name}</div>
                                    <div className="text-xs text-muted-foreground">{c.phone} {c.gst_number && `• GST: ${c.gst_number}`} {c.address && `• ${c.address}`}</div>
                                </div>
                            </div>
                        ))}
                        {customers.length === 0 && (
                            <div className="text-center text-muted-foreground py-8"><Users className="w-8 h-8 mx-auto mb-2 opacity-50" />No customers yet.</div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
