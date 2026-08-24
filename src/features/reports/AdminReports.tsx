import { SEMANTIC, NEUTRAL, BRAND } from "@/styles/accents";
import SimpleTable from "@/features/reports/kit/SimpleTable";
import KpiCard from "@/features/reports/kit/KpiCard";
import { useReportParam, useReportFlag } from "@/features/reports/kit/useReportParam";
import ReportStatusChips from "@/features/reports/kit/ReportStatusChips";
import { apiGet, apiGetList } from "@/api/client";
import type {
  AdminDashboardStats, DashboardPlanRow, DashboardStatusRow, DashboardOnboardingRow,
  HospitalRegisterRow, LeadRegisterRow, TrialRegisterRow, PlanRegisterRow, PlanWithMrr,
  OnboardingRegisterRow, OnboardingGateKey,
} from "./adminReports.types";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Box, Paper, Typography, Button, Grid, Chip, Tooltip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from "@mui/material";
import {
  FileDownloadRounded, LocalHospitalRounded, PeopleAltRounded, StoreMallDirectoryRounded,
  PersonSearchRounded, GroupsRounded, MedicalInformationRounded, ShowChartRounded,
  TimerRounded, CardMembershipRounded, RocketLaunchRounded, AccountBalanceWalletRounded,
  CheckCircleRounded, HighlightOffRounded, WarningAmberRounded, InfoOutlined, ArrowForwardRounded,
} from "@mui/icons-material";
import { exportTableToExcel } from "@/utils/exportExcel";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import ErrorState from "@/components/ErrorState";
import { apiErrorText } from "@/utils/apiError";
import { formatINRAuto, formatDate } from "@/utils/format";
import { ReportNavLayout, type ReportGroup } from "@/features/reports/kit";

const ACCENT = BRAND.action; // indigo #6366f1

const inr = formatINRAuto;
const cap = (s: unknown) => {
  const str = String(s ?? "").replace(/_/g, " ");
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "—";
};

// Page every list endpoint (hard cap 1000/page server-side) so exported
// registers are complete rather than silently truncated to the first page.
async function fetchAllRows<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const all: T[] = [];
  const limit = 1000;
  for (let page = 1; page <= 50; page++) {
    const { rows, meta } = await apiGetList<T>(endpoint, { params: { ...params, page, limit } });
    all.push(...rows);
    const total = meta?.total ?? all.length;
    if (rows.length === 0 || all.length >= total) break;
  }
  return all;
}

// ── Shared presentational helpers (mirrors reception/Reports.tsx) ────────────

// Boolean checkmark cell for onboarding checkpoints.
const YesNo = ({ v }: { v: boolean }) =>
  v ? <CheckCircleRounded sx={{ fontSize: 18, color: SEMANTIC.success }} /> : <HighlightOffRounded sx={{ fontSize: 18, color: "text.disabled" }} />;

// ── Overview (from /dashboard/stats) ─────────────────────────────────────────

function OverviewReport() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-report-overview"],
    queryFn: () => apiGet<AdminDashboardStats>("/dashboard/stats"),
  });

  if (isLoading) return <ReportSkeleton />;
  if (isError || !data) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  const byPlan: DashboardPlanRow[] = data.hospitalsByPlan || [];
  const byStatus: DashboardStatusRow[] = data.leadsByStatus || [];
  const onboarding: DashboardOnboardingRow[] = data.onboardingProgress || [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* KPIs. A tile links to the register listing what it counted; the four
          without one (patients, doctors, branches, plans-as-a-count) have no
          platform-level register to open, so they stay plain rather than
          promising a page that doesn't exist. */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<LocalHospitalRounded />} label="Hospitals" value={data.totalHospitals ?? 0} sub={`${data.activeHospitals ?? 0} active`} href="/reports?view=hospitals" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<TimerRounded />} label="Active Trials" value={data.activeTrials ?? 0} sub={`${data.expiredHospitals ?? 0} expired`} accent={SEMANTIC.warning} href="/reports?view=trials&status=active" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<PersonSearchRounded />} label="Leads" value={data.totalLeads ?? 0} sub={`${data.convertedLeads ?? 0} converted`} accent="#8b5cf6" href="/reports?view=leads" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<AccountBalanceWalletRounded />} label="Est. MRR" value={inr(data.totalRevenue)} sub="monthly recurring" accent={SEMANTIC.success} href="/reports?view=subscriptions" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CardMembershipRounded />} label="Plans" value={data.activePlans ?? 0} accent="#0891b2" href="/reports?view=subscriptions" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<GroupsRounded />} label="Patients" value={data.totalPatients ?? 0} accent="#ec4899" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<MedicalInformationRounded />} label="Doctors" value={data.totalDoctors ?? 0} accent={BRAND.action} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<StoreMallDirectoryRounded />} label="Branches" value={data.totalBranches ?? 0} accent={NEUTRAL.muted} href="/reports?view=hospitals" /></Grid>
      </Grid>

      {/* Downloadable summary tables */}
      <Grid container spacing={2.5}>
        {/* Each row leads to the register that lists what it counted, filtered
            to that row — a count on its own leaves the reader to go and work
            out which records it meant. */}
        <Grid size={{ xs: 12, md: 4 }}>
          <SimpleTable
            title="Branches by plan" head={["Plan", "Branches"]}
            rows={byPlan.map((p) => [p.planName ?? "—", Number(p.count)])}
            rowHref={(_r, i) => `/reports?view=hospitals&plan=${encodeURIComponent(byPlan[i].planName ?? "")}`}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SimpleTable
            title="Leads by stage" head={["Stage", "Leads"]}
            rows={byStatus.map((s) => [cap(s.status), Number(s.count)])}
            rowHref={(_r, i) => `/reports?view=leads&status=${encodeURIComponent(byStatus[i].status ?? "")}`}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SimpleTable
            title="Onboarding progress" head={["Status", "Hospitals"]}
            rows={onboarding.map((o) => [cap(o.status), Number(o.count)])}
            rowHref={(_r, i) => `/reports?view=onboarding&status=${encodeURIComponent(onboarding[i].status ?? "")}`}
          />
        </Grid>
      </Grid>
    </Box>
  );
}

// ── Hospitals register (from /hospitals) ─────────────────────────────────────

function HospitalsReport() {
  const [statusFilter] = useReportParam("status", "all");
  const [planFilter, setPlanFilter] = useReportParam("plan", "all");
  const { data = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-report-hospitals"],
    queryFn: () => fetchAllRows<HospitalRegisterRow>("/hospitals"),
  });

  if (isLoading) return <ReportSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  const planNames = (h: HospitalRegisterRow) => {
    const names = [...new Set((h.branches || []).map((b) => b.subscriptionPlan?.planName).filter(Boolean))];
    return names.length ? names.join(", ") : "—";
  };
  const active = data.filter((h) => h.status === "active").length;
  const suspended = data.filter((h) => h.status === "suspended").length;

  // Filtered by status and by plan, both from the URL, so the overview's
  // "Branches by plan" row can land on exactly the tenants it counted.
  const filtered = data.filter((h) => {
    if (statusFilter !== "all" && h.status !== statusFilter) return false;
    if (planFilter !== "all" && !(h.branches || []).some((b) => b.subscriptionPlan?.planName === planFilter)) return false;
    return true;
  });
  const rows = filtered.map((h) => [
    `${h.hospitalName || "—"}`,
    h.hospitalCode || "—",
    cap(h.status),
    planNames(h),
    Number(h._count?.branches ?? 0),
    formatDate(h.createdAt),
  ]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<LocalHospitalRounded />} label="Total" value={data.length} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CheckCircleRounded />} label="Active" value={active} accent={SEMANTIC.success} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<HighlightOffRounded />} label="Suspended" value={suspended} accent={SEMANTIC.danger} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<LocalHospitalRounded />} label="Branches" value={data.reduce((s: number, h) => s + Number(h._count?.branches ?? 0), 0)} accent={NEUTRAL.muted} /></Grid>
      </Grid>
      <ReportStatusChips
        options={[
          { key: "all", label: "All", count: data.length },
          { key: "active", label: "Active", count: active },
          { key: "suspended", label: "Suspended", count: suspended },
        ]}
      />
      {planFilter !== "all" && (
        <Box>
          <Chip size="small" label={`Plan: ${planFilter}`} onDelete={() => setPlanFilter("all")} sx={{ fontWeight: 600 }} />
        </Box>
      )}
      <SimpleTable title="Hospitals register" head={["Hospital", "Code", "Status", "Plan(s)", "Branches", "Registered"]} rows={rows} />
    </Box>
  );
}

// ── Sales pipeline / Leads (from /leads) ─────────────────────────────────────

function LeadsReport() {
  const [stageFilter] = useReportParam("status", "all");
  const { data = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-report-leads"],
    queryFn: () => fetchAllRows<LeadRegisterRow>("/leads"),
  });

  if (isLoading) return <ReportSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  // Stage counts (drive the KPI tiles and the filter chips).
  const counts: Record<string, number> = {};
  data.forEach((l) => { counts[l.leadStatus] = (counts[l.leadStatus] || 0) + 1; });

  const filtered = stageFilter === "all" ? data : data.filter((l) => l.leadStatus === stageFilter);
  const rows = filtered.map((l) => [
    l.hospitalName || "—",
    l.contactPersonName || "—",
    l.email || "—",
    l.phone || "—",
    cap(l.leadStatus),
    l.assignedUser ? `${l.assignedUser.firstName || ""} ${l.assignedUser.lastName || ""}`.trim() || "—" : "—",
    formatDate(l.createdAt),
  ]);

  // Every stage present in the data, so a stage the overview links to always
  // has a chip — rather than a hardcoded list that silently drops new ones.
  const stages = [...new Set(data.map((l) => l.leadStatus))].sort();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<PeopleAltRounded />} label="Total leads" value={data.length} accent="#8b5cf6" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CheckCircleRounded />} label="Converted" value={counts["converted"] || 0} accent={SEMANTIC.success} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<RocketLaunchRounded />} label="Trialing" value={counts["trialing"] || 0} accent={SEMANTIC.warning} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<HighlightOffRounded />} label="Lost" value={counts["lost"] || 0} accent={SEMANTIC.danger} /></Grid>
      </Grid>
      <ReportStatusChips
        options={[
          { key: "all", label: "All", count: data.length },
          ...stages.map((s) => ({ key: s, label: cap(s), count: counts[s] })),
        ]}
        accent="#8b5cf6"
      />
      <SimpleTable title="Leads register" head={["Hospital", "Contact", "Email", "Phone", "Stage", "Assigned to", "Created"]} rows={rows} accent="#8b5cf6" />
    </Box>
  );
}

// ── Trials (from /trials) ────────────────────────────────────────────────────

function TrialsReport() {
  const [statusFilter] = useReportParam("status", "all");
  const { data = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-report-trials"],
    queryFn: () => fetchAllRows<TrialRegisterRow>("/trials"),
  });

  if (isLoading) return <ReportSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  const byState = (s: string) => data.filter((t) => t.trialStatus === s).length;
  const filtered = statusFilter === "all" ? data : data.filter((t) => t.trialStatus === statusFilter);

  // Days left is the reason to look at an active trial at all — it says which
  // ones are about to lapse. The register showed only the end date, leaving
  // that arithmetic to the reader.
  const daysLeft = (t: TrialRegisterRow) => {
    if (!t.trialEndDate) return null;
    const ms = new Date(t.trialEndDate).getTime() - Date.now();
    return Math.ceil(ms / 86_400_000);
  };
  const remaining = (t: TrialRegisterRow) => {
    const d = daysLeft(t);
    if (d == null) return "—";
    if (t.trialStatus !== "active") return "—";
    return d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "today" : `${d}d`;
  };

  const rows = filtered.map((t) => [
    t.lead?.hospitalName || "—",
    formatDate(t.trialStartDate),
    formatDate(t.trialEndDate),
    remaining(t),
    cap(t.trialStatus),
    t.autoExpire ? "Yes" : "No",
  ]);

  const states = [...new Set(data.map((t) => t.trialStatus))].filter(Boolean).sort() as string[];
  const expiringSoon = data.filter((t) => {
    const d = daysLeft(t);
    return t.trialStatus === "active" && d != null && d >= 0 && d <= 7;
  }).length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<TimerRounded />} label="Total trials" value={data.length} accent={SEMANTIC.warning} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<RocketLaunchRounded />} label="Active" value={byState("active")} accent={BRAND.action} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<WarningAmberRounded />} label="Expiring in 7 days" value={expiringSoon} accent={expiringSoon ? SEMANTIC.danger : NEUTRAL.muted} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CheckCircleRounded />} label="Converted" value={byState("converted")} accent={SEMANTIC.success} /></Grid>
      </Grid>
      <ReportStatusChips
        options={[
          { key: "all", label: "All", count: data.length },
          ...states.map((s) => ({ key: s, label: cap(s), count: byState(s) })),
        ]}
      />
      <SimpleTable title="Trials register" head={["Hospital", "Start", "End", "Remaining", "Status", "Auto-expire"]} rows={rows} />
    </Box>
  );
}

// ── Subscriptions / Revenue by plan (from /plans) ────────────────────────────

function SubscriptionsReport() {
  const { data = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-report-plans"],
    queryFn: () => fetchAllRows<PlanRegisterRow>("/plans"),
  });

  if (isLoading) return <ReportSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  // Est. MRR per plan = monthlyPrice × branches subscribed to it (same basis as the dashboard).
  const withMrr = data.map((p): PlanWithMrr => {
    const branches = Number(p._count?.branches ?? 0);
    const mrr = Number(p.monthlyPrice || 0) * branches;
    return { ...p, branches, mrr };
  });
  const totalMrr = withMrr.reduce((s, p) => s + p.mrr, 0);
  const totalBranches = withMrr.reduce((s, p) => s + p.branches, 0);

  const rows = withMrr.map((p) => [
    p.planName,
    inr(p.monthlyPrice),
    inr(p.annualPrice),
    Number(p.maxDoctors ?? 0),
    Number(p.maxBranches ?? 0),
    Number(p.maxStorageGb ?? 0),
    p.branches,
    inr(p.mrr),
  ]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CardMembershipRounded />} label="Plans" value={data.length} accent="#0891b2" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<LocalHospitalRounded />} label="Subscribed branches" value={totalBranches} accent={NEUTRAL.muted} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<AccountBalanceWalletRounded />} label="Est. MRR" value={inr(totalMrr)} sub="monthly recurring" accent={SEMANTIC.success} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<ShowChartRounded />} label="Est. ARR" value={inr(totalMrr * 12)} sub="annualised" accent="#8b5cf6" /></Grid>
      </Grid>
      <SimpleTable
        title="Subscription plans"
        head={["Plan", "Monthly", "Annual", "Max doctors", "Max branches", "Max storage (GB)", "Branches", "Est. MRR"]}
        rows={rows}
      />
    </Box>
  );
}

// ── Onboarding (from /onboarding) ────────────────────────────────────────────
// "Payment verified" is a manual attestation with no audit trail — it has never
// been checked against the platform's own subscription billing records. The
// backend now cross-references it (see onboarding.service.ts) so this register
// can surface the mismatches: hospitals marked verified with nothing on file,
// and hospitals that HAVE paid but aren't marked verified yet.

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
  { key: "stalled", label: "Stalled" },
];

const GATE_LABELS: [OnboardingGateKey, string][] = [
  ["tenantSetupCompleted", "Tenant setup"],
  ["defaultRolesSeeded", "Roles seeded"],
  ["paymentVerified", "Payment verified"],
];

function OnboardingReport() {
  const navigate = useNavigate();
  // Both live in the URL so the dashboard can link straight to "the 4 pending".
  const [statusFilter] = useReportParam("status", "all");
  const [attentionOnly, setAttentionOnly] = useReportFlag("attention");

  const { data = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-report-onboarding"],
    queryFn: () => fetchAllRows<OnboardingRegisterRow>("/onboarding"),
  });

  if (isLoading) return <ReportSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  const completed = data.filter((o) => o.onboardingStatus === "completed").length;
  const inProgress = data.filter((o) => o.onboardingStatus === "pending" || o.onboardingStatus === "in_progress").length;
  const stalled = data.filter((o) => o.onboardingStatus === "stalled").length;
  const verifiedCount = data.filter((o) => o.paymentVerified).length;
  const mismatchCount = data.filter((o) => o.paymentMismatch).length;
  const unverifiedPaidCount = data.filter((o) => o.paymentUnverifiedButPaid).length;
  const totalCollected = data.reduce((sum: number, o) => sum + Number(o.billing?.totalPaid || 0), 0);

  const filtered = data.filter((o) => {
    if (statusFilter !== "all" && o.onboardingStatus !== statusFilter) return false;
    if (attentionOnly && !o.paymentMismatch && !o.paymentUnverifiedButPaid) return false;
    return true;
  });

  const blockedOn = (o: OnboardingRegisterRow) =>
    o.onboardingStatus === "completed" ? "—" : GATE_LABELS.filter(([key]) => !o[key]).map(([, label]) => label).join(", ") || "—";

  const exportRows = filtered.map((o) => [
    o.hospital?.hospitalName || "—",
    o.hospital?.hospitalCode || "—",
    o.hospital?.city || "—",
    o.hospital?.planName || "—",
    o.primaryAdmin?.name || "—",
    o.primaryAdmin?.email || "—",
    formatDate(o.hospital?.createdAt),
    o.tenantSetupCompleted ? "Yes" : "No",
    o.defaultRolesSeeded ? "Yes" : "No",
    o.paymentVerified ? "Yes" : "No",
    Number(o.billing?.totalPaid || 0),
    o.billing?.lastPaymentAt ? formatDate(o.billing.lastPaymentAt) : "—",
    o.billing?.latestInvoiceStatus || "—",
    cap(o.onboardingStatus),
    blockedOn(o),
    o.paymentMismatch ? "Verified, nothing on file" : o.paymentUnverifiedButPaid ? "Paid, not verified" : "—",
  ]);
  const exportHead = [
    "Hospital", "Code", "City", "Plan", "Primary admin", "Admin email", "Registered",
    "Tenant setup", "Roles seeded", "Payment verified", "Collected (₹)", "Last payment", "Latest invoice",
    "Status", "Blocked on", "Billing flag",
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<RocketLaunchRounded />} label="Onboarding records" value={data.length} sub={`${inProgress} in progress`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CheckCircleRounded />} label="Completed" value={completed} accent={SEMANTIC.success} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<HighlightOffRounded />} label="Stalled" value={stalled} accent={SEMANTIC.danger} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<AccountBalanceWalletRounded />} label="Collected to date" value={inr(totalCollected)} accent={SEMANTIC.success} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<CheckCircleRounded />} label="Payment verified" value={verifiedCount} accent="#0891b2" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Tooltip title="Marked Payment Verified, but no payment is on file in Subscription Billing">
            <Box><KpiCard icon={<WarningAmberRounded />} label="Verified w/o payment" value={mismatchCount} accent={mismatchCount ? SEMANTIC.danger : NEUTRAL.muted} /></Box>
          </Tooltip>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Tooltip title="Has a real payment on file, but Payment Verified isn't checked yet">
            <Box><KpiCard icon={<InfoOutlined />} label="Paid, not verified" value={unverifiedPaidCount} accent={unverifiedPaidCount ? SEMANTIC.warning : NEUTRAL.muted} /></Box>
          </Tooltip>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={<PeopleAltRounded />} label="Showing" value={filtered.length} sub={`of ${data.length}`} accent={NEUTRAL.muted} /></Grid>
      </Grid>

      {/* Filters. Counts sit on the chips so the split is visible before choosing. */}
      <ReportStatusChips
        options={STATUS_FILTERS.map((f) => ({
          ...f,
          count: f.key === "all" ? data.length : data.filter((o) => o.onboardingStatus === f.key).length,
        }))}
        accent={ACCENT}
      >
        <Chip
          icon={<WarningAmberRounded sx={{ fontSize: "16px !important" }} />}
          label={`Needs attention${mismatchCount + unverifiedPaidCount ? ` (${mismatchCount + unverifiedPaidCount})` : ""}`}
          size="small"
          onClick={() => setAttentionOnly(!attentionOnly)}
          variant={attentionOnly ? "filled" : "outlined"}
          color="warning"
          sx={{ fontWeight: 700 }}
        />
      </ReportStatusChips>

      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Onboarding register</Typography>
          <Box sx={{ flex: 1 }} />
          {exportRows.length > 0 && (
            <Button size="small" startIcon={<FileDownloadRounded fontSize="small" />}
              onClick={() => exportTableToExcel("Onboarding register", exportHead, exportRows)}
              sx={{ textTransform: "none", color: ACCENT }}>Excel</Button>
          )}
        </Box>
        {filtered.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 2, textAlign: "center" }}>No data</Typography>
        ) : (
          <TableContainer sx={{ maxHeight: 620, overflowX: "auto" }}>
            <Table size="small" stickyHeader sx={{ minWidth: 1180 }}>
              <TableHead>
                <TableRow>
                  {["Hospital", "City", "Plan", "Primary admin", "Registered", "Setup", "Payment", "Collected", "Latest invoice", "Status", ""].map((h) => (
                    <TableCell key={h} sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", borderColor: "divider", bgcolor: "background.paper", whiteSpace: "nowrap" }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((o) => {
                  const flagBg = o.paymentMismatch ? "rgba(239,68,68,0.05)" : o.paymentUnverifiedButPaid ? "rgba(2,132,199,0.05)" : "transparent";
                  return (
                    <TableRow key={o.hospitalOnboardingId} hover sx={{ bgcolor: flagBg }}>
                      <TableCell sx={{ borderColor: "divider" }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>{o.hospital?.hospitalName || "—"}</Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace", display: "block" }}>{o.hospital?.hospitalCode || "—"}</Typography>
                        {/* What this tenant is still waiting on, beside its name.
                            It used to sit in the last of twelve columns, off the
                            right edge — so the register answered "which are
                            pending" on screen but "pending on what" only after a
                            horizontal scroll. */}
                        {o.onboardingStatus !== "completed" && (
                          <Typography variant="caption" sx={{ color: SEMANTIC.warningDark, fontWeight: 600, display: "block", mt: 0.25 }}>
                            Waiting on: {blockedOn(o)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ borderColor: "divider", color: "text.secondary" }}>{o.hospital?.city || "—"}</TableCell>
                      <TableCell sx={{ borderColor: "divider", color: "text.secondary" }}>{o.hospital?.planName || "—"}</TableCell>
                      <TableCell sx={{ borderColor: "divider" }}>
                        <Typography variant="body2" sx={{ color: "text.primary" }}>{o.primaryAdmin?.name || "—"}</Typography>
                        {o.primaryAdmin?.email && <Typography variant="caption" sx={{ color: "text.secondary" }}>{o.primaryAdmin.email}</Typography>}
                      </TableCell>
                      <TableCell sx={{ borderColor: "divider", color: "text.secondary", whiteSpace: "nowrap" }}>{formatDate(o.hospital?.createdAt)}</TableCell>
                      <TableCell sx={{ borderColor: "divider" }}>
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                          <Tooltip title={`Tenant setup ${o.tenantSetupCompleted ? "done" : "pending"}`}><Box sx={{ display: "flex" }}><YesNo v={!!o.tenantSetupCompleted} /></Box></Tooltip>
                          <Tooltip title={`Roles seeded ${o.defaultRolesSeeded ? "done" : "pending"}`}><Box sx={{ display: "flex" }}><YesNo v={!!o.defaultRolesSeeded} /></Box></Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ borderColor: "divider" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Chip label={o.paymentVerified ? "Verified" : "Not verified"} size="small"
                            sx={{ height: 20, fontWeight: 700, fontSize: "0.68rem", bgcolor: o.paymentVerified ? "rgba(16,185,129,0.14)" : "rgba(148,163,184,0.18)", color: o.paymentVerified ? SEMANTIC.successDark : "text.secondary" }} />
                          {o.paymentMismatch && (
                            <Tooltip title="No payment on file for this hospital"><WarningAmberRounded sx={{ fontSize: 16, color: SEMANTIC.danger }} /></Tooltip>
                          )}
                          {o.paymentUnverifiedButPaid && (
                            <Tooltip title="Payment on file — not yet verified"><InfoOutlined sx={{ fontSize: 16, color: SEMANTIC.warning }} /></Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ borderColor: "divider", whiteSpace: "nowrap" }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>{inr(o.billing?.totalPaid)}</Typography>
                        {o.billing?.lastPaymentAt && <Typography variant="caption" sx={{ color: "text.secondary" }}>{formatDate(o.billing.lastPaymentAt)}</Typography>}
                      </TableCell>
                      <TableCell sx={{ borderColor: "divider", whiteSpace: "nowrap" }}>
                        {o.billing?.latestInvoiceStatus ? (
                          <Chip label={o.billing.latestInvoiceOverdue ? "Overdue" : cap(o.billing.latestInvoiceStatus)} size="small"
                            sx={{ height: 20, fontWeight: 700, fontSize: "0.68rem",
                              bgcolor: o.billing.latestInvoiceStatus === "PAID" ? "rgba(16,185,129,0.14)" : o.billing.latestInvoiceOverdue ? "rgba(239,68,68,0.14)" : "rgba(245,158,11,0.14)",
                              color: o.billing.latestInvoiceStatus === "PAID" ? SEMANTIC.successDark : o.billing.latestInvoiceOverdue ? SEMANTIC.dangerDark : SEMANTIC.warningDark }} />
                        ) : <Typography variant="caption" sx={{ color: "text.disabled" }}>None</Typography>}
                      </TableCell>
                      <TableCell sx={{ borderColor: "divider" }}>
                        <Chip label={cap(o.onboardingStatus)} size="small" sx={{ height: 20, fontWeight: 700, fontSize: "0.68rem",
                          bgcolor: o.onboardingStatus === "completed" ? "rgba(16,185,129,0.14)" : o.onboardingStatus === "stalled" ? "rgba(239,68,68,0.14)" : "rgba(148,163,184,0.18)",
                          color: o.onboardingStatus === "completed" ? SEMANTIC.successDark : o.onboardingStatus === "stalled" ? SEMANTIC.dangerDark : "text.secondary" }} />
                      </TableCell>
                      <TableCell sx={{ borderColor: "divider" }} align="right">
                        <Tooltip title="Review onboarding">
                          <Button size="small" onClick={() => navigate(`/onboarding/${o.hospitalOnboardingId}/edit`)}
                            endIcon={<ArrowForwardRounded sx={{ fontSize: "14px !important" }} />}
                            sx={{ textTransform: "none", minWidth: 0, color: ACCENT }}>Review</Button>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}

// ── Page shell ───────────────────────────────────────────────────────────────

const GROUPS: ReportGroup[] = [
  { heading: "Overview", items: [{ key: "overview", label: "Platform Overview", Comp: OverviewReport }] },
  {
    heading: "Tenants",
    items: [
      { key: "hospitals", label: "Hospitals", Comp: HospitalsReport },
      { key: "onboarding", label: "Onboarding", Comp: OnboardingReport },
    ],
  },
  {
    heading: "Sales pipeline",
    items: [
      { key: "leads", label: "Leads", Comp: LeadsReport },
      { key: "trials", label: "Trials", Comp: TrialsReport },
    ],
  },
  { heading: "Revenue", items: [{ key: "subscriptions", label: "Subscriptions", Comp: SubscriptionsReport }] },
];

export default function AdminReports() {
  return (
    <ReportNavLayout
      title="Reports"
      subtitle="Platform-wide analytics and downloadable registers"
      groups={GROUPS}
      accent={ACCENT}
    />
  );
}
