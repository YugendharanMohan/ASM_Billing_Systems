import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";
import { authApi } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;            // Display role: "Admin" or "User"
  orgRole: string;         // Org-level role: "Owner" | "Admin" | "Manager" | "Operator"
  orgId: string | null;    // Organization ID (null if not in an org)
  isSuperAdmin: boolean;   // SaaS-level super admin
  linkedWorkerId: string | null; // Worker profile linked to Operator
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  hasOrg: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const buildUserFromInfo = (userInfo: any): User => ({
    id: userInfo.uid,
    email: userInfo.email,
    name: userInfo.name || userInfo.email.split("@")[0],
    role: userInfo.role,
    orgRole: userInfo.org_role || "Operator",
    orgId: userInfo.org_id || null,
    isSuperAdmin: userInfo.is_super_admin || false,
    linkedWorkerId: userInfo.linked_worker_id || null,
  });

  const refreshUser = async () => {
    // Force refresh the Firebase token to pick up new custom claims
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      const idToken = await firebaseUser.getIdToken(true); // force refresh
      setToken(idToken);
      localStorage.setItem("asm_token", idToken);

      const userInfo = await authApi.getMe();
      const appUser = buildUserFromInfo(userInfo);
      setUser(appUser);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          setToken(idToken);
          localStorage.setItem("asm_token", idToken);

          const userInfo = await authApi.getMe();
          const appUser = buildUserFromInfo(userInfo);
          setUser(appUser);
        } catch {
          setUser(null);
          setToken(null);
          localStorage.removeItem("asm_token");
        }
      } else {
        setUser(null);
        setToken(null);
        localStorage.removeItem("asm_token");
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await credential.user.getIdToken();

    setToken(idToken);
    localStorage.setItem("asm_token", idToken);

    const userInfo = await authApi.getMe();
    const newUser = buildUserFromInfo(userInfo);
    setUser(newUser);
  };

  const signup = async (email: string, password: string, name: string, role: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const idToken = await credential.user.getIdToken();

    setToken(idToken);
    localStorage.setItem("asm_token", idToken);

    // Register user profile on the backend (saves to Firestore)
    const userInfo = await authApi.register(name, role);
    const newUser = buildUserFromInfo(userInfo);
    setUser(newUser);
  };

  const logout = () => {
    signOut(auth);
    setUser(null);
    setToken(null);
    localStorage.removeItem("asm_token");
  };

  const isAdmin = user?.role === "Admin" || user?.orgRole === "Admin" || user?.orgRole === "Owner";
  const isOwner = user?.orgRole === "Owner";
  const hasOrg = !!user?.orgId;

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAdmin, isOwner, hasOrg, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
