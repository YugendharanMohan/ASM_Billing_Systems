import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
    Factory, BarChart3, Shield, Users, Zap, ChevronRight,
    CalendarCheck, Package, ShoppingCart, Receipt, CreditCard,
    ArrowRight, Check, Star,
} from "lucide-react";

const FEATURES = [
    { icon: Factory, title: "Loom Management", desc: "Track production across sheds, looms, and shifts with real-time meter entries" },
    { icon: Users, title: "Worker Management", desc: "Worker profiles, rate-per-meter, automatic salary calculation" },
    { icon: CalendarCheck, title: "Attendance & Leave", desc: "Daily attendance with bulk marking, leave requests with approval flow" },
    { icon: BarChart3, title: "Analytics & Reports", desc: "Loom efficiency, worker scoring, P&L, comparative analytics, CSV export" },
    { icon: Package, title: "Inventory Tracking", desc: "Raw material stock, supplier directory, low-stock alerts, transactions" },
    { icon: ShoppingCart, title: "Order Management", desc: "Customer orders with progress tracking, completion %, and deadline monitoring" },
    { icon: Receipt, title: "Expense Tracking", desc: "Categorized expenses with manager approval flow and category-wise summaries" },
    { icon: CreditCard, title: "Billing & Plans", desc: "Free, Pro, and Enterprise plans with integrated Razorpay checkout" },
    { icon: Shield, title: "Multi-Tenant", desc: "Org-scoped data isolation, role-based access (Owner/Admin/Manager/Viewer)" },
];

const PLANS = [
    { name: "Free", price: "₹0", period: "forever", features: ["5 Workers", "1 Shed", "Basic Reports", "30 Days History"], highlight: false },
    { name: "Pro", price: "₹999", period: "/month", features: ["50 Workers", "10 Sheds", "Full Analytics", "CSV Export", "Team Members", "365 Days History"], highlight: true },
    { name: "Enterprise", price: "₹4,999", period: "/month", features: ["Unlimited Workers", "Unlimited Sheds", "Priority Support", "Custom Reports", "50 Team Members", "Unlimited History"], highlight: false },
];

export default function LandingPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const ctaClick = () => {
        if (user) navigate("/dashboard");
        else navigate("/login");
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Navbar */}
            <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-brand">
                            <Factory className="w-5 h-5 text-primary-foreground" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">ASM</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Features</a>
                        <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">Pricing</a>
                        <Button size="sm" onClick={ctaClick}>
                            {user ? "Dashboard" : "Get Started"} <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/8 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
                </div>
                <div className="container mx-auto px-6 py-24 md:py-32 text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                        <Zap className="w-3.5 h-3.5" /> Built for Indian Textile Mills
                    </div>
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight max-w-3xl mx-auto">
                        The Complete ERP for{" "}
                        <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                            Loom & Textile
                        </span>{" "}
                        Operations
                    </h1>
                    <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        Production tracking, salary calculation, attendance, inventory, orders, expenses, and analytics — all in one platform built for mill owners.
                    </p>
                    <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                        <Button size="lg" className="text-base px-8" onClick={ctaClick}>
                            Start Free <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                        <Button size="lg" variant="outline" className="text-base px-8" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>
                            See Features
                        </Button>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                        No credit card required • 14-day Pro trial included
                    </p>
                </div>
            </section>

            {/* Features */}
            <section id="features" className="py-20 bg-muted/30">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl font-bold mb-3">Everything You Need</h2>
                        <p className="text-muted-foreground max-w-xl mx-auto">
                            A complete suite of tools designed specifically for textile and loom manufacturing operations.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {FEATURES.map((f) => {
                            const Icon = f.icon;
                            return (
                                <div key={f.title} className="group p-5 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                                        <Icon className="w-5 h-5 text-primary" />
                                    </div>
                                    <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="py-20">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl font-bold mb-3">Simple, Transparent Pricing</h2>
                        <p className="text-muted-foreground">Start free. Upgrade when you grow.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
                        {PLANS.map((plan) => (
                            <div
                                key={plan.name}
                                className={`relative p-6 rounded-xl border ${plan.highlight ? "border-primary shadow-lg ring-2 ring-primary/20" : "border-border"}`}
                            >
                                {plan.highlight && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                                        Most Popular
                                    </div>
                                )}
                                <div className="mb-4">
                                    <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                                    <div className="mt-2">
                                        <span className="text-3xl font-extrabold text-foreground">{plan.price}</span>
                                        <span className="text-sm text-muted-foreground">{plan.period}</span>
                                    </div>
                                </div>
                                <ul className="space-y-2 mb-6">
                                    {plan.features.map((f) => (
                                        <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Check className="w-4 h-4 text-primary flex-shrink-0" /> {f}
                                        </li>
                                    ))}
                                </ul>
                                <Button className="w-full" variant={plan.highlight ? "default" : "outline"} onClick={ctaClick}>
                                    Get Started
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 bg-primary/5">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-3xl font-bold mb-4">Ready to Modernize Your Mill?</h2>
                    <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
                        Join hundreds of textile manufacturers who trust ASM for their daily operations.
                    </p>
                    <Button size="lg" className="text-base px-8" onClick={ctaClick}>
                        Start Free Today <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 border-t">
                <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Factory className="w-4 h-4" /> ASM Loom Management
                    </div>
                    <p className="text-xs text-muted-foreground">
                        © {new Date().getFullYear()} ASM. Built for Indian Textile Industry.
                    </p>
                </div>
            </footer>
        </div>
    );
}
