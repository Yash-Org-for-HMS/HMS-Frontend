import { lazy, Suspense, type ComponentType } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// ── Eager: app shell + auth entry ───────────────────────────────────────────
// Kept in the initial bundle so the login screen and the authenticated shell
// (layouts/guards) render instantly. Everything else is lazy-loaded per route.
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { HospitalProtectedRoute } from "@/components/HospitalProtectedRoute";
import { AuthProvider } from "@/providers/AuthContext";
import { HospitalAuthProvider } from "@/providers/HospitalAuthContext";
// Layouts are lazy: only one realm's shell is ever used per session, and
// deferring them keeps their deps (e.g. socket.io in DoctorLayout) out of the
// login-critical first paint. Each is rendered via el() so it gets a Suspense
// boundary + the standard PageSkeleton fallback.
const AdminLayout = lazy(() => import("@/layouts/AdminLayout"));
const HospitalLayout = lazy(() => import("@/layouts/HospitalLayout"));
const ReceptionLayout = lazy(() => import("@/layouts/ReceptionLayout"));
const NurseLayout = lazy(() => import("@/layouts/NurseLayout"));
const DoctorLayout = lazy(() => import("@/layouts/DoctorLayout"));
const LabLayout = lazy(() => import("@/layouts/LabLayout"));
const PharmacyLayout = lazy(() => import("@/layouts/PharmacyLayout"));
import CommandPalette from "@/components/CommandPalette";
import PageSkeleton from "@/components/PageSkeleton";
import ModuleGate from "@/components/ModuleGate";
import Login from "@/features/Login";
import HospitalLogin from "@/features/hospitalAuth/HospitalLogin";

// ── Lazy: every route page becomes its own on-demand chunk ───────────────────
// Declared at module scope (NOT inside render) so React.lazy is created once.
// Super Admin
const Dashboard = lazy(() => import("@/features/Dashboard"));
const PlansList = lazy(() => import("@/features/plans/PlansList"));
const PlanForm = lazy(() => import("@/features/plans/PlanForm"));
const SubscriptionBilling = lazy(() => import("@/features/subscriptionBilling/SubscriptionBilling"));
const SubscriptionInvoicePrint = lazy(() => import("@/features/subscriptionBilling/SubscriptionInvoicePrint"));
const LeadsList = lazy(() => import("@/features/leads/LeadsList"));
const LeadForm = lazy(() => import("@/features/leads/LeadForm"));
const TrialsList = lazy(() => import("@/features/trials/TrialsList"));
const TrialForm = lazy(() => import("@/features/trials/TrialForm"));
const HospitalsList = lazy(() => import("@/features/hospitals/HospitalsList"));
const HospitalForm = lazy(() => import("@/features/hospitals/HospitalForm"));
const HospitalOverview = lazy(() => import("@/features/superAdmins/HospitalOverview"));
const HospitalModules = lazy(() => import("@/features/hospitals/HospitalModules"));
const OnboardingList = lazy(() => import("@/features/onboarding/OnboardingList"));
const OnboardingForm = lazy(() => import("@/features/onboarding/OnboardingForm"));
const SuperAdminsList = lazy(() => import("@/features/superAdmins/SuperAdminsList"));
const SuperAdminForm = lazy(() => import("@/features/superAdmins/SuperAdminForm"));
const RolesList = lazy(() => import("@/features/rbac/RolesList"));
const RoleForm = lazy(() => import("@/features/rbac/RoleForm"));
const UsersList = lazy(() => import("@/features/rbac/UsersList"));
const UserForm = lazy(() => import("@/features/rbac/UserForm"));
const AuditLogsList = lazy(() => import("@/features/auditLogs/AuditLogsList"));
const AdminReports = lazy(() => import("@/features/reports/AdminReports"));

// Hospital Admin
const HospitalChangePassword = lazy(() => import("@/features/hospitalAuth/HospitalChangePassword"));
const HospitalDashboard = lazy(() => import("@/features/hospitalAuth/HospitalDashboard"));
const HospitalProfile = lazy(() => import("@/features/hospitalAuth/HospitalProfile"));
const HospitalSettings = lazy(() => import("@/features/hospitalAuth/HospitalSettings"));
const DepartmentsList = lazy(() => import("@/features/hospitalAuth/departments/DepartmentsList"));
const DepartmentForm = lazy(() => import("@/features/hospitalAuth/departments/DepartmentForm"));
const HospitalUsersList = lazy(() => import("@/features/hospitalAuth/users/UsersList"));
const HospitalUserForm = lazy(() => import("@/features/hospitalAuth/users/UserForm"));
const HospitalRolesList = lazy(() => import("@/features/hospitalAuth/roles/RolesList"));
const HospitalRoleForm = lazy(() => import("@/features/hospitalAuth/roles/RoleForm"));
const PermissionMatrix = lazy(() => import("@/features/hospitalAuth/roles/PermissionMatrix"));
const ModuleAccess = lazy(() => import("@/features/hospitalAuth/settings/ModuleAccess"));
const DoctorsList = lazy(() => import("@/features/hospitalAuth/doctors/DoctorsList"));
const DoctorForm = lazy(() => import("@/features/hospitalAuth/doctors/DoctorForm"));
const DoctorSchedule = lazy(() => import("@/features/hospitalAuth/doctors/DoctorSchedule"));
const DoctorLeaves = lazy(() => import("@/features/hospitalAuth/doctors/DoctorLeaves"));
const LookupManager = lazy(() => import("@/features/hospitalAuth/settings/LookupManager"));
const FacilitySetup = lazy(() => import("@/features/hospitalAuth/settings/FacilitySetup"));
const VaccineCatalog = lazy(() => import("@/features/hospitalAuth/settings/VaccineCatalog"));
const FormTemplatesList = lazy(() => import("@/features/hospitalAuth/formBuilder/FormTemplatesList"));
const FormBuilder = lazy(() => import("@/features/hospitalAuth/formBuilder/FormBuilder"));
const AuditLogs = lazy(() => import("@/features/hospitalAuth/settings/AuditLogs"));
const FinancialDashboard = lazy(() => import("@/features/billing/FinancialDashboard"));

// Reception
const ReceptionDashboard = lazy(() => import("@/features/reception/ReceptionDashboard"));
const PatientsList = lazy(() => import("@/features/reception/PatientsList"));
const PatientForm = lazy(() => import("@/features/reception/PatientForm"));
const PatientProfile = lazy(() => import("@/features/reception/PatientProfile"));
const AppointmentsList = lazy(() => import("@/features/reception/AppointmentsList"));
const AppointmentCalendar = lazy(() => import("@/features/reception/AppointmentCalendar"));
const AppointmentForm = lazy(() => import("@/features/reception/AppointmentForm"));
const DoctorAvailability = lazy(() => import("@/features/reception/DoctorAvailability"));
const DepartmentDirectory = lazy(() => import("@/features/reception/DepartmentDirectory"));
const ReferralsList = lazy(() => import("@/features/reception/ReferralsList"));
const Reports = lazy(() => import("@/features/reception/ReportsHub"));
const Admissions = lazy(() => import("@/features/ipd/Admissions"));
const BedBoard = lazy(() => import("@/features/ipd/BedBoard"));
const QueueDashboard = lazy(() => import("@/features/reception/QueueDashboard"));
const Billing = lazy(() => import("@/features/reception/Billing"));
const NotificationsLog = lazy(() => import("@/features/reception/NotificationsLog"));
const ClaimsList = lazy(() => import("@/features/claims/ClaimsList"));
const ClaimForm = lazy(() => import("@/features/claims/ClaimForm"));
const ClaimDetail = lazy(() => import("@/features/claims/ClaimDetail"));
const ClaimReports = lazy(() => import("@/features/claims/ClaimReports"));
const FrontDeskConsole = lazy(() => import("@/features/reception/FrontDeskConsole"));

// Nurse
const NurseDashboard = lazy(() => import("@/features/nurse/NurseDashboard"));
const NurseQueue = lazy(() => import("@/features/nurse/NurseQueue"));
const NurseReports = lazy(() => import("@/features/nurse/NurseReports"));
const NurseWard = lazy(() => import("@/features/nurse/NurseWard"));

// Doctor
const DoctorDashboard = lazy(() => import("@/features/doctor/DoctorDashboard"));
const DoctorQueue = lazy(() => import("@/features/doctor/DoctorQueue"));
const ConsultationWorkspace = lazy(() => import("@/features/doctor/ConsultationWorkspace"));
const DoctorPatients = lazy(() => import("@/features/doctor/DoctorPatients"));
const DoctorPatientProfile = lazy(() => import("@/features/doctor/DoctorPatientProfile"));
const DoctorResults = lazy(() => import("@/features/doctor/DoctorResults"));
const DoctorReports = lazy(() => import("@/features/doctor/DoctorReports"));

// Lab
const LabDashboard = lazy(() => import("@/features/lab/LabDashboard"));
const LabOrdersQueue = lazy(() => import("@/features/lab/LabOrdersQueue"));
const UpdateLabOrder = lazy(() => import("@/features/lab/UpdateLabOrder"));
const RadiologyOrdersQueue = lazy(() => import("@/features/lab/RadiologyOrdersQueue"));
const LabTestCatalog = lazy(() => import("@/features/lab/LabTestCatalog"));
const PrintLabReport = lazy(() => import("@/features/lab/PrintLabReport"));
const PrintIpBill = lazy(() => import("@/features/billing/PrintIpBill"));
const RadiologyCatalog = lazy(() => import("@/features/lab/RadiologyCatalog"));
const LabReports = lazy(() => import("@/features/lab/LabReports"));
const LabBilling = lazy(() => import("@/features/lab/LabBilling"));

// Pharmacy
const PharmacyDashboard = lazy(() => import("@/features/pharmacy/PharmacyDashboard"));
const MedicineCatalog = lazy(() => import("@/features/pharmacy/MedicineCatalog"));
const SupplierDirectory = lazy(() => import("@/features/pharmacy/SupplierDirectory"));
const InventoryManagement = lazy(() => import("@/features/pharmacy/InventoryManagement"));
const DispensaryPOS = lazy(() => import("@/features/pharmacy/DispensaryPOS"));
const PharmacyReports = lazy(() => import("@/features/pharmacy/PharmacyReports"));
const WardStock = lazy(() => import("@/features/pharmacy/WardStock"));
const IpdMedicationRequests = lazy(() => import("@/features/pharmacy/IpdMedicationRequests"));

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

// Like el(), but passes props — used to reuse a page under a different shell
// (e.g. the admin oversight routes render reception pages with basePath="/hospital").
const elp = (C: ComponentType<any>, props: Record<string, unknown>) => (
  <Suspense fallback={<PageSkeleton />}>
    <C {...props} />
  </Suspense>
);

// Like el(), but shows the "upgrade to unlock" upsell when the hospital's plan
// doesn't include `module` — so plan-gated pages advertise the feature instead
// of 404ing or 403ing.
const elGated = (C: ComponentType<any>, module: string, feature?: string) => (
  <ModuleGate module={module} feature={feature}>
    <Suspense fallback={<PageSkeleton />}>
      <C />
    </Suspense>
  </ModuleGate>
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
            <Route path="/subscription-billing" element={el(SubscriptionBilling)} />
            {/* Feature Flags routes removed — page hidden (see AdminLayout note). */}
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

            <Route path="/reports" element={el(AdminReports)} />
            <Route path="/audit-logs" element={el(AuditLogsList)} />
          </Route>
          {/* Full-page printable subscription invoice (no admin shell). */}
          <Route path="/subscription-billing/invoices/:id/print" element={el(SubscriptionInvoicePrint)} />
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
            <Route path="/hospital/reports" element={el(Reports)} />
            <Route path="/hospital/permissions-matrix" element={el(PermissionMatrix)} />
            <Route path="/hospital/module-access" element={el(ModuleAccess)} />
            <Route path="/hospital/doctors" element={el(DoctorsList)} />

            <Route path="/hospital/doctors/new" element={el(DoctorForm)} />
            <Route path="/hospital/doctors/:id/edit" element={el(DoctorForm)} />
            <Route path="/hospital/doctors/:id/schedule" element={el(DoctorSchedule)} />
            <Route path="/hospital/doctors/:id/leaves" element={el(DoctorLeaves)} />
            <Route path="/hospital/lookups" element={el(LookupManager)} />
            <Route path="/hospital/facility-setup" element={elGated(FacilitySetup, "IPD", "Ward & Bed Setup")} />
            <Route path="/hospital/vaccines" element={el(VaccineCatalog)} />
            <Route path="/hospital/medicines" element={el(MedicineCatalog)} />
            <Route path="/hospital/form-builder" element={el(FormTemplatesList)} />
            <Route path="/hospital/form-builder/new" element={el(FormBuilder)} />
            <Route path="/hospital/form-builder/:id/edit" element={el(FormBuilder)} />
            <Route path="/hospital/audit-logs" element={el(AuditLogs)} />

            {/* ── Admin oversight (read-only windows into hospital-wide activity) ──
                Reuse the existing operational pages inside the admin shell. The
                backend already serves H_ADMIN org-wide data for all of these. */}
            <Route path="/hospital/patients" element={elp(PatientsList, { basePath: "/hospital" })} />
            <Route path="/hospital/patients/:id" element={elp(PatientProfile, { readOnly: true })} />
            <Route path="/hospital/appointments" element={el(AppointmentsList)} />
            <Route path="/hospital/queue" element={el(QueueDashboard)} />
            <Route path="/hospital/ipd/admissions" element={elGated(Admissions, "IPD", "Admissions")} />
            <Route path="/hospital/ipd/beds" element={elGated(BedBoard, "IPD", "Bed Board")} />
            <Route path="/hospital/billing" element={elGated(Billing, "Billing", "Billing Overview")} />
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
            <Route path="/reception/claims" element={el(ClaimsList)} />
            <Route path="/reception/claims/reports" element={el(ClaimReports)} />
            <Route path="/reception/claims/new" element={el(ClaimForm)} />
            <Route path="/reception/claims/:id" element={el(ClaimDetail)} />
            <Route path="/reception/claims/:id/edit" element={el(ClaimForm)} />
            <Route path="/reception/notifications" element={el(NotificationsLog)} />
          </Route>
          {/* Full-page printable IP bill (rendered outside the layout shell). */}
          <Route path="/reception/billing/invoices/:invoiceId/ip-bill/print" element={el(PrintIpBill)} />
        </Route>
        {/* ── Nurse Panel Routes ────────────────────────────────────── */}
        <Route element={<HospitalProtectedRoute />}>
          <Route element={el(NurseLayout)}>
            <Route path="/nurse/dashboard" element={el(NurseDashboard)} />
            <Route path="/nurse/queue" element={el(NurseQueue)} />
            <Route path="/nurse/ward" element={el(NurseWard)} />
            <Route path="/nurse/reports" element={el(NurseReports)} />
            {/* Read-only view under the Nurse shell — a nurse opening a patient (e.g. via
                command-palette search) must not land inside the full Reception sidebar,
                which would expose front desk/billing/admissions navigation they don't own. */}
            <Route path="/nurse/patients/:id" element={elp(PatientProfile, { readOnly: true })} />
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
            <Route path="/doctor/all-patients" element={elp(DoctorPatients, { scope: "all" })} />
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
            <Route path="/lab/billing" element={el(LabBilling)} />
            <Route path="/lab/reports" element={el(LabReports)} />
          </Route>
        </Route>

        {/* ── Pharmacy Panel Routes ─────────────────────────────────── */}
        <Route element={<HospitalProtectedRoute />}>
          <Route element={el(PharmacyLayout)}>
            <Route path="/pharmacy/dashboard" element={el(PharmacyDashboard)} />
            <Route path="/pharmacy/medicines" element={el(MedicineCatalog)} />
            <Route path="/pharmacy/suppliers" element={el(SupplierDirectory)} />
            <Route path="/pharmacy/inventory" element={el(InventoryManagement)} />
            <Route path="/pharmacy/ward-stock" element={el(WardStock)} />
            <Route path="/pharmacy/ipd-requests" element={el(IpdMedicationRequests)} />
            <Route path="/pharmacy/pos" element={el(DispensaryPOS)} />
            <Route path="/pharmacy/reports" element={el(PharmacyReports)} />
          </Route>
        </Route>
      </Routes>
    </HospitalAuthProvider>
    </>
  );
}

export default App;
