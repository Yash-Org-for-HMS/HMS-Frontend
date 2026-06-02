import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import PlansList from "./pages/plans/PlansList";
import PlanForm from "./pages/plans/PlanForm";
import FeatureFlagsList from "./pages/featureFlags/FeatureFlagsList";
import FeatureFlagForm from "./pages/featureFlags/FeatureFlagForm";
import LeadsList from "./pages/leads/LeadsList";
import LeadForm from "./pages/leads/LeadForm";
import TrialsList from "./pages/trials/TrialsList";
import TrialForm from "./pages/trials/TrialForm";
import HospitalsList from "./pages/hospitals/HospitalsList";
import HospitalForm from "./pages/hospitals/HospitalForm";
import OnboardingList from "./pages/onboarding/OnboardingList";
import OnboardingForm from "./pages/onboarding/OnboardingForm";
import SuperAdminsList from "./pages/superAdmins/SuperAdminsList";
import SuperAdminForm from "./pages/superAdmins/SuperAdminForm";
import RolesList from "./pages/rbac/RolesList";
import RoleForm from "./pages/rbac/RoleForm";
import UsersList from "./pages/rbac/UsersList";
import UserForm from "./pages/rbac/UserForm";
import AuditLogsList from "./pages/auditLogs/AuditLogsList";
import { ProtectedRoute } from "./components/ProtectedRoute";
import AdminLayout from "./layouts/AdminLayout";
import { AuthProvider } from "./contexts/AuthContext";

// Hospital Admin Imports
import HospitalLogin from "./pages/hospitalAuth/HospitalLogin";
import HospitalChangePassword from "./pages/hospitalAuth/HospitalChangePassword";
import HospitalDashboard from "./pages/hospitalAuth/HospitalDashboard";
import HospitalProfile from "./pages/hospitalAuth/HospitalProfile";
import HospitalSettings from "./pages/hospitalAuth/HospitalSettings";
import { HospitalAuthProvider } from "./contexts/HospitalAuthContext";
import { HospitalProtectedRoute } from "./components/HospitalProtectedRoute";
import HospitalLayout from "./layouts/HospitalLayout";

function App() {
  return (
    <>
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/plans" element={<PlansList />} />
            <Route path="/plans/new" element={<PlanForm />} />
            <Route path="/plans/:id/edit" element={<PlanForm />} />
            <Route path="/feature-flags" element={<FeatureFlagsList />} />
            <Route path="/feature-flags/new" element={<FeatureFlagForm />} />
            <Route path="/feature-flags/:id/edit" element={<FeatureFlagForm />} />
            <Route path="/leads" element={<LeadsList />} />
            <Route path="/leads/new" element={<LeadForm />} />
            <Route path="/leads/:id/edit" element={<LeadForm />} />
            <Route path="/trials" element={<TrialsList />} />
            <Route path="/trials/new" element={<TrialForm />} />
            <Route path="/hospitals" element={<HospitalsList />} />
            <Route path="/hospitals/new" element={<HospitalForm />} />
            <Route path="/hospitals/:id/edit" element={<HospitalForm />} />
            <Route path="/onboarding" element={<OnboardingList />} />
            <Route path="/onboarding/:id/edit" element={<OnboardingForm />} />
            <Route path="/super-admins" element={<SuperAdminsList />} />
            <Route path="/super-admins/new" element={<SuperAdminForm />} />
            <Route path="/super-admins/:id/edit" element={<SuperAdminForm />} />
            <Route path="/rbac/roles" element={<RolesList />} />
            <Route path="/rbac/roles/new" element={<RoleForm />} />
            <Route path="/rbac/roles/:id/edit" element={<RoleForm />} />
            <Route path="/rbac/users" element={<UsersList />} />
            <Route path="/rbac/users/add" element={<UserForm />} />
            <Route path="/rbac/users/edit/:id" element={<UserForm />} />
            
            <Route path="/audit-logs" element={<AuditLogsList />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
    
    <HospitalAuthProvider>
      <Routes>
        <Route path="/hospital/login" element={<HospitalLogin />} />
        <Route path="/hospital/change-password" element={<HospitalChangePassword />} />
        
        <Route element={<HospitalProtectedRoute />}>
          <Route element={<HospitalLayout />}>
            <Route path="/hospital/dashboard" element={<HospitalDashboard />} />
            <Route path="/hospital/profile" element={<HospitalProfile />} />
            <Route path="/hospital/settings" element={<HospitalSettings />} />
            {/* Add more hospital routes here as they are built */}
          </Route>
        </Route>
      </Routes>
    </HospitalAuthProvider>
    </>
  );
}

export default App;
