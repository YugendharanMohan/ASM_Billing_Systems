import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authApi } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session and validate token
    const storedUser = localStorage.getItem("asm_user");
    const storedToken = localStorage.getItem("asm_token");
    
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
      
      // Validate token with backend
      authApi.getMe()
        .then((userInfo) => {
          const validatedUser: User = {
            id: userInfo.uid,
            email: userInfo.email,
            name: userInfo.email.split("@")[0],
            role: userInfo.role,
          };
          setUser(validatedUser);
          localStorage.setItem("asm_user", JSON.stringify(validatedUser));
        })
        .catch(() => {
          // Token invalid, clear session
          setUser(null);
          setToken(null);
          localStorage.removeItem("asm_user");
          localStorage.removeItem("asm_token");
        });
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    
    // Store the token
    const authToken = response.access_token;
    setToken(authToken);
    localStorage.setItem("asm_token", authToken);

    // Fetch user info
    const userInfo = await authApi.getMe();
    const newUser: User = {
      id: userInfo.uid,
      email: userInfo.email,
      name: userInfo.email.split("@")[0],
      role: userInfo.role,
    };
    
    setUser(newUser);
    localStorage.setItem("asm_user", JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("asm_user");
    localStorage.removeItem("asm_token");
  };

  const isAdmin = user?.role === "Admin";

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAdmin, login, logout }}>
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
