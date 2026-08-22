import { useState } from "react";
import { formatDateTime, formatINRAuto, formatLongDate } from "@/utils/format";
import { greetingFor } from "@/utils/greeting";
import { getApiErrorMessage } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Box,
  Container,
  Typography,
  Paper,
  } from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  LocalHospitalRounded,
  PeopleAltRounded,
  AccountBalanceRounded,
  BusinessRounded,
  } from "@mui/icons-material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  CartesianGrid,
} from "recharts";
import { axiosInstance } from "@/api/axios";
import { useAuth } from "@/providers/AuthContext";
import ErrorState from "@/components/ErrorState";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";

interface DashboardStats {
  totalHospitals: number;
  activeHospitals: number;
  trialHospitals: number;
  expiredHospitals: number;
  totalLeads: number;
  convertedLeads: number;
  activeTrials: number;
  activePlans: number;
  hospitalAdminCount: number;
  totalUsers: number;
  totalDoctors: number;
  totalPatients: number;
  totalBranches: number;
  totalRevenue: number;
  hospitalsByPlan: Array<{ planName: string; count: number }>;
  onboardingProgress: Array<{ status: string; count: number }>;
  leadsByStatus: Array<{ status: string; count: number }>;
  hospitalsTrend: Array<{ month: string; count: number }>;
  recentActivities: Array<{
    activityLogId: string;
    moduleName: string | null;
    description: string;
    createdAt: string;
  }>;
}

const GroupCard = ({ title, icon, color, primary, subs }: any) => (
  <Paper
    elevation={0}
    sx={{
      p: 2,
      borderRadius: 3,
      bgcolor: "background.paper",
      border: "1px solid", borderColor: "divider",
      height: "100%",
      transition: "all 0.2s ease-in-out",
      "&:hover": { boxShadow: "0 6px 24px rgba(0,0,0,0.06)" },
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
      <Box sx={{ width: 28, height: 28, borderRadius: 2, bgcolor: `${color}15`, color, display: "grid", placeItems: "center", "& svg": { fontSize: 16 } }}>
        {icon}
      </Box>
      <Typography variant="caption" fontWeight={700} sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.4 }}>{title}</Typography>
    </Box>
    <Typography variant="h5" sx={{ fontWeight: 800, color: "text.primary", lineHeight: 1.05 }}>{primary.value}</Typography>
    <Typography variant="caption" sx={{ color: "text.secondary" }}>{primary.label}</Typography>
    <Box sx={{ borderTop: "1px solid", borderColor: "divider", my: 1 }} />
    <Box sx={{ display: "flex", gap: 1 }}>
      {subs.map((s: any) => (
        <Box key={s.label} sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={800} sx={{ color: s.color || "text.primary", lineHeight: 1.2 }}>{s.value}</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.75rem", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</Typography>
        </Box>
      ))}
    </Box>
  </Paper>
);

const ChartCard = ({ title, subtitle, right, height = 340, children }: any) => (
  <Paper elevation={0} sx={{ p: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, height, display: "flex", flexDirection: "column" }}>
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 2, mb: 2 }}>
      <Box>
        <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700 }}>{title}</Typography>
        {subtitle && <Typography variant="caption" sx={{ color: "text.secondary" }}>{subtitle}</Typography>}
      </Box>
      {right}
    </Box>
    <Box sx={{ flexGrow: 1, minHeight: 0 }}>{children}</Box>
  </Paper>
);

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const {
    data: stats,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const response = await axiosInstance.get("/dashboard/stats");
      return response.data.data;
    },
  });

  if (isLoading) {
    return (
      <DashboardSkeleton />
    );
  }

  // Previously a failed fetch left `stats` null and the page rendered nothing
  // (blank screen). Now we surface the real error with a retry.
  if (isError || !stats) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <ErrorState
          title="Couldn't load the dashboard"
          message={getApiErrorMessage(error, "Please check your connection and try again.")}
          onRetry={() => refetch()}
        />
      </Container>
    );
  }

  // One card per theme, with a headline metric and related sub-metrics grouped
  // beneath it (e.g. Total Hospitals + Active / On Trial / Expired together).

  // ── Derived chart data ───────────────────────────────────────────────────
  const INDIGO = "#6366f1";  // single-hue for the lead funnel (magnitude)
  const TEAL = "#14b8a6";    // single-hue for plan mix (distinct from the funnel)
  const BLUE = "#3b82f6";    // single-hue for tenant growth; matches the TENANTS tile
  const tooltipStyle = { backgroundColor: "#FFFFFF", border: "1px solid rgba(15,23,42,0.1)", borderRadius: 8, color: "#0F172A", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", fontSize: 13 } as const;

  const FUNNEL = [
    { key: "new", label: "New" },
    { key: "contacted", label: "Contacted" },
    { key: "qualified", label: "Qualified" },
    { key: "demo_done", label: "Demo done" },
    { key: "converted", label: "Converted" },
  ];
  const leadCounts: Record<string, number> = Object.fromEntries(stats.leadsByStatus.map((s) => [s.status, s.count]));
  const funnelData = FUNNEL.map((f) => ({ stage: f.label, count: leadCounts[f.key] || 0 }));
  const convRate = stats.totalLeads ? Math.round((stats.convertedLeads / stats.totalLeads) * 100) : 0;


  const planData = [...stats.hospitalsByPlan].sort((a, b) => b.count - a.count);
  const trendData = stats.hospitalsTrend ?? [];
  const activities = stats.recentActivities ?? [];
  // Onboarding statuses arrive as raw enum values (in_progress, …).
  const onboardingData = (stats.onboardingProgress ?? [])
    .map((o) => ({
      label: o.status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
      count: o.count,
    }))
    .sort((a, b) => b.count - a.count);

  // Shared chart card (title + optional right-slot headline + plot area).

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      
      {/* Welcome Banner - Minimalist */}
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <Box>
          <Typography variant="h4" fontWeight="800" sx={{ color: "text.primary", mb: 1, letterSpacing: "-0.5px" }}>
            {greetingFor(user?.firstName || "Admin")}
          </Typography>
          <Typography variant="subtitle1" sx={{ color: "text.secondary", fontWeight: 500 }}>
            {formatLongDate(new Date())}
          </Typography>
        </Box>
      </Box>

      {/* Grouped KPIs — related metrics live together */}
      <Grid container spacing={3} sx={{ mb: 5 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <GroupCard
            title="Tenants" color="#3B82F6" icon={<LocalHospitalRounded />}
            primary={{ label: "Total Hospitals", value: stats.totalHospitals }}
            subs={[
              { label: "Active", value: stats.activeHospitals, color: "#10B981" },
              { label: "On Trial", value: stats.trialHospitals, color: "#F59E0B" },
              { label: "Expired", value: stats.expiredHospitals, color: "#EF4444" },
            ]}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <GroupCard
            title="Sales Pipeline" color="#8B5CF6" icon={<PeopleAltRounded />}
            primary={{ label: "Total Leads", value: stats.totalLeads }}
            subs={[
              { label: "Converted", value: stats.convertedLeads, color: "#10B981" },
              { label: "Active Trials", value: stats.activeTrials, color: "#F59E0B" },
              { label: "Conversion", value: `${stats.totalLeads ? Math.round((stats.convertedLeads / stats.totalLeads) * 100) : 0}%` },
            ]}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <GroupCard
            title="Scale" color="#10B981" icon={<BusinessRounded />}
            primary={{ label: "Patients", value: stats.totalPatients }}
            subs={[
              { label: "Doctors", value: stats.totalDoctors },
              { label: "Branches", value: stats.totalBranches },
              { label: "Users", value: stats.totalUsers },
            ]}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <GroupCard
            title="Revenue & Plans" color="#F59E0B" icon={<AccountBalanceRounded />}
            primary={{ label: "MRR (revenue)", value: formatINRAuto(stats.totalRevenue) }}
            subs={[
              { label: "Active Plans", value: stats.activePlans },
              { label: "Hospital Admins", value: stats.hospitalAdminCount },
            ]}
          />
        </Grid>
      </Grid>

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Lead conversion funnel — ordered pipeline stages, single hue, direct labels */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <ChartCard
            title="Lead Conversion Funnel"
            subtitle={`${stats.convertedLeads} of ${stats.totalLeads} leads converted`}
            // 5 fixed stages — content-sized instead of the 340 default, which
            // left a lot of dead space below/around a short 5-row bar list.
            height={280}
            right={
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: INDIGO, lineHeight: 1 }}>{convRate}%</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>conversion</Typography>
              </Box>
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ top: 4, right: 44, left: 8, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="stage" width={92} tick={{ fill: "#475569", fontSize: 13 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "rgba(99,102,241,0.06)" }} contentStyle={tooltipStyle} formatter={(v) => [v, "Leads"]} />
                {/* minPointSize gives a zero-count stage a 2px stub, so the label
                    anchors and the row reads as "nobody here" rather than as a
                    missing row. Without it four empty stages render as bare
                    labels and the funnel looks broken rather than early. */}
                <Bar dataKey="count" fill={INDIGO} radius={[0, 4, 4, 0]} barSize={22} minPointSize={2}>
                  <LabelList dataKey="count" position="right" style={{ fill: "#475569", fontSize: 12, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {/* Hospitals by plan — magnitude by category, single hue, sorted desc */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <ChartCard title="Hospitals by Plan" subtitle="Active subscriptions by plan" height={280}>
            {planData.length === 0 ? (
              <Box sx={{ display: "grid", placeItems: "center", height: "100%" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>No active plans yet.</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planData} layout="vertical" margin={{ top: 4, right: 44, left: 8, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="planName" width={150} tick={{ fill: "#475569", fontSize: 13 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "rgba(20,184,166,0.06)" }} contentStyle={tooltipStyle} formatter={(v) => [v, "Hospitals"]} />
                  <Bar dataKey="count" fill={TEAL} radius={[0, 4, 4, 0]} barSize={22}>
                    <LabelList dataKey="count" position="right" style={{ fill: "#475569", fontSize: 12, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </Grid>
      </Grid>

      {/* ── Growth + activity ─────────────────────────────────────────────── */}
      {/* Both of these were already being fetched, typed, and then dropped:
          the API returns hospitalsTrend and recentActivities on every call and
          nothing rendered them. */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* New tenants per month — a count per discrete period, so bars rather
            than a line: nothing continuous joins one month to the next. */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <ChartCard title="Tenant Growth" subtitle="New hospitals onboarded per month" height={280}>
            {trendData.length === 0 ? (
              <Box sx={{ display: "grid", placeItems: "center", height: "100%", color: "text.secondary" }}>
                <Typography variant="body2">No hospitals onboarded yet.</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "rgba(59,130,246,0.06)" }} contentStyle={tooltipStyle} formatter={(v) => [v, "New hospitals"]} />
                  <Bar dataKey="count" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </Grid>

        {/* Onboarding progress — where tenants are stuck before going live. */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <ChartCard title="Onboarding Progress" subtitle="Tenants by setup stage" height={280}>
            {onboardingData.length === 0 ? (
              <Box sx={{ display: "grid", placeItems: "center", height: "100%", color: "text.secondary" }}>
                <Typography variant="body2">Nothing in onboarding.</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={onboardingData} layout="vertical" margin={{ top: 4, right: 44, left: 8, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="label" width={104} tick={{ fill: "#475569", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "rgba(20,184,166,0.06)" }} contentStyle={tooltipStyle} formatter={(v) => [v, "Tenants"]} />
                  <Bar dataKey="count" fill={TEAL} radius={[0, 4, 4, 0]} barSize={20}>
                    <LabelList dataKey="count" position="right" style={{ fill: "#475569", fontSize: 12, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </Grid>
      </Grid>

      {/* Recent activity — the last ten audited actions across the platform. */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>Recent Activity</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>Latest audited actions across all tenants</Typography>
          </Box>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>Last {activities.length}</Typography>
        </Box>
        {activities.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>No activity recorded yet.</Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            {activities.map((a, i) => (
              <Box
                key={a.activityLogId}
                sx={{
                  display: "flex", alignItems: "center", gap: 1.5, py: 1.25,
                  borderTop: i === 0 ? "none" : "1px solid", borderColor: "divider",
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: BLUE, flexShrink: 0 }} />
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0, color: "text.primary" }} noWrap>
                  {a.description}
                </Typography>
                {a.moduleName && (
                  <Typography variant="caption" sx={{ color: "text.secondary", flexShrink: 0 }}>{a.moduleName}</Typography>
                )}
                <Typography variant="caption" sx={{ color: "text.secondary", flexShrink: 0, width: 132, textAlign: "right" }}>
                  {formatDateTime(a.createdAt)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Paper>

    </Container>
  );
}
