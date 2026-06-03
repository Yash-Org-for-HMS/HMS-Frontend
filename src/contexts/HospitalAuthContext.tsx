import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { axiosInstance } from "../api/axios";
import { useNavigate } from "react-router-dom";

export interface HospitalUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeCode: string | null;
  role: string;
  roleName: string;
}

export interface HospitalInfo {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
}

export interface BranchInfo {
  id: string;
  name: string;
  code: string;
}

interface HospitalAuthContextType {
  user: HospitalUser | null;
  hospital: HospitalInfo | null;
  branch: BranchInfo | null;
  isAuthenticated: boolean;
  loading: boolean;
  sessionId: string | null;
  login: (
    token: string,
    refresh: string,
    userData: HospitalUser,
    hospitalData: HospitalInfo,
    branchData: BranchInfo | null,
    sessionId: string,
  ) => void;
  logout: () => void;
}

const HospitalAuthContext = createContext<HospitalAuthContextType | undefined>(undefined);

export function HospitalAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<HospitalUser | null>(null);
  const [hospital, setHospital] = useState<HospitalInfo | null>(null);
  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if token and user data exist on mount
    const token = localStorage.getItem("hospitalAccessToken");
    const storedUser = localStorage.getItem("hospitalUser");
    const storedHospital = localStorage.getItem("hospitalInfo");
    const storedBranch = localStorage.getItem("hospitalBranch");
    const storedSession = localStorage.getItem("hospitalSessionId");

    if (token && storedUser && storedHospital) {
      try {
        setUser(JSON.parse(storedUser));
        setHospital(JSON.parse(storedHospital));
        if (storedBranch) setBranch(JSON.parse(storedBranch));
        if (storedSession) setSessionId(storedSession);
      } catch (err) {
        console.error("Failed to parse hospital user from local storage", err);
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = (
    token: string,
    refresh: string,
    userData: HospitalUser,
    hospitalData: HospitalInfo,
    branchData: BranchInfo | null,
    sessId: string,
  ) => {
    localStorage.setItem("hospitalAccessToken", token);
    localStorage.setItem("hospitalRefreshToken", refresh);
    localStorage.setItem("hospitalUser", JSON.stringify(userData));
    localStorage.setItem("hospitalInfo", JSON.stringify(hospitalData));
    if (branchData) {
      localStorage.setItem("hospitalBranch", JSON.stringify(branchData));
    }
    localStorage.setItem("hospitalSessionId", sessId);

    setUser(userData);
    setHospital(hospitalData);
    setBranch(branchData);
    setSessionId(sessId);

    // Role-based redirect: receptionists go to /reception/dashboard
    const receptionRoles = ["RECEPTIONIST", "RECEPTION", "receptionist", "reception"];
    if (receptionRoles.includes(userData.role)) {
      navigate("/reception/dashboard");
    } else {
      navigate("/hospital/dashboard");
    }
  };

  const logout = async () => {
    try {
      if (sessionId) {
        await axiosInstance.post(
          "/hospital-auth/logout",
          { sessionId },
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("hospitalAccessToken")}`,
            },
          }
        );
      }
    } catch (err) {
      console.error("Error logging out from server", err);
    } finally {
      localStorage.removeItem("hospitalAccessToken");
      localStorage.removeItem("hospitalRefreshToken");
      localStorage.removeItem("hospitalUser");
      localStorage.removeItem("hospitalInfo");
      localStorage.removeItem("hospitalBranch");
      localStorage.removeItem("hospitalSessionId");
      
      setUser(null);
      setHospital(null);
      setBranch(null);
      setSessionId(null);
      
      navigate("/hospital/login");
    }
  };

  return (
    <HospitalAuthContext.Provider
      value={{
        user,
        hospital,
        branch,
        isAuthenticated: !!user,
        loading,
        sessionId,
        login,
        logout,
      }}
    >
      {children}
    </HospitalAuthContext.Provider>
  );
}

export function useHospitalAuth() {
  const context = useContext(HospitalAuthContext);
  if (context === undefined) {
    throw new Error("useHospitalAuth must be used within a HospitalAuthProvider");
  }
  return context;
}
