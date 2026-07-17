import { ACCENTS } from "@/styles/accents";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Paper, Tabs, Tab, Typography, Button, Grid,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from "@mui/material";
import {
  FileDownloadRounded, LocalHospitalRounded, PeopleAltRounded,
  TimerRounded, CardMembershipRounded, RocketLaunchRounded, AccountBalanceWalletRounded,
  CheckCircleRounded, HighlightOffRounded,
} from "@mui/icons-material";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { axiosInstance } from "@/api/axios";
import { exportTableToExcel } from "@/utils/exportExcel";
import PageHeader from "@/components/layout/PageHeader";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import ErrorState from "@/components/ErrorState";
import { apiErrorText } from "@/utils/apiError";

const ACCENT = ACCENTS.admin; // indigo #6366f1
const PIE_COLORS = ["#6366f1", "#8b5cf6", "#0891b2", "#10b981", "#f59e0b", "#ef4444", "#64748b", "#ec4899"];

const inr = (n: unknown) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;
const fmtDate = (d: unknown) =>
  d ? new Date(d as string).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const cap = (s: unknown) => {
  const str = String(s ?? "").replace(/_/g, " ");
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "—";
};

const axisProps = { tick: { fill: "#94a3b8", fontSize: 12 }, stroke: "#cbd5e1" } as const;

// Page every list endpoint (hard cap 1000/page server-side) so exported
// registers are complete rather than silently truncated to the first page.
async function fetchAllRows(endpoint: string, params: Record<string, unknown> = {}): Promise<any[]> {
  const all: any[] = [];
  const limit = 1000;
  for (let page = 1; page <= 50; page++) {
    const res = await axiosInstance.get(endpoint, { params: { ...params, page, limit } });
    const batch: any[] = res.data?.data ?? [];
    all.push(...batch);
    const total = res.data?.pagination?.total ?? all.length;
    if (batch.length === 0 || all.length >= total) break;
  }
  return all;
}

// ── Shared presentational helpers (mirrors reception/Reports.tsx) ────────────

function KpiTile({ icon, label, value, sub, color = ACCENT }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 2, height: "100%" }}>
      <Box sx={{ width: 44, height: 44, borderRadius: 2.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: `${color}1f`, color }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }} noWrap>{value}</Typography>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, display: "block" }}>{label}</Typography>
        {sub && <Typography variant="caption" sx={{ color: "text.secondary" }}>{sub}</Typography>}
      </Box>
    </Paper>
  );
}

function ChartCard({ title, empty, children }: { title: string; empty?: boolean; children: React.ReactElement }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>{title}</Typography>
      {empty ? (
        <Box sx={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>No data to chart</Typography>
        </Box>
      ) : (
        <Box sx={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        </Box>
      )}
    </Paper>
  );
}

function SimpleTable({ title, head, rows }: { title: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "text.primary" }}>{title}</Typography>
        <Box sx={{ flex: 1 }} />
        {rows.length > 0 && (
          <Button size="small" startIcon={<FileDownloadRounded fontSize="small" />} onClick={() => exportTableToExcel(title, head, rows)}
            sx={{ textTransform: "none", color: ACCENT }}>Excel</Button>
        )}
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", py: 2, textAlign: "center" }}>No data</Typography>
      ) : (
        <TableContainer sx={{ maxHeight: 560 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {head.map((h, i) => (
                  <TableCell key={h} align={i === 0 ? "left" : "right"} sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", borderColor: "divider", bgcolor: "background.paper" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, ri) => (
                <TableRow key={ri} hover>
                  {r.map((c, ci) => (
                    <TableCell key={ci} align={ci === 0 ? "left" : "right"} sx={{ borderColor: "divider", color: ci === 0 ? "text.primary" : "text.secondary", fontWeight: ci === 0 ? 600 : 500 }}>{c}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}

// Boolean checkmark cell for onboarding checkpoints.
const YesNo = ({ v }: { v: boolean }) =>
  v ? <CheckCircleRounded sx={{ fontSize: 18, color: "#10b981" }} /> : <HighlightOffRounded sx={{ fontSize: 18, color: "text.disabled" }} />;

// ── Overview (from /dashboard/stats) ─────────────────────────────────────────

function OverviewReport() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-report-overview"],
    queryFn: async () => (await axiosInstance.get("/dashboard/stats")).data.data,
  });

  if (isLoading) return <ReportSkeleton />;
  if (isError || !data) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  const byPlan: any[] = data.hospitalsByPlan || [];
  const byStatus: any[] = data.leadsByStatus || [];
  const onboarding: any[] = data.onboardingProgress || [];
  const trend: any[] = data.hospitalsTrend || [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* KPIs */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<LocalHospitalRounded />} label="Hospitals" value={data.totalHospitals ?? 0} sub={`${data.activeHospitals ?? 0} active`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<TimerRounded />} label="Active Trials" value={data.activeTrials ?? 0} sub={`${data.expiredHospitals ?? 0} expired`} color="#f59e0b" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<PeopleAltRounded />} label="Leads" value={data.totalLeads ?? 0} sub={`${data.convertedLeads ?? 0} converted`} color="#8b5cf6" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<AccountBalanceWalletRounded />} label="Est. MRR" value={inr(data.totalRevenue)} sub="monthly recurring" color="#10b981" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<CardMembershipRounded />} label="Plans" value={data.activePlans ?? 0} color="#0891b2" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<PeopleAltRounded />} label="Patients" value={data.totalPatients ?? 0} color="#ec4899" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<PeopleAltRounded />} label="Doctors" value={data.totalDoctors ?? 0} color="#6366f1" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<LocalHospitalRounded />} label="Branches" value={data.totalBranches ?? 0} color="#64748b" /></Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 7 }}>
          <ChartCard title="Hospital growth (last 6 months)" empty={!trend.length}>
            <AreaChart data={trend} margin={{ left: -12 }}>
              <defs>
                <linearGradient id="adminTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ACCENT} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} allowDecimals={false} />
              <RTooltip />
              <Area type="monotone" dataKey="count" name="Hospitals" stroke={ACCENT} strokeWidth={2} fill="url(#adminTrend)" />
            </AreaChart>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <ChartCard title="Branches by plan" empty={!byPlan.length}>
            <PieChart>
              <Pie data={byPlan} dataKey="count" nameKey="planName" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {byPlan.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Legend /><RTooltip />
            </PieChart>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <ChartCard title="Leads by stage" empty={!byStatus.length}>
            <BarChart data={byStatus.map((s) => ({ ...s, label: cap(s.status) }))} margin={{ left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} allowDecimals={false} />
              <RTooltip />
              <Bar dataKey="count" name="Leads" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <ChartCard title="Onboarding progress" empty={!onboarding.length}>
            <PieChart>
              <Pie data={onboarding.map((o) => ({ ...o, label: cap(o.status) }))} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={90} paddingAngle={2}>
                {onboarding.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Legend /><RTooltip />
            </PieChart>
          </ChartCard>
        </Grid>
      </Grid>

      {/* Downloadable summary tables */}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <SimpleTable title="Branches by plan" head={["Plan", "Branches"]} rows={byPlan.map((p) => [p.planName, Number(p.count)])} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SimpleTable title="Leads by stage" head={["Stage", "Leads"]} rows={byStatus.map((s) => [cap(s.status), Number(s.count)])} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SimpleTable title="Onboarding progress" head={["Status", "Hospitals"]} rows={onboarding.map((o) => [cap(o.status), Number(o.count)])} />
        </Grid>
      </Grid>
    </Box>
  );
}

// ── Hospitals register (from /hospitals) ─────────────────────────────────────

function HospitalsReport() {
  const { data = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-report-hospitals"],
    queryFn: () => fetchAllRows("/hospitals"),
  });

  if (isLoading) return <ReportSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  const planNames = (h: any) => {
    const names = [...new Set((h.branches || []).map((b: any) => b.subscriptionPlan?.planName).filter(Boolean))];
    return names.length ? names.join(", ") : "—";
  };
  const rows = data.map((h: any) => [
    `${h.hospitalName || "—"}`,
    h.hospitalCode || "—",
    cap(h.status),
    planNames(h),
    Number(h._count?.branches ?? 0),
    fmtDate(h.createdAt),
  ]);
  const active = data.filter((h: any) => h.status === "active").length;
  const suspended = data.filter((h: any) => h.status === "suspended").length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<LocalHospitalRounded />} label="Total" value={data.length} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<CheckCircleRounded />} label="Active" value={active} color="#10b981" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<HighlightOffRounded />} label="Suspended" value={suspended} color="#ef4444" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<LocalHospitalRounded />} label="Branches" value={data.reduce((s: number, h: any) => s + Number(h._count?.branches ?? 0), 0)} color="#64748b" /></Grid>
      </Grid>
      <SimpleTable title="Hospitals register" head={["Hospital", "Code", "Status", "Plan(s)", "Branches", "Registered"]} rows={rows} />
    </Box>
  );
}

// ── Sales pipeline / Leads (from /leads) ─────────────────────────────────────

function LeadsReport() {
  const { data = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-report-leads"],
    queryFn: () => fetchAllRows("/leads"),
  });

  if (isLoading) return <ReportSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  const rows = data.map((l: any) => [
    l.hospitalName || "—",
    l.contactPersonName || "—",
    l.email || "—",
    l.phone || "—",
    cap(l.leadStatus),
    l.assignedUser ? `${l.assignedUser.firstName || ""} ${l.assignedUser.lastName || ""}`.trim() || "—" : "—",
    fmtDate(l.createdAt),
  ]);

  // Funnel counts from the fetched rows (so the chart matches the exported table exactly).
  const stageOrder = ["new", "contacted", "qualified", "demo_done", "trialing", "converted", "lost"];
  const counts: Record<string, number> = {};
  data.forEach((l: any) => { counts[l.leadStatus] = (counts[l.leadStatus] || 0) + 1; });
  const funnel = stageOrder.filter((s) => counts[s]).map((s) => ({ label: cap(s), count: counts[s] }));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<PeopleAltRounded />} label="Total leads" value={data.length} color="#8b5cf6" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<CheckCircleRounded />} label="Converted" value={counts["converted"] || 0} color="#10b981" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<RocketLaunchRounded />} label="Trialing" value={counts["trialing"] || 0} color="#f59e0b" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<HighlightOffRounded />} label="Lost" value={counts["lost"] || 0} color="#ef4444" /></Grid>
      </Grid>
      <ChartCard title="Pipeline by stage" empty={!funnel.length}>
        <BarChart data={funnel} margin={{ left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} />
          <RTooltip />
          <Bar dataKey="count" name="Leads" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartCard>
      <SimpleTable title="Leads register" head={["Hospital", "Contact", "Email", "Phone", "Stage", "Assigned to", "Created"]} rows={rows} />
    </Box>
  );
}

// ── Trials (from /trials) ────────────────────────────────────────────────────

function TrialsReport() {
  const { data = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-report-trials"],
    queryFn: () => fetchAllRows("/trials"),
  });

  if (isLoading) return <ReportSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  const rows = data.map((t: any) => [
    t.lead?.hospitalName || "—",
    fmtDate(t.trialStartDate),
    fmtDate(t.trialEndDate),
    cap(t.trialStatus),
    t.autoExpire ? "Yes" : "No",
  ]);
  const byState = (s: string) => data.filter((t: any) => t.trialStatus === s).length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<TimerRounded />} label="Total trials" value={data.length} color="#f59e0b" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<RocketLaunchRounded />} label="Active" value={byState("active")} color="#6366f1" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<CheckCircleRounded />} label="Converted" value={byState("converted")} color="#10b981" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<HighlightOffRounded />} label="Expired" value={byState("expired")} color="#ef4444" /></Grid>
      </Grid>
      <SimpleTable title="Trials register" head={["Hospital", "Start", "End", "Status", "Auto-expire"]} rows={rows} />
    </Box>
  );
}

// ── Subscriptions / Revenue by plan (from /plans) ────────────────────────────

function SubscriptionsReport() {
  const { data = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-report-plans"],
    queryFn: () => fetchAllRows("/plans"),
  });

  if (isLoading) return <ReportSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  // Est. MRR per plan = monthlyPrice × branches subscribed to it (same basis as the dashboard).
  const withMrr = data.map((p: any) => {
    const branches = Number(p._count?.branches ?? 0);
    const mrr = Number(p.monthlyPrice || 0) * branches;
    return { ...p, branches, mrr };
  });
  const totalMrr = withMrr.reduce((s: number, p: any) => s + p.mrr, 0);
  const totalBranches = withMrr.reduce((s: number, p: any) => s + p.branches, 0);

  const rows = withMrr.map((p: any) => [
    p.planName,
    inr(p.monthlyPrice),
    inr(p.annualPrice),
    Number(p.maxDoctors ?? 0),
    Number(p.maxBranches ?? 0),
    Number(p.maxStorageGb ?? 0),
    p.branches,
    inr(p.mrr),
  ]);
  const chart = withMrr.filter((p: any) => p.mrr > 0).map((p: any) => ({ label: p.planName, mrr: p.mrr }));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<CardMembershipRounded />} label="Plans" value={data.length} color="#0891b2" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<LocalHospitalRounded />} label="Subscribed branches" value={totalBranches} color="#64748b" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<AccountBalanceWalletRounded />} label="Est. MRR" value={inr(totalMrr)} sub="monthly recurring" color="#10b981" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<AccountBalanceWalletRounded />} label="Est. ARR" value={inr(totalMrr * 12)} sub="annualised" color="#8b5cf6" /></Grid>
      </Grid>
      <ChartCard title="Estimated MRR by plan" empty={!chart.length}>
        <BarChart data={chart} margin={{ left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} />
          <RTooltip formatter={(v: any) => inr(v)} />
          <Bar dataKey="mrr" name="Est. MRR" fill={ACCENT} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartCard>
      <SimpleTable
        title="Subscription plans"
        head={["Plan", "Monthly", "Annual", "Max doctors", "Max branches", "Max storage (GB)", "Branches", "Est. MRR"]}
        rows={rows}
      />
    </Box>
  );
}

// ── Onboarding (from /onboarding) ────────────────────────────────────────────

function OnboardingReport() {
  const { data = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-report-onboarding"],
    queryFn: () => fetchAllRows("/onboarding"),
  });

  if (isLoading) return <ReportSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  const rows = data.map((o: any) => [
    o.hospital?.hospitalName || "—",
    o.hospital?.hospitalCode || "—",
    o.tenantSetupCompleted ? "Yes" : "No",
    o.defaultRolesSeeded ? "Yes" : "No",
    o.paymentVerified ? "Yes" : "No",
    cap(o.onboardingStatus),
  ]);
  const completed = data.filter((o: any) => o.onboardingStatus === "completed").length;
  const stalled = data.filter((o: any) => o.onboardingStatus === "stalled").length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<RocketLaunchRounded />} label="Onboarding records" value={data.length} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<CheckCircleRounded />} label="Completed" value={completed} color="#10b981" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<HighlightOffRounded />} label="Stalled" value={stalled} color="#ef4444" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiTile icon={<CheckCircleRounded />} label="Payment verified" value={data.filter((o: any) => o.paymentVerified).length} color="#0891b2" /></Grid>
      </Grid>
      {/* Custom table so the boolean checkpoints render as icons on-screen while the
          Excel export (below, same data) uses plain Yes/No. */}
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Onboarding register</Typography>
          <Box sx={{ flex: 1 }} />
          {rows.length > 0 && (
            <Button size="small" startIcon={<FileDownloadRounded fontSize="small" />}
              onClick={() => exportTableToExcel("Onboarding register", ["Hospital", "Code", "Tenant setup", "Roles seeded", "Payment verified", "Status"], rows)}
              sx={{ textTransform: "none", color: ACCENT }}>Excel</Button>
          )}
        </Box>
        {data.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 2, textAlign: "center" }}>No data</Typography>
        ) : (
          <TableContainer sx={{ maxHeight: 560 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {["Hospital", "Code", "Tenant setup", "Roles seeded", "Payment verified", "Status"].map((h, i) => (
                    <TableCell key={h} align={i === 0 ? "left" : i >= 2 && i <= 4 ? "center" : "right"} sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", borderColor: "divider", bgcolor: "background.paper" }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((o: any) => (
                  <TableRow key={o.hospitalOnboardingId} hover>
                    <TableCell sx={{ borderColor: "divider", color: "text.primary", fontWeight: 600 }}>{o.hospital?.hospitalName || "—"}</TableCell>
                    <TableCell align="right" sx={{ borderColor: "divider", color: "text.secondary", fontFamily: "monospace" }}>{o.hospital?.hospitalCode || "—"}</TableCell>
                    <TableCell align="center" sx={{ borderColor: "divider" }}><YesNo v={!!o.tenantSetupCompleted} /></TableCell>
                    <TableCell align="center" sx={{ borderColor: "divider" }}><YesNo v={!!o.defaultRolesSeeded} /></TableCell>
                    <TableCell align="center" sx={{ borderColor: "divider" }}><YesNo v={!!o.paymentVerified} /></TableCell>
                    <TableCell align="right" sx={{ borderColor: "divider", color: "text.secondary", fontWeight: 600 }}>{cap(o.onboardingStatus)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}

// ── Page shell ───────────────────────────────────────────────────────────────

const TABS = [
  { label: "Overview", Comp: OverviewReport },
  { label: "Hospitals", Comp: HospitalsReport },
  { label: "Sales Pipeline", Comp: LeadsReport },
  { label: "Trials", Comp: TrialsReport },
  { label: "Subscriptions", Comp: SubscriptionsReport },
  { label: "Onboarding", Comp: OnboardingReport },
];

export default function AdminReports() {
  const [tab, setTab] = useState(0);
  const Active = TABS[tab].Comp;

  return (
    <Box>
      <PageHeader title="Reports" subtitle="Platform-wide analytics and downloadable registers" />
      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper", mb: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ px: 1, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 52 }, "& .Mui-selected": { color: `${ACCENT} !important` }, "& .MuiTabs-indicator": { bgcolor: ACCENT } }}>
          {TABS.map((t) => <Tab key={t.label} label={t.label} />)}
        </Tabs>
      </Paper>
      <Active />
    </Box>
  );
}
