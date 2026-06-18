import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { axiosInstance, setAccessToken } from "../api/axios";
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
    // Restore from the stored profile only; the access token is held in memory
    // and re-obtained from the httpOnly refresh cookie on the first 401.
    const storedUser = sessionStorage.getItem("user");

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error("Failed to parse user from local storage", err);
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = (token: string, _refresh: string, userData: User) => {
    // Access token in memory only; refresh token is an httpOnly cookie.
    setAccessToken("admin", token);
    sessionStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    navigate("/");
  };

  const logout = async () => {
    try {
      // Invalidate server-side and clear the httpOnly refresh cookie.
      await axiosInstance.post("/auth/logout");
    } catch (err) {
      console.error("Error logging out from server", err);
    } finally {
      setAccessToken("admin", null);
      sessionStorage.removeItem("user");
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
