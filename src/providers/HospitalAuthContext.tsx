import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { getApiErrorMessage } from "@/utils/apiError";
import { axiosInstance } from "@/api/axios";
import { useNavigate } from "react-router-dom";
import { useToast } from "./ToastContext";

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

export interface AllowedBranch {
  branchId: string;
  branchName: string;
  branchCode: string;
}

interface HospitalAuthContextType {
  user: HospitalUser | null;
  hospital: HospitalInfo | null;
  branch: BranchInfo | null;
  isAuthenticated: boolean;
  loading: boolean;
  sessionId: string | null;
  // Multi-branch access
  availableBranches: AllowedBranch[];
  activeBranchId: string | null;
  isOrgAdmin: boolean;
  setActiveBranch: (branchId: string | null) => void;
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
  const [availableBranches, setAvailableBranches] = useState<AllowedBranch[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(
    () => sessionStorage.getItem("activeBranchId"),
  );
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  // Persist the active branch to sessionStorage so the axios interceptor sends
  // it as the X-Branch-Id header on every hospital-portal request.
  const setActiveBranch = useCallback((branchId: string | null) => {
    if (branchId) {
      sessionStorage.setItem("activeBranchId", branchId);
    } else {
      sessionStorage.removeItem("activeBranchId");
    }
    setActiveBranchIdState(branchId);
  }, []);

  // Load the branches this user may access (org admin → all; others → assigned).
  const loadBranches = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/hospital-auth/my-branches");
      const data = res.data?.data;
      const branches: AllowedBranch[] = data?.branches ?? [];
      setAvailableBranches(branches);
      setIsOrgAdmin(Boolean(data?.isOrgAdmin));

      // Default the active branch if none stored yet (or the stored one vanished).
      const stored = sessionStorage.getItem("activeBranchId");
      const storedValid = stored && branches.some((b) => b.branchId === stored);
      if (!storedValid) {
        const fallback = data?.activeBranchId ?? (branches[0]?.branchId ?? null);
        setActiveBranch(fallback);
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to load your accessible branches"));
    }
  }, [setActiveBranch, toast]);

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
        void loadBranches();
      } catch (err) {
        console.error("Failed to parse hospital user from local storage", err);
        logout();
      }
    }
    setLoading(false);
    // Mount-only: reads sessionStorage once. loadBranches/logout are stable
    // (useCallback), so omitting them here doesn't risk a stale closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback((
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

    // Seed the active branch with the user's home branch, then refine from the
    // server's allowed-branch list.
    setActiveBranch(branchData?.id ?? null);
    void loadBranches();

    // Role-based redirect
    const receptionRoles = ["RECEPTIONIST", "RECEPTION", "receptionist", "reception"];
    const nurseRoles = ["NURSE", "nurse"];
    const doctorRoles = ["DOCTOR", "doctor"];
    const labRoles = ["LAB_ADMIN", "LAB_TECH", "LAB", "lab admin", "lab tech"];
    const pharmacyRoles = ["PHARMACIST", "PHARMACY", "pharmacist", "pharmacy"];
    
    if (receptionRoles.includes(userData.role)) {
      navigate("/reception/dashboard");
    } else if (nurseRoles.includes(userData.role)) {
      navigate("/nurse/dashboard");
    } else if (doctorRoles.includes(userData.role)) {
      navigate("/doctor/dashboard");
    } else if (labRoles.includes(userData.role)) {
      navigate("/lab/dashboard");
    } else if (pharmacyRoles.includes(userData.role)) {
      navigate("/pharmacy/dashboard");
    } else {
      navigate("/hospital/dashboard");
    }
  }, [navigate, setActiveBranch, loadBranches]);

  const updateHospital = useCallback((hospitalData: Partial<HospitalInfo>) => {
    setHospital((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...hospitalData };
      sessionStorage.setItem("hospitalInfo", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const logout = useCallback(async () => {
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
      sessionStorage.removeItem("activeBranchId");

      setUser(null);
      setHospital(null);
      setBranch(null);
      setSessionId(null);
      setAvailableBranches([]);
      setActiveBranchIdState(null);
      setIsOrgAdmin(false);

      navigate("/hospital/login");
    }
  }, [sessionId, navigate]);

  // Without this, every one of this provider's 23 consumers re-rendered on any
  // provider re-render (branch switch, loading flip, etc.), since a fresh
  // object literal was passed as the context value every time.
  const value = useMemo(
    () => ({
      user,
      hospital,
      branch,
      isAuthenticated: !!user,
      loading,
      sessionId,
      availableBranches,
      activeBranchId,
      isOrgAdmin,
      setActiveBranch,
      login,
      updateHospital,
      logout,
    }),
    [user, hospital, branch, loading, sessionId, availableBranches, activeBranchId, isOrgAdmin, setActiveBranch, login, updateHospital, logout]
  );

  return (
    <HospitalAuthContext.Provider value={value}>
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
