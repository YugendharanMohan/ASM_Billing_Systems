import { useAuth } from "@/contexts/AuthContext";

/**
 * Role hierarchy: Operator(0) → Manager(1) → Admin(2) → Owner(3)
 * Super Admins bypass all checks.
 */
const ROLE_HIERARCHY: Record<string, number> = {
    Operator: 0,
    Manager: 1,
    Admin: 2,
    Owner: 3,
};

/**
 * Minimum role required to access each module (route path without leading /).
 * Modules not listed here default to "Operator" (any authenticated org member).
 */
const MODULE_MIN_ROLE: Record<string, string> = {
    dashboard: "Manager",
    workers: "Manager",
    analytics: "Manager",
    "salary-entry": "Manager",
    attendance: "Manager",
    inventory: "Manager",
    orders: "Manager",
    expenses: "Manager",
    reports: "Manager",
    payroll: "Manager",
    billing: "Owner",
    settings: "Owner",
};

export function usePermissions() {
    const { user } = useAuth();

    const orgRole = user?.orgRole ?? "Operator";
    const isSuperAdmin = user?.isSuperAdmin ?? false;

    /** Check if the current user can access a module by its route key */
    const canAccess = (moduleKey: string): boolean => {
        if (isSuperAdmin) return true;
        const minRole = MODULE_MIN_ROLE[moduleKey] ?? "Operator";
        return (ROLE_HIERARCHY[orgRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
    };

    /** Check if the current user's role meets a minimum role threshold */
    const hasMinRole = (minRole: string): boolean => {
        if (isSuperAdmin) return true;
        return (ROLE_HIERARCHY[orgRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
    };

    const isOperator = orgRole === "Operator" && !isSuperAdmin;
    const isManager = hasMinRole("Manager");
    const isAdmin = hasMinRole("Admin");
    const isOwner = hasMinRole("Owner");

    return {
        canAccess,
        hasMinRole,
        orgRole,
        isSuperAdmin,
        isOperator,
        isManager,
        isAdmin,
        isOwner,
    };
}
