import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Factory, Mail, Lock, Loader2, User, ArrowRight, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";



export default function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, signup } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === "signup") {
        if (!name.trim()) {
          toast({ title: "Name required", description: "Please enter your full name.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          toast({ title: "Passwords don't match", description: "Please make sure both passwords are identical.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
          setIsLoading(false);
          return;
        }
        // Signup is always as Owner — they'll create their org in onboarding
        await signup(email, password, name, "Owner");
        toast({ title: "Account Created!", description: "Let's set up your company..." });
      } else {
        await login(email, password);
        toast({ title: "Welcome back!", description: "Redirecting to dashboard..." });
      }
      setTimeout(() => navigate("/dashboard"), 500);
    } catch (err: any) {
      const msg = err?.message || "";
      let description = "Something went wrong. Please try again.";

      if (msg.includes("auth/email-already-in-use")) {
        description = "This email is already registered. Try signing in instead.";
      } else if (msg.includes("auth/wrong-password") || msg.includes("auth/invalid-credential")) {
        description = "Invalid email or password. Please try again.";
      } else if (msg.includes("auth/user-not-found")) {
        description = "No account found with this email. Sign up first.";
      } else if (msg.includes("auth/weak-password")) {
        description = "Password is too weak. Use at least 6 characters.";
      } else if (msg.includes("auth/invalid-email")) {
        description = "Please enter a valid email address.";
      } else if (msg) {
        description = `Error: ${msg}`;
      }

      toast({
        title: mode === "signup" ? "Sign Up Failed" : "Login Failed",
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setConfirmPassword("");
    setName("");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Decorative background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-slide-up">
        <div className="bg-card p-8 rounded-2xl shadow-elevated border">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-xl bg-primary mx-auto mb-4 flex items-center justify-center shadow-brand">
              <Factory className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight uppercase">
              ASM Billing System
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {mode === "signin" ? "Sign in to your account" : "Register your company to get started"}
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex gap-1 bg-muted/50 p-1 rounded-lg mb-5">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "signin"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === "signup"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Register Company
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="form-label">Full Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="form-field pl-10"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="form-label">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-field pl-10"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label className="form-label">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-field pl-10"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>

            {mode === "signup" && (
              <>
                <div>
                  <label className="form-label">Confirm Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="form-field pl-10"
                      placeholder="••••••••"
                      minLength={6}
                    />
                  </div>
                </div>

                {/* Owner-only signup notice */}
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Company Owner Registration</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        This signup is for mill owners to register their company.
                        Supervisors and workers will be onboarded by the company owner after setup.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {mode === "signin" ? "Signing In..." : "Creating Account..."}
                </>
              ) : (
                <>
                  {mode === "signin" ? "Sign In" : "Register & Continue"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground">
              {mode === "signin" ? "Don't have a company account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={switchMode}
                className="text-primary font-medium hover:underline"
              >
                {mode === "signin" ? "Register Company" : "Sign In"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
