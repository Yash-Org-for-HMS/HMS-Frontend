import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { axiosInstance } from "../api/axios";
import { useNavigate } from "react-router-dom";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, refresh: string, userData: User) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem("accessToken");
    const storedUser = sessionStorage.getItem("user");

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error("Failed to parse user from local storage", err);
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback((token: string, refresh: string, userData: User) => {
    sessionStorage.setItem("accessToken", token);
    sessionStorage.setItem("refreshToken", refresh);
    sessionStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    navigate("/");
  }, [navigate]);

  const logout = useCallback(async () => {
    try {
      // Optional: Call backend logout API to invalidate tokens if tracking state server-side
      await axiosInstance.post("/auth/logout");
    } catch (err) {
      console.error("Error logging out from server", err);
    } finally {
      sessionStorage.removeItem("accessToken");
      sessionStorage.removeItem("refreshToken");
      sessionStorage.removeItem("user");
      setUser(null);
      navigate("/login");
    }
  }, [navigate]);

  // Without this, every one of this provider's consumers re-rendered on any
  // provider re-render (e.g. the loading flip on mount), since a fresh object
  // literal was passed as the context value every time.
  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, login, logout, loading }),
    [user, loading, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>
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
