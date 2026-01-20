import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center animate-fade-in">
          <div className="relative">
            <div className="w-12 h-12 border-2 border-primary/20 rounded-full mx-auto" />
            <Loader2 className="w-12 h-12 text-primary animate-spin absolute top-0 left-1/2 -translate-x-1/2" />
          </div>
          <p className="mt-4 text-muted-foreground font-medium text-sm">
            Verifying Session...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
