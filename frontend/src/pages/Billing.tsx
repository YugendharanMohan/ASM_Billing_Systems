import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
    billingApi,
    PlanInfo,
    SubscriptionInfo,
    UsageInfo,
    Invoice,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    CreditCard, Zap, Crown, Check, Loader2, Clock,
    BarChart3, Users, Factory, FileSpreadsheet, Download,
    AlertTriangle, ChevronRight,
} from "lucide-react";

const PLAN_COLORS: Record<string, string> = {
    free: "border-muted",
    pro: "border-primary ring-2 ring-primary/20",
    enterprise: "border-yellow-500 ring-2 ring-yellow-500/20",
};

const PLAN_ICONS: Record<string, React.ReactNode> = {
    free: <Zap className="w-6 h-6 text-muted-foreground" />,
    pro: <CreditCard className="w-6 h-6 text-primary" />,
    enterprise: <Crown className="w-6 h-6 text-yellow-500" />,
};

export default function Billing() {
    const { isOwner, refreshUser } = useAuth();
    const [plans, setPlans] = useState<PlanInfo[]>([]);
    const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
    const [usage, setUsage] = useState<UsageInfo | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        try {
            const [plansData, subData, usageData, invoiceData] = await Promise.all([
                billingApi.getPlans(),
                billingApi.getSubscription(),
                billingApi.getUsage(),
                billingApi.getInvoices(),
            ]);
            setPlans(plansData);
            setSubscription(subData);
            setUsage(usageData);
            setInvoices(invoiceData);
        } catch (err) {
            console.error("Failed to load billing:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCheckout = async (planId: string) => {
        setCheckoutLoading(planId);
        try {
            const result = await billingApi.checkout(planId, billingCycle);

            // Open Razorpay checkout
            const options = {
                key: result.razorpay_key_id,
                subscription_id: result.subscription_id,
                name: "ASM Loom Management",
                description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan - ${billingCycle}`,
                handler: async () => {
                    // Payment success - refresh everything
                    await new Promise((r) => setTimeout(r, 2000));
                    await refreshUser();
                    await fetchAll();
                },
                theme: { color: "#6366f1" },
            };

            // @ts-ignore - Razorpay is loaded via script tag
            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (err: any) {
            console.error("Checkout failed:", err);
            alert(err.message || "Checkout failed. Please try again.");
        } finally {
            setCheckoutLoading(null);
        }
    };

    const handleDowngrade = async () => {
        if (!confirm("Are you sure? You'll lose access to Pro features.")) return;
        try {
            await billingApi.downgrade();
            await fetchAll();
        } catch (err) {
            console.error("Downgrade failed:", err);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const currentPlan = subscription?.plan || "free";
    const isTrialing = subscription?.status === "trialing";
    const trialEnd = subscription?.trial_end
        ? new Date(subscription.trial_end)
        : null;
    const trialDaysLeft = trialEnd
        ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000))
        : 0;

    return (
        <div className="pb-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">Billing & Plans</h1>
                {isTrialing && trialDaysLeft > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium">
                        <Clock className="w-4 h-4" />
                        {trialDaysLeft} days left in trial
                    </div>
                )}
            </div>

            {/* Usage Overview */}
            {usage && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Workers", value: usage.utilization.workers, icon: Users, color: "text-blue-500" },
                        { label: "Sheds", value: usage.utilization.sheds, icon: Factory, color: "text-green-500" },
                        { label: "Members", value: usage.utilization.members, icon: Users, color: "text-purple-500" },
                        { label: "Entries/mo", value: usage.utilization.production_entries, icon: FileSpreadsheet, color: "text-orange-500" },
                    ].map((item) => {
                        const Icon = item.icon;
                        const [used, max] = (item.value || "0/0").split("/").map(Number);
                        const pct = max > 0 ? (used / max) * 100 : 0;
                        const isNearLimit = pct >= 80;
                        return (
                            <div key={item.label} className="card-elevated p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon className={`w-4 h-4 ${item.color}`} />
                                    <span className="text-sm text-muted-foreground">{item.label}</span>
                                </div>
                                <div className="text-lg font-bold text-foreground">{item.value}</div>
                                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${isNearLimit ? "bg-destructive" : "bg-primary"
                                            }`}
                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                </div>
                                {isNearLimit && (
                                    <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                                        <AlertTriangle className="w-3 h-3" /> Near limit
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Billing Cycle Toggle */}
            <div className="flex justify-center">
                <div className="inline-flex items-center bg-muted rounded-lg p-1">
                    <button
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${billingCycle === "monthly"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground"
                            }`}
                        onClick={() => setBillingCycle("monthly")}
                    >
                        Monthly
                    </button>
                    <button
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${billingCycle === "yearly"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground"
                            }`}
                        onClick={() => setBillingCycle("yearly")}
                    >
                        Yearly <span className="text-xs text-green-500 ml-1">Save 17%</span>
                    </button>
                </div>
            </div>

            {/* Plan Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => {
                    const isCurrent = plan.id === currentPlan;
                    const price = billingCycle === "monthly" ? plan.price_monthly : plan.price_yearly;
                    return (
                        <div
                            key={plan.id}
                            className={`relative rounded-xl border-2 p-6 transition-shadow hover:shadow-lg ${PLAN_COLORS[plan.id] || "border-muted"
                                } ${isCurrent ? "bg-accent/30" : "bg-card"}`}
                        >
                            {isCurrent && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                                    Current Plan
                                </div>
                            )}

                            <div className="flex items-center gap-3 mb-4">
                                {PLAN_ICONS[plan.id]}
                                <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                            </div>

                            <div className="mb-6">
                                {price === 0 ? (
                                    <div className="text-3xl font-bold text-foreground">Free</div>
                                ) : (
                                    <div>
                                        <span className="text-3xl font-bold text-foreground">
                                            ₹{price.toLocaleString("en-IN")}
                                        </span>
                                        <span className="text-muted-foreground text-sm">
                                            /{billingCycle === "monthly" ? "mo" : "yr"}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <ul className="space-y-2 mb-6 text-sm">
                                {[
                                    `${plan.limits.max_workers} workers`,
                                    `${plan.limits.max_sheds} sheds`,
                                    `${plan.limits.max_looms_per_shed} looms/shed`,
                                    `${plan.limits.max_production_entries_per_month.toLocaleString()} entries/mo`,
                                    `${plan.limits.history_days >= 9999 ? "Unlimited" : plan.limits.history_days + " days"} history`,
                                    plan.limits.allow_pdf_export ? "PDF export" : null,
                                    plan.limits.allow_csv_export ? "CSV export" : null,
                                    plan.limits.allow_invite_members
                                        ? `${plan.limits.max_members} team members`
                                        : "Single user only",
                                ]
                                    .filter(Boolean)
                                    .map((feature, i) => (
                                        <li key={i} className="flex items-center gap-2 text-muted-foreground">
                                            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                                            {feature}
                                        </li>
                                    ))}
                            </ul>

                            {isOwner && (
                                <>
                                    {isCurrent ? (
                                        plan.id !== "free" ? (
                                            <Button
                                                variant="outline"
                                                className="w-full"
                                                size="sm"
                                                onClick={handleDowngrade}
                                            >
                                                Downgrade to Free
                                            </Button>
                                        ) : null
                                    ) : plan.id !== "free" ? (
                                        <Button
                                            className="w-full"
                                            onClick={() => handleCheckout(plan.id)}
                                            disabled={!!checkoutLoading}
                                        >
                                            {checkoutLoading === plan.id ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : null}
                                            Upgrade to {plan.name}
                                            <ChevronRight className="w-4 h-4 ml-1" />
                                        </Button>
                                    ) : currentPlan !== "free" ? (
                                        <Button
                                            variant="outline"
                                            className="w-full"
                                            size="sm"
                                            onClick={handleDowngrade}
                                        >
                                            Downgrade to Free
                                        </Button>
                                    ) : null}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Invoice History */}
            {invoices.length > 0 && (
                <div className="card-elevated p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Download className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Invoice History</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                    <th className="pb-2 font-medium">Date</th>
                                    <th className="pb-2 font-medium">Amount</th>
                                    <th className="pb-2 font-medium">Method</th>
                                    <th className="pb-2 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv) => (
                                    <tr key={inv.id} className="border-b border-border/50">
                                        <td className="py-3 text-foreground">
                                            {new Date(inv.created_at).toLocaleDateString("en-IN")}
                                        </td>
                                        <td className="py-3 font-medium text-foreground">
                                            ₹{inv.amount.toLocaleString("en-IN")}
                                        </td>
                                        <td className="py-3 text-muted-foreground capitalize">{inv.method}</td>
                                        <td className="py-3">
                                            <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                {inv.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
