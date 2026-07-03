import { lazy, Suspense, type ComponentType } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// ── Eager: app shell + auth entry ───────────────────────────────────────────
// Kept in the initial bundle so the login screen and the authenticated shell
// (layouts/guards) render instantly. Everything else is lazy-loaded per route.
import { ProtectedRoute } from "./components/ProtectedRoute";
import { HospitalProtectedRoute } from "./components/HospitalProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { HospitalAuthProvider } from "./contexts/HospitalAuthContext";
// Layouts are lazy: only one realm's shell is ever used per session, and
// deferring them keeps their deps (e.g. socket.io in DoctorLayout) out of the
// login-critical first paint. Each is rendered via el() so it gets a Suspense
// boundary + the standard PageSkeleton fallback.
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const HospitalLayout = lazy(() => import("./layouts/HospitalLayout"));
const ReceptionLayout = lazy(() => import("./layouts/ReceptionLayout"));
const NurseLayout = lazy(() => import("./layouts/NurseLayout"));
const DoctorLayout = lazy(() => import("./layouts/DoctorLayout"));
const LabLayout = lazy(() => import("./layouts/LabLayout"));
const PharmacyLayout = lazy(() => import("./layouts/PharmacyLayout"));
import CommandPalette from "./components/CommandPalette";
import PageSkeleton from "./components/PageSkeleton";
import Login from "./pages/Login";
import HospitalLogin from "./pages/hospitalAuth/HospitalLogin";

// ── Lazy: every route page becomes its own on-demand chunk ───────────────────
// Declared at module scope (NOT inside render) so React.lazy is created once.
// Super Admin
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PlansList = lazy(() => import("./pages/plans/PlansList"));
const PlanForm = lazy(() => import("./pages/plans/PlanForm"));
const FeatureFlagsList = lazy(() => import("./pages/featureFlags/FeatureFlagsList"));
const FeatureFlagForm = lazy(() => import("./pages/featureFlags/FeatureFlagForm"));
const LeadsList = lazy(() => import("./pages/leads/LeadsList"));
const LeadForm = lazy(() => import("./pages/leads/LeadForm"));
const TrialsList = lazy(() => import("./pages/trials/TrialsList"));
const TrialForm = lazy(() => import("./pages/trials/TrialForm"));
const HospitalsList = lazy(() => import("./pages/hospitals/HospitalsList"));
const HospitalForm = lazy(() => import("./pages/hospitals/HospitalForm"));
const HospitalOverview = lazy(() => import("./pages/superAdmins/HospitalOverview"));
const HospitalModules = lazy(() => import("./pages/hospitals/HospitalModules"));
const OnboardingList = lazy(() => import("./pages/onboarding/OnboardingList"));
const OnboardingForm = lazy(() => import("./pages/onboarding/OnboardingForm"));
const SuperAdminsList = lazy(() => import("./pages/superAdmins/SuperAdminsList"));
const SuperAdminForm = lazy(() => import("./pages/superAdmins/SuperAdminForm"));
const RolesList = lazy(() => import("./pages/rbac/RolesList"));
const RoleForm = lazy(() => import("./pages/rbac/RoleForm"));
const UsersList = lazy(() => import("./pages/rbac/UsersList"));
const UserForm = lazy(() => import("./pages/rbac/UserForm"));
const AuditLogsList = lazy(() => import("./pages/auditLogs/AuditLogsList"));

// Hospital Admin
const HospitalChangePassword = lazy(() => import("./pages/hospitalAuth/HospitalChangePassword"));
const HospitalDashboard = lazy(() => import("./pages/hospitalAuth/HospitalDashboard"));
const HospitalProfile = lazy(() => import("./pages/hospitalAuth/HospitalProfile"));
const HospitalSettings = lazy(() => import("./pages/hospitalAuth/HospitalSettings"));
const DepartmentsList = lazy(() => import("./pages/hospitalAuth/departments/DepartmentsList"));
const DepartmentForm = lazy(() => import("./pages/hospitalAuth/departments/DepartmentForm"));
const HospitalUsersList = lazy(() => import("./pages/hospitalAuth/users/UsersList"));
const HospitalUserForm = lazy(() => import("./pages/hospitalAuth/users/UserForm"));
const HospitalRolesList = lazy(() => import("./pages/hospitalAuth/roles/RolesList"));
const HospitalRoleForm = lazy(() => import("./pages/hospitalAuth/roles/RoleForm"));
const PermissionMatrix = lazy(() => import("./pages/hospitalAuth/roles/PermissionMatrix"));
const ModuleAccess = lazy(() => import("./pages/hospitalAuth/settings/ModuleAccess"));
const DoctorsList = lazy(() => import("./pages/hospitalAuth/doctors/DoctorsList"));
const DoctorForm = lazy(() => import("./pages/hospitalAuth/doctors/DoctorForm"));
const DoctorSchedule = lazy(() => import("./pages/hospitalAuth/doctors/DoctorSchedule"));
const DoctorLeaves = lazy(() => import("./pages/hospitalAuth/doctors/DoctorLeaves"));
const LookupManager = lazy(() => import("./pages/hospitalAuth/settings/LookupManager"));
const FormTemplatesList = lazy(() => import("./pages/hospitalAuth/formBuilder/FormTemplatesList"));
const FormBuilder = lazy(() => import("./pages/hospitalAuth/formBuilder/FormBuilder"));
const AuditLogs = lazy(() => import("./pages/hospitalAuth/settings/AuditLogs"));
const FinancialDashboard = lazy(() => import("./pages/billing/FinancialDashboard"));

// Reception
const ReceptionDashboard = lazy(() => import("./pages/reception/ReceptionDashboard"));
const PatientsList = lazy(() => import("./pages/reception/PatientsList"));
const PatientForm = lazy(() => import("./pages/reception/PatientForm"));
const PatientProfile = lazy(() => import("./pages/reception/PatientProfile"));
const AppointmentsList = lazy(() => import("./pages/reception/AppointmentsList"));
const AppointmentCalendar = lazy(() => import("./pages/reception/AppointmentCalendar"));
const AppointmentForm = lazy(() => import("./pages/reception/AppointmentForm"));
const DoctorAvailability = lazy(() => import("./pages/reception/DoctorAvailability"));
const DepartmentDirectory = lazy(() => import("./pages/reception/DepartmentDirectory"));
const ReferralsList = lazy(() => import("./pages/reception/ReferralsList"));
const Reports = lazy(() => import("./pages/reception/Reports"));
const Admissions = lazy(() => import("./pages/ipd/Admissions"));
const BedBoard = lazy(() => import("./pages/ipd/BedBoard"));
const QueueDashboard = lazy(() => import("./pages/reception/QueueDashboard"));
const Billing = lazy(() => import("./pages/reception/Billing"));
const NotificationsLog = lazy(() => import("./pages/reception/NotificationsLog"));
const FrontDeskConsole = lazy(() => import("./pages/reception/FrontDeskConsole"));

// Nurse
const NurseDashboard = lazy(() => import("./pages/nurse/NurseDashboard"));
const NurseQueue = lazy(() => import("./pages/nurse/NurseQueue"));

// Doctor
const DoctorDashboard = lazy(() => import("./pages/doctor/DoctorDashboard"));
const DoctorQueue = lazy(() => import("./pages/doctor/DoctorQueue"));
const ConsultationWorkspace = lazy(() => import("./pages/doctor/ConsultationWorkspace"));
const DoctorPatients = lazy(() => import("./pages/doctor/DoctorPatients"));
const DoctorPatientProfile = lazy(() => import("./pages/doctor/DoctorPatientProfile"));
const DoctorResults = lazy(() => import("./pages/doctor/DoctorResults"));
const DoctorReports = lazy(() => import("./pages/doctor/DoctorReports"));

// Lab
const LabDashboard = lazy(() => import("./pages/lab/LabDashboard"));
const LabOrdersQueue = lazy(() => import("./pages/lab/LabOrdersQueue"));
const UpdateLabOrder = lazy(() => import("./pages/lab/UpdateLabOrder"));
const RadiologyOrdersQueue = lazy(() => import("./pages/lab/RadiologyOrdersQueue"));
const LabTestCatalog = lazy(() => import("./pages/lab/LabTestCatalog"));
const PrintLabReport = lazy(() => import("./pages/lab/PrintLabReport"));
const RadiologyCatalog = lazy(() => import("./pages/lab/RadiologyCatalog"));

// Pharmacy
const PharmacyDashboard = lazy(() => import("./pages/pharmacy/PharmacyDashboard"));
const MedicineCatalog = lazy(() => import("./pages/pharmacy/MedicineCatalog"));
const SupplierDirectory = lazy(() => import("./pages/pharmacy/SupplierDirectory"));
const InventoryManagement = lazy(() => import("./pages/pharmacy/InventoryManagement"));
const DispensaryPOS = lazy(() => import("./pages/pharmacy/DispensaryPOS"));

// Wrap a lazy page in a Suspense boundary with the skeleton fallback. The
// boundary sits at the page-content level (inside each layout's <Outlet/>), so
// only the content area shows the skeleton while its chunk loads — the
// surrounding layout/sidebar stays rendered. `C` is a stable module-scope lazy
// component, so this only builds an element (no React.lazy re-creation).
const el = (C: ComponentType<any>) => (
  <Suspense fallback={<PageSkeleton />}>
    <C />
  </Suspense>
);

function App() {
  return (
    <>
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route element={el(AdminLayout)}>
            <Route path="/" element={el(Dashboard)} />
            <Route path="/plans" element={el(PlansList)} />
            <Route path="/plans/new" element={el(PlanForm)} />
            <Route path="/plans/:id/edit" element={el(PlanForm)} />
            <Route path="/feature-flags" element={el(FeatureFlagsList)} />
            <Route path="/feature-flags/new" element={el(FeatureFlagForm)} />
            <Route path="/feature-flags/:id/edit" element={el(FeatureFlagForm)} />
            <Route path="/leads" element={el(LeadsList)} />
            <Route path="/leads/new" element={el(LeadForm)} />
            <Route path="/leads/:id/edit" element={el(LeadForm)} />
            <Route path="/trials" element={el(TrialsList)} />
            <Route path="/trials/new" element={el(TrialForm)} />
            <Route path="/hospitals" element={el(HospitalsList)} />
            <Route path="/hospitals/new" element={el(HospitalForm)} />
            <Route path="/hospitals/:id/edit" element={el(HospitalForm)} />
            <Route path="/hospitals/:id/overview" element={el(HospitalOverview)} />
            <Route path="/hospitals/:id/modules" element={el(HospitalModules)} />
            <Route path="/onboarding" element={el(OnboardingList)} />
            <Route path="/onboarding/:id/edit" element={el(OnboardingForm)} />
            <Route path="/super-admins" element={el(SuperAdminsList)} />
            <Route path="/super-admins/new" element={el(SuperAdminForm)} />
            <Route path="/super-admins/:id/edit" element={el(SuperAdminForm)} />
            <Route path="/rbac/roles" element={el(RolesList)} />
            <Route path="/rbac/roles/new" element={el(RoleForm)} />
            <Route path="/rbac/roles/:id/edit" element={el(RoleForm)} />
            <Route path="/rbac/users" element={el(UsersList)} />
            <Route path="/rbac/users/add" element={el(UserForm)} />
            <Route path="/rbac/users/edit/:id" element={el(UserForm)} />

            <Route path="/audit-logs" element={el(AuditLogsList)} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>

    <HospitalAuthProvider>
      <CommandPalette />
      <Routes>
        <Route path="/hospital/login" element={<HospitalLogin />} />
        <Route path="/hospital/change-password" element={el(HospitalChangePassword)} />

        <Route element={<HospitalProtectedRoute />}>
          <Route element={el(HospitalLayout)}>
            <Route path="/hospital/dashboard" element={el(HospitalDashboard)} />
            <Route path="/hospital/profile" element={el(HospitalProfile)} />
            <Route path="/hospital/settings" element={el(HospitalSettings)} />
            <Route path="/hospital/departments" element={el(DepartmentsList)} />
            <Route path="/hospital/departments/new" element={el(DepartmentForm)} />
            <Route path="/hospital/departments/:id/edit" element={el(DepartmentForm)} />
            <Route path="/hospital/users" element={el(HospitalUsersList)} />
            <Route path="/hospital/users/new" element={el(HospitalUserForm)} />
            <Route path="/hospital/users/:id/edit" element={el(HospitalUserForm)} />
            <Route path="/hospital/roles" element={el(HospitalRolesList)} />
            <Route path="/hospital/roles/new" element={el(HospitalRoleForm)} />
            <Route path="/hospital/roles/:id/edit" element={el(HospitalRoleForm)} />
            <Route path="/hospital/financials" element={el(FinancialDashboard)} />
            <Route path="/hospital/permissions-matrix" element={el(PermissionMatrix)} />
            <Route path="/hospital/module-access" element={el(ModuleAccess)} />
            <Route path="/hospital/doctors" element={el(DoctorsList)} />

            <Route path="/hospital/doctors/:id/edit" element={el(DoctorForm)} />
            <Route path="/hospital/doctors/:id/schedule" element={el(DoctorSchedule)} />
            <Route path="/hospital/doctors/:id/leaves" element={el(DoctorLeaves)} />
            <Route path="/hospital/lookups" element={el(LookupManager)} />
            <Route path="/hospital/form-builder" element={el(FormTemplatesList)} />
            <Route path="/hospital/form-builder/new" element={el(FormBuilder)} />
            <Route path="/hospital/form-builder/:id/edit" element={el(FormBuilder)} />
            <Route path="/hospital/audit-logs" element={el(AuditLogs)} />
            {/* Add more hospital routes here as they are built */}
          </Route>
        </Route>

        {/* ── Reception Panel Routes ─────────────────────── */}
        <Route element={<HospitalProtectedRoute />}>
          <Route element={el(ReceptionLayout)}>
            <Route path="/reception/dashboard" element={el(ReceptionDashboard)} />
            <Route path="/reception/console" element={el(FrontDeskConsole)} />
            {/* ── Module 2: Patient Registration ── */}
            <Route path="/reception/patients" element={el(PatientsList)} />
            <Route path="/reception/patients/new" element={el(PatientForm)} />
            <Route path="/reception/patients/:id" element={el(PatientProfile)} />
            <Route path="/reception/patients/:id/edit" element={el(PatientForm)} />

            <Route path="/reception/appointments" element={el(AppointmentsList)} />
            <Route path="/reception/appointments/calendar" element={el(AppointmentCalendar)} />
            <Route path="/reception/appointments/new" element={el(AppointmentForm)} />
            <Route path="/reception/appointments/:id/edit" element={el(AppointmentForm)} />
            <Route path="/reception/doctors" element={el(DoctorAvailability)} />
            <Route path="/reception/directory" element={el(DepartmentDirectory)} />
            <Route path="/reception/referrals" element={el(ReferralsList)} />
            <Route path="/reception/reports" element={el(Reports)} />
            <Route path="/reception/ipd/admissions" element={el(Admissions)} />
            <Route path="/reception/ipd/beds" element={el(BedBoard)} />

            <Route path="/reception/queue" element={el(QueueDashboard)} />
            <Route path="/reception/billing" element={el(Billing)} />
            <Route path="/reception/notifications" element={el(NotificationsLog)} />
          </Route>
        </Route>
        {/* ── Nurse Panel Routes ────────────────────────────────────── */}
        <Route element={<HospitalProtectedRoute />}>
          <Route element={el(NurseLayout)}>
            <Route path="/nurse/dashboard" element={el(NurseDashboard)} />
            <Route path="/nurse/queue" element={el(NurseQueue)} />
            {/* Vitals Station merged into the Patient Queue page (view toggle). */}
            <Route path="/nurse/vitals" element={<Navigate to="/nurse/queue" replace />} />
          </Route>
        </Route>

        {/* ── Doctor Panel Routes ───────────────────────────────────── */}
        <Route element={<HospitalProtectedRoute />}>
          <Route element={el(DoctorLayout)}>
            <Route path="/doctor/dashboard" element={el(DoctorDashboard)} />
            <Route path="/doctor/queue" element={el(DoctorQueue)} />
            <Route path="/doctor/consultation/:appointmentId" element={el(ConsultationWorkspace)} />
            <Route path="/doctor/patients" element={el(DoctorPatients)} />
            <Route path="/doctor/results" element={el(DoctorResults)} />
            <Route path="/doctor/reports" element={el(DoctorReports)} />
            <Route path="/doctor/patients/:id" element={el(DoctorPatientProfile)} />
          </Route>
        </Route>

        {/* ── Lab Panel Routes ──────────────────────────────────────── */}
        <Route element={<HospitalProtectedRoute />}>
          <Route path="/lab/orders/:id/print" element={el(PrintLabReport)} />
          <Route element={el(LabLayout)}>
            <Route path="/lab/dashboard" element={el(LabDashboard)} />
            <Route path="/lab/orders" element={el(LabOrdersQueue)} />
            <Route path="/lab/orders/:id" element={el(UpdateLabOrder)} />
            <Route path="/lab/radiology" element={el(RadiologyOrdersQueue)} />
            <Route path="/lab/catalog" element={el(LabTestCatalog)} />
            <Route path="/lab/radiology-catalog" element={el(RadiologyCatalog)} />
          </Route>
        </Route>

        {/* ── Pharmacy Panel Routes ─────────────────────────────────── */}
        <Route element={<HospitalProtectedRoute />}>
          <Route element={el(PharmacyLayout)}>
            <Route path="/pharmacy/dashboard" element={el(PharmacyDashboard)} />
            <Route path="/pharmacy/medicines" element={el(MedicineCatalog)} />
            <Route path="/pharmacy/suppliers" element={el(SupplierDirectory)} />
            <Route path="/pharmacy/inventory" element={el(InventoryManagement)} />
            <Route path="/pharmacy/pos" element={el(DispensaryPOS)} />
          </Route>
        </Route>
      </Routes>
    </HospitalAuthProvider>
    </>
  );
}

export default App;
