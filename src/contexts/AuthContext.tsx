import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
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
    // Check if token and user data exist on mount
    const token = localStorage.getItem("accessToken");
    const storedUser = localStorage.getItem("user");

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

  const login = (token: string, refresh: string, userData: User) => {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("refreshToken", refresh);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    navigate("/");
  };

  const logout = async () => {
    try {
      // Optional: Call backend logout API to invalidate tokens if tracking state server-side
      await axiosInstance.post("/auth/logout");
    } catch (err) {
      console.error("Error logging out from server", err);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      setUser(null);
      navigate("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, login, logout, loading }}
    >
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
