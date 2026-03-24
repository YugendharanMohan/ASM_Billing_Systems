import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";

interface RoleGateProps {
    /** Minimum role required: "Operator" | "Manager" | "Admin" | "Owner" */
    minRole: string;
    /** Where to redirect if user lacks permission (default: /my-dashboard) */
    fallback?: string;
    children: React.ReactNode;
}

/**
 * Wraps a route's content and enforces a minimum role.
 * If the user's orgRole is below `minRole`, they are redirected to `fallback`.
 * Super admins always pass.
 */
export default function RoleGate({ minRole, fallback = "/my-dashboard", children }: RoleGateProps) {
    const { hasMinRole } = usePermissions();

    if (!hasMinRole(minRole)) {
        return <Navigate to={fallback} replace />;
    }

    return <>{children}</>;
}
