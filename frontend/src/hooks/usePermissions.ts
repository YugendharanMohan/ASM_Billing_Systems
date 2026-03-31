import { useAuth } from "@/contexts/AuthContext";

/**
 * Role hierarchy: Supervisor(1) → Owner(2)
 * Super Admins bypass all checks.
 */
const ROLE_HIERARCHY: Record<string, number> = {
    Supervisor: 1,
    Owner: 2,
};

/**
 * Minimum role required to access each module (route path without leading /).
 * Supervisor: workers, salary-entry, inventory
 * Owner: everything
 */
const MODULE_MIN_ROLE: Record<string, string> = {
    workers: "Supervisor",
    "salary-entry": "Supervisor",
    inventory: "Supervisor",
    dashboard: "Owner",
    orders: "Owner",
    expenses: "Owner",
    reports: "Owner",
    payroll: "Owner",
    settings: "Owner",
};

export function usePermissions() {
    const { user } = useAuth();

    const orgRole = user?.orgRole ?? "Supervisor";
    const isSuperAdmin = user?.isSuperAdmin ?? false;

    /** Check if the current user can access a module by its route key */
    const canAccess = (moduleKey: string): boolean => {
        if (isSuperAdmin) return true;
        const minRole = MODULE_MIN_ROLE[moduleKey] ?? "Supervisor";
        return (ROLE_HIERARCHY[orgRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
    };

    /** Check if the current user's role meets a minimum role threshold */
    const hasMinRole = (minRole: string): boolean => {
        if (isSuperAdmin) return true;
        return (ROLE_HIERARCHY[orgRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
    };

    const isSupervisor = hasMinRole("Supervisor");
    const isOwner = hasMinRole("Owner");

    return {
        canAccess,
        hasMinRole,
        orgRole,
        isSuperAdmin,
        isSupervisor,
        isOwner,
    };
}
