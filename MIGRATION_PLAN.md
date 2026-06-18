# Data-Fetching Migration Plan (react-query + ErrorState)

Goal: replace hand-rolled `useState/useEffect/axios` with `useQuery`/`useMutation`
+ `ErrorState`, page by page. **No big-bang rewrite** — one page per step, each
verified before moving on.

Baseline: 80 page files. 8 already use react-query. **69 to migrate.**
Reference implementation: `src/pages/Dashboard.tsx`. Shared error UI:
`src/components/ErrorState.tsx`.

---

## The per-page recipe (apply identically every time)

**Query (data loaded on mount / when deps change):**
```tsx
const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: ["resource", page, search],          // include every input that changes the result
  queryFn: async () => (await axiosInstance.get("/path", { params })).data.data,
});
if (isLoading) return <Spinner/>;                 // reuse the page's existing loader/skeleton
if (isError || !data) return <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />;
```

**Mutation (save/delete/submit):**
```tsx
const qc = useQueryClient();
const m = useMutation({
  mutationFn: (payload) => axiosInstance.post("/path", payload),
  onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["resource"] }); },
  onError: (err: any) => toast.error(err?.response?.data?.message || "Action failed"),
});
```
(Minimum bar if not converting to useMutation: the catch must surface
`err.response?.data?.message`. Most of these are already fixed.)

**Acceptance criteria per page**
- [ ] Loading shows a spinner/skeleton (not a frozen/blank state)
- [ ] Fetch failure shows `ErrorState` with the backend message + working Retry
- [ ] Success render is unchanged (same UI)
- [ ] Mutations surface the backend error message
- [ ] After a mutation, the affected list/detail refetches (invalidateQueries)
- [ ] `npx tsc -b` passes

---

## Order of work (tiers)

### Tier 1 — Blank-screen risk + operational ✅ DONE
- [x] plans/PlansList.tsx — useQuery + useMutation(delete) + ErrorState
- [x] leads/LeadsList.tsx — list query + plans query + mutations surface messages
- [x] trials/TrialsList.tsx — list query + expire/extend surface messages
- [x] onboarding/OnboardingList.tsx — list query + optimistic inline-update via cache
- [x] featureFlags/FeatureFlagsList.tsx — list query + delete
- [x] rbac/UsersList.tsx — list query (debounced search) + delete
- [x] pharmacy/MedicineCatalog.tsx — suppliers + medicines queries + ErrorState
- [x] pharmacy/SupplierDirectory.tsx — suppliers query + ErrorState
- [x] billing/GenerateInvoice.tsx — patient-search + unbilled queries + ErrorState
- [x] reception/BillingModal.tsx — kept imperative load (get-or-generate side effect) + ErrorState branch
- [x] doctor/ConsultationWorkspace.tsx — already had loading/error/message handling; standardized on ErrorState (left fetch/autosave logic intact)

### Tier 2 — Dashboards (high traffic) ✅ DONE
- [x] doctor/DoctorDashboard.tsx — useQuery (refetchInterval 60s) + ErrorState
- [x] hospitalAuth/HospitalDashboard.tsx — useQuery + ErrorState
- [x] reception/ReceptionDashboard.tsx — useQuery + ErrorState
- [x] nurse/NurseDashboard.tsx — compound queue+vitals query (refetchInterval 30s), refresh btn → refetch, ErrorState
- [x] pharmacy/PharmacyDashboard.tsx — 5-call parallel query + ErrorState
- [x] lab/LabDashboard.tsx — 2-call query with derivation in queryFn + ErrorState
- [x] billing/FinancialDashboard.tsx — useQuery; replaced error Alert with ErrorState + retry
- [x] reception/FrontDeskConsole.tsx — recent-patients → useQuery; interactive debounced search left intact (already handled errors)

### Tier 3 — Remaining lists + detail/profile pages ✅ DONE
(All 25 migrated to useQuery + ErrorState; form-load pages seed via effect; the most
complex multi-resource pages — PermissionMatrix, BillingModal-style, InventoryManagement —
kept imperative loads with an added load-error ErrorState to protect unsaved edits.)

- [ ] reception/AppointmentsList.tsx · reception/NotificationsLog.tsx · reception/PatientProfile.tsx
- [ ] hospitalAuth/departments/DepartmentsList.tsx · hospitalAuth/doctors/DoctorsList.tsx
- [ ] hospitalAuth/roles/RolesList.tsx · hospitalAuth/users/UsersList.tsx
- [ ] hospitalAuth/HospitalProfile.tsx · hospitalAuth/HospitalSettings.tsx · hospitalAuth/settings/ModuleAccess.tsx
- [ ] hospitalAuth/settings/LookupManager.tsx · hospitalAuth/settings/AuditLogs.tsx · hospitalAuth/roles/PermissionMatrix.tsx
- [ ] hospitalAuth/doctors/DoctorSchedule.tsx · hospitalAuth/doctors/DoctorLeaves.tsx
- [ ] hospitalAuth/formBuilder/FormTemplatesList.tsx
- [ ] hospitals/HospitalsList.tsx · superAdmins/HospitalOverview.tsx · superAdmins/SuperAdminsList.tsx
- [ ] auditLogs/AuditLogsList.tsx · rbac/RolesList.tsx
- [ ] lab/LabTestCatalog.tsx · lab/RadiologyCatalog.tsx · lab/UpdateLabOrder.tsx
- [ ] pharmacy/InventoryManagement.tsx

### Tier 4 — Forms (load-for-edit query + submit mutation) ✅ DONE
- [x] plans/PlanForm.tsx · featureFlags/FeatureFlagForm.tsx · leads/LeadForm.tsx · trials/TrialForm.tsx
- [x] hospitals/HospitalForm.tsx · onboarding/OnboardingForm.tsx · superAdmins/SuperAdminForm.tsx
- [x] hospitalAuth/departments/DepartmentForm.tsx · hospitalAuth/doctors/DoctorForm.tsx
- [x] hospitalAuth/roles/RoleForm.tsx · hospitalAuth/users/UserForm.tsx
- [x] rbac/RoleForm.tsx · rbac/UserForm.tsx
- [x] reception/PatientForm.tsx · reception/AppointmentForm.tsx
- [x] hospitalAuth/formBuilder/FormBuilder.tsx

### Tier 5 — Clinical sub-forms / modals ✅ DONE
- [x] doctor/LabOrderForm.tsx · doctor/RadiologyOrderForm.tsx · doctor/PrescriptionWriter.tsx
- [x] reception/VitalsModal.tsx · reception/PatientDocumentsSection.tsx

### Excluded / special-case (revisit last, likely leave as-is)
- Login.tsx, hospitalAuth/HospitalLogin.tsx, hospitalAuth/HospitalChangePassword.tsx
  — auth submits, not queries; already surface form errors. No data-load to convert.
- lab/PrintLabReport.tsx — print view.
- pharmacy/components/PharmacyPage.tsx — shared layout wrapper, not a fetch page.

---

## How we run it
One page per turn: migrate → `tsc -b` → tick the box here → next.
Each is independently shippable, so we can stop/commit at any point.
