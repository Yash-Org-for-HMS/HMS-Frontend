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
  permissions: string[];
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
  updateHospital: (hospitalData: Partial<HospitalInfo>) => void;
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
    const token = sessionStorage.getItem("hospitalAccessToken");
    const storedUser = sessionStorage.getItem("hospitalUser");
    const storedHospital = sessionStorage.getItem("hospitalInfo");
    const storedBranch = sessionStorage.getItem("hospitalBranch");
    const storedSession = sessionStorage.getItem("hospitalSessionId");

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
    sessionStorage.setItem("hospitalAccessToken", token);
    sessionStorage.setItem("hospitalRefreshToken", refresh);
    sessionStorage.setItem("hospitalUser", JSON.stringify(userData));
    sessionStorage.setItem("hospitalInfo", JSON.stringify(hospitalData));
    if (branchData) {
      sessionStorage.setItem("hospitalBranch", JSON.stringify(branchData));
    }
    sessionStorage.setItem("hospitalSessionId", sessId);

    setUser(userData);
    setHospital(hospitalData);
    setBranch(branchData);
    setSessionId(sessId);

    // Role-based redirect
    const receptionRoles = ["RECEPTIONIST", "RECEPTION", "receptionist", "reception"];
    const nurseRoles = ["NURSE", "nurse"];
    const doctorRoles = ["DOCTOR", "doctor"];
    const labRoles = ["LAB_ADMIN", "LAB_TECH", "LAB", "lab admin", "lab tech"];
    
    if (receptionRoles.includes(userData.role)) {
      navigate("/reception/dashboard");
    } else if (nurseRoles.includes(userData.role)) {
      navigate("/nurse/dashboard");
    } else if (doctorRoles.includes(userData.role)) {
      navigate("/doctor/dashboard");
    } else if (labRoles.includes(userData.role)) {
      navigate("/lab/dashboard");
    } else {
      navigate("/hospital/dashboard");
    }
  };

  const updateHospital = (hospitalData: Partial<HospitalInfo>) => {
    setHospital((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...hospitalData };
      sessionStorage.setItem("hospitalInfo", JSON.stringify(updated));
      return updated;
    });
  };

  const logout = async () => {
    try {
      if (sessionId) {
        await axiosInstance.post(
          "/hospital-auth/logout",
          { sessionId },
          {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem("hospitalAccessToken")}`,
            },
          }
        );
      }
    } catch (err) {
      console.error("Error logging out from server", err);
    } finally {
      sessionStorage.removeItem("hospitalAccessToken");
      sessionStorage.removeItem("hospitalRefreshToken");
      sessionStorage.removeItem("hospitalUser");
      sessionStorage.removeItem("hospitalInfo");
      sessionStorage.removeItem("hospitalBranch");
      sessionStorage.removeItem("hospitalSessionId");
      
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
        updateHospital,
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
