import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
    LayoutDashboard,
    FileSpreadsheet,
    LogOut,
    Factory,
    Users,
    CalendarCheck,
    Receipt,
    Package,
    ShoppingCart,
    Sun,
    Moon,
    Monitor,
    Wallet,
    Menu,
    X,
    User,
    ChevronRight,
    Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppShellProps {
    children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const { canAccess } = usePermissions();

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    const cycleTheme = () => {
        const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
        setTheme(next);
    };

    const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

    const allLinks = [
        { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
        { to: "/workers", label: "Workers", icon: Users },
        { to: "/salary-entry", label: "Meter Entry", icon: FileSpreadsheet },
        { to: "/inventory", label: "Inventory", icon: Package },
        { to: "/orders", label: "Orders", icon: ShoppingCart },
        { to: "/expenses", label: "Expenses", icon: Receipt },
        { to: "/payroll", label: "Payroll", icon: Wallet },
        { to: "/settings", label: "Settings", icon: Settings },
    ];

    const navLinks = allLinks.filter((link) => {
        const moduleKey = link.to.slice(1);
        return canAccess(moduleKey);
    });

    const currentRoute = allLinks.find(link => link.to === location.pathname);

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                {/* Brand Header */}
                <div className="flex items-center justify-between h-16 px-4 border-b shrink-0">
                    <Link to="/dashboard" className="flex items-center gap-3 group" onClick={() => setSidebarOpen(false)}>
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shadow-brand transition-transform group-hover:scale-105">
                            <Factory className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm text-foreground tracking-tight leading-none">
                                ASM BILLING
                            </span>
                            <span className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">
                                Management
                            </span>
                        </div>
                    </Link>
                    <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
                        <X className="w-5 h-5 text-muted-foreground" />
                    </Button>
                </div>

                {/* Navigation Links */}
                <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                    {navLinks.map((link) => {
                        const isActive = location.pathname === link.to;
                        const Icon = link.icon;
                        return (
                            <Link
                                key={link.to}
                                to={link.to}
                                onClick={() => setSidebarOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    }`}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                                {link.label}
                            </Link>
                        );
                    })}
                </div>

                {/* User Card */}
                <div className="p-4 border-t shrink-0">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent text-accent-foreground font-bold shrink-0">
                            {user?.name?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{user?.orgRole || user?.role}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="w-full justify-center" onClick={handleLogout}>
                            <LogOut className="w-4 h-4 mr-2" />
                            Logout
                        </Button>
                        <Button variant="outline" size="icon" onClick={cycleTheme} className="shrink-0" title={`Theme: ${theme}`}>
                            <ThemeIcon className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex flex-col flex-1 w-full min-w-0 overflow-hidden">
                {/* Top Header */}
                <header className="flex items-center justify-between h-16 px-4 sm:px-6 border-b bg-card/50 backdrop-blur-md shrink-0 z-10">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu className="w-5 h-5 text-foreground" />
                        </Button>

                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground hidden sm:inline-block">Dashboard</span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground hidden sm:inline-block" />
                            <span className="font-semibold text-foreground">
                                {currentRoute?.label || "ASM"}
                            </span>
                        </div>
                    </div>
                </header>

                {/* Page Content Scrollable Area */}
                <main className="flex-1 overflow-y-auto bg-background/50 outline-none p-4 sm:p-6 lg:p-8" tabIndex={-1}>
                    {children}
                </main>
            </div>
        </div>
    );
}
