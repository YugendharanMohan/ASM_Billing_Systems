import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleGate from "@/components/RoleGate";
import ErrorBoundary from "@/components/ErrorBoundary";
import AppShell from "@/components/AppShell";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import SalaryEntry from "@/pages/SalaryEntry";
import Workers from "@/pages/Workers";
import ProductionReports from "@/pages/ProductionReports";
import Onboarding from "@/pages/Onboarding";

import Expenses from "@/pages/Expenses";
import InventoryPage from "@/pages/InventoryPage";
import OrdersPage from "@/pages/OrdersPage";
import Settings from "@/pages/Settings";

import PayrollPage from "@/pages/PayrollPage";
import MyDashboard from "@/pages/MyDashboard";

const queryClient = new QueryClient();

/**
 * OrgGuard: Redirects to onboarding if the user doesn't have an org.
 * Wraps all org-scoped routes.
 */
function OrgGuard({ children }: { children: React.ReactNode }) {
  const { hasOrg, isLoading } = useAuth();

  if (isLoading) return null; // ProtectedRoute handles loading UI

  if (!hasOrg) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ErrorBoundary>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<Login />} />

                {/* Onboarding (needs auth but no org) */}
                <Route
                  path="/onboarding"
                  element={
                    <ProtectedRoute>
                      <Onboarding />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/my-dashboard"
                  element={
                    <ProtectedRoute>
                      <OrgGuard>
                        <AppShell>
                          <MyDashboard />
                        </AppShell>
                      </OrgGuard>
                    </ProtectedRoute>
                  }
                />

                {/* Protected + Org-scoped + Role-gated Routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <OrgGuard>
                        <RoleGate minRole="Owner">
                          <AppShell>
                            <Dashboard />
                          </AppShell>
                        </RoleGate>
                      </OrgGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/salary-entry"
                  element={
                    <ProtectedRoute>
                      <OrgGuard>
                        <RoleGate minRole="Supervisor">
                          <AppShell>
                            <SalaryEntry />
                          </AppShell>
                        </RoleGate>
                      </OrgGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/workers"
                  element={
                    <ProtectedRoute>
                      <OrgGuard>
                        <RoleGate minRole="Supervisor">
                          <AppShell>
                            <Workers />
                          </AppShell>
                        </RoleGate>
                      </OrgGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/reports"
                  element={
                    <ProtectedRoute>
                      <OrgGuard>
                        <RoleGate minRole="Owner">
                          <AppShell>
                            <ProductionReports />
                          </AppShell>
                        </RoleGate>
                      </OrgGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/expenses"
                  element={
                    <ProtectedRoute>
                      <OrgGuard>
                        <RoleGate minRole="Owner">
                          <AppShell>
                            <Expenses />
                          </AppShell>
                        </RoleGate>
                      </OrgGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/inventory"
                  element={
                    <ProtectedRoute>
                      <OrgGuard>
                        <RoleGate minRole="Supervisor">
                          <AppShell>
                            <InventoryPage />
                          </AppShell>
                        </RoleGate>
                      </OrgGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/orders"
                  element={
                    <ProtectedRoute>
                      <OrgGuard>
                        <RoleGate minRole="Owner">
                          <AppShell>
                            <OrdersPage />
                          </AppShell>
                        </RoleGate>
                      </OrgGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/payroll"
                  element={
                    <ProtectedRoute>
                      <OrgGuard>
                        <RoleGate minRole="Owner">
                          <AppShell>
                            <PayrollPage />
                          </AppShell>
                        </RoleGate>
                      </OrgGuard>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <OrgGuard>
                        <RoleGate minRole="Owner">
                          <AppShell>
                            <Settings />
                          </AppShell>
                        </RoleGate>
                      </OrgGuard>
                    </ProtectedRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;