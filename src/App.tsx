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
import HospitalOverview from "./pages/superAdmins/HospitalOverview";
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
import DepartmentsList from "./pages/hospitalAuth/departments/DepartmentsList";
import DepartmentForm from "./pages/hospitalAuth/departments/DepartmentForm";
import HospitalUsersList from "./pages/hospitalAuth/users/UsersList";
import HospitalUserForm from "./pages/hospitalAuth/users/UserForm";
import HospitalRolesList from "./pages/hospitalAuth/roles/RolesList";
import HospitalRoleForm from "./pages/hospitalAuth/roles/RoleForm";
import PermissionMatrix from "./pages/hospitalAuth/roles/PermissionMatrix";
import ModuleAccess from "./pages/hospitalAuth/settings/ModuleAccess";
import DoctorsList from "./pages/hospitalAuth/doctors/DoctorsList";
import DoctorForm from "./pages/hospitalAuth/doctors/DoctorForm";
import DoctorSchedule from "./pages/hospitalAuth/doctors/DoctorSchedule";
import DoctorLeaves from "./pages/hospitalAuth/doctors/DoctorLeaves";
import LookupManager from "./pages/hospitalAuth/settings/LookupManager";
import FormTemplatesList from "./pages/hospitalAuth/formBuilder/FormTemplatesList";
import FormBuilder from "./pages/hospitalAuth/formBuilder/FormBuilder";
import AuditLogs from "./pages/hospitalAuth/settings/AuditLogs";
import { HospitalAuthProvider } from "./contexts/HospitalAuthContext";
import { HospitalProtectedRoute } from "./components/HospitalProtectedRoute";
import HospitalLayout from "./layouts/HospitalLayout";
import ReceptionLayout from "./layouts/ReceptionLayout";
import NurseLayout from "./layouts/NurseLayout";
import ReceptionDashboard from "./pages/reception/ReceptionDashboard";
import PatientsList from "./pages/reception/PatientsList";
import PatientForm from "./pages/reception/PatientForm";
import PatientProfile from "./pages/reception/PatientProfile";
import AppointmentsList from "./pages/reception/AppointmentsList";
import AppointmentForm from "./pages/reception/AppointmentForm";
import QueueDashboard from "./pages/reception/QueueDashboard";
import BillingDashboard from "./pages/reception/BillingDashboard";
import NotificationsLog from "./pages/reception/NotificationsLog";
import FrontDeskConsole from "./pages/reception/FrontDeskConsole";

// Nurse Imports
import NurseDashboard from "./pages/nurse/NurseDashboard";
import NurseQueue from "./pages/nurse/NurseQueue";
import NurseVitalsStation from "./pages/nurse/NurseVitalsStation";
// Doctor Imports
import DoctorLayout from "./layouts/DoctorLayout";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import DoctorQueue from "./pages/doctor/DoctorQueue";
import ConsultationWorkspace from "./pages/doctor/ConsultationWorkspace";
// Lab Imports
import LabLayout from "./layouts/LabLayout";
import LabDashboard from "./pages/lab/LabDashboard";
import LabOrdersQueue from "./pages/lab/LabOrdersQueue";
import UpdateLabOrder from "./pages/lab/UpdateLabOrder";
import RadiologyOrdersQueue from "./pages/lab/RadiologyOrdersQueue";
import LabTestCatalog from "./pages/lab/LabTestCatalog";
import PrintLabReport from "./pages/lab/PrintLabReport";
import RadiologyCatalog from "./pages/lab/RadiologyCatalog";

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
            <Route path="/hospitals/:id/overview" element={<HospitalOverview />} />
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
            <Route path="/hospital/departments" element={<DepartmentsList />} />
            <Route path="/hospital/departments/new" element={<DepartmentForm />} />
            <Route path="/hospital/departments/:id/edit" element={<DepartmentForm />} />
            <Route path="/hospital/users" element={<HospitalUsersList />} />
            <Route path="/hospital/users/new" element={<HospitalUserForm />} />
            <Route path="/hospital/users/:id/edit" element={<HospitalUserForm />} />
            <Route path="/hospital/roles" element={<HospitalRolesList />} />
            <Route path="/hospital/roles/new" element={<HospitalRoleForm />} />
            <Route path="/hospital/roles/:id/edit" element={<HospitalRoleForm />} />
            <Route path="/hospital/permissions-matrix" element={<PermissionMatrix />} />
            <Route path="/hospital/module-access" element={<ModuleAccess />} />
            <Route path="/hospital/doctors" element={<DoctorsList />} />

            <Route path="/hospital/doctors/:id/edit" element={<DoctorForm />} />
            <Route path="/hospital/doctors/:id/schedule" element={<DoctorSchedule />} />
            <Route path="/hospital/doctors/:id/leaves" element={<DoctorLeaves />} />
            <Route path="/hospital/lookups" element={<LookupManager />} />
            <Route path="/hospital/form-builder" element={<FormTemplatesList />} />
            <Route path="/hospital/form-builder/new" element={<FormBuilder />} />
            <Route path="/hospital/form-builder/:id/edit" element={<FormBuilder />} />
            <Route path="/hospital/audit-logs" element={<AuditLogs />} />
            {/* Add more hospital routes here as they are built */}
          </Route>
        </Route>

        {/* ── Reception Panel Routes ─────────────────────── */}
        <Route element={<HospitalProtectedRoute />}>
          <Route element={<ReceptionLayout />}>
            <Route path="/reception/dashboard" element={<ReceptionDashboard />} />
            <Route path="/reception/console" element={<FrontDeskConsole />} />
            {/* ── Module 2: Patient Registration ── */}
            <Route path="/reception/patients" element={<PatientsList />} />
            <Route path="/reception/patients/new" element={<PatientForm />} />
            <Route path="/reception/patients/:id" element={<PatientProfile />} />
            <Route path="/reception/patients/:id/edit" element={<PatientForm />} />
            
            <Route path="/reception/appointments" element={<AppointmentsList />} />
            <Route path="/reception/appointments/new" element={<AppointmentForm />} />
            <Route path="/reception/appointments/:id/edit" element={<AppointmentForm />} />
            
            <Route path="/reception/queue" element={<QueueDashboard />} />
            <Route path="/reception/queue/new" element={<QueueDashboard />} />
            
            <Route path="/reception/billing" element={<BillingDashboard />} />
            <Route path="/reception/notifications" element={<NotificationsLog />} />
          </Route>
        </Route>
        {/* ── Nurse Panel Routes ────────────────────────────────────── */}
        <Route element={<HospitalProtectedRoute />}>
          <Route element={<NurseLayout />}>
            <Route path="/nurse/dashboard" element={<NurseDashboard />} />
            <Route path="/nurse/queue" element={<NurseQueue />} />
            <Route path="/nurse/vitals" element={<NurseVitalsStation />} />
          </Route>
        </Route>

        {/* ── Doctor Panel Routes ───────────────────────────────────── */}
        <Route element={<HospitalProtectedRoute />}>
          <Route element={<DoctorLayout />}>
            <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
            <Route path="/doctor/queue" element={<DoctorQueue />} />
            <Route path="/doctor/consultation/:appointmentId" element={<ConsultationWorkspace />} />
          </Route>
        </Route>

        {/* ── Lab Panel Routes ──────────────────────────────────────── */}
        <Route element={<HospitalProtectedRoute />}>
          <Route path="/lab/orders/:id/print" element={<PrintLabReport />} />
          <Route element={<LabLayout />}>
            <Route path="/lab/dashboard" element={<LabDashboard />} />
            <Route path="/lab/orders" element={<LabOrdersQueue />} />
            <Route path="/lab/orders/:id" element={<UpdateLabOrder />} />
            <Route path="/lab/radiology" element={<RadiologyOrdersQueue />} />
            <Route path="/lab/catalog" element={<LabTestCatalog />} />
            <Route path="/lab/radiology-catalog" element={<RadiologyCatalog />} />
          </Route>
        </Route>
      </Routes>
    </HospitalAuthProvider>
    </>
  );
}

export default App;
