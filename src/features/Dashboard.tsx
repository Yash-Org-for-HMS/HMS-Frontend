import { useState } from "react";
import { getApiErrorMessage } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  LocalHospitalRounded,
  PeopleAltRounded,
  TimerRounded,
  CardMembershipRounded,
  AdminPanelSettingsRounded,
  AssignmentTurnedInRounded,
  CheckCircleRounded,
  MedicalServicesRounded,
  TimerOffRounded,
  AccountBalanceRounded,
  BusinessRounded,
  HealingRounded,
} from "@mui/icons-material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
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
  recentActivities: Array<any>;
}

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
  const GroupCard = ({ title, icon, color, primary, subs }: any) => (
    <Paper
      elevation={0}
      sx={{
        p: 2.25,
        borderRadius: 3,
        bgcolor: "background.paper",
        border: "1px solid", borderColor: "divider",
        height: "100%",
        transition: "all 0.2s ease-in-out",
        "&:hover": { boxShadow: "0 6px 24px rgba(0,0,0,0.06)" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: 2, bgcolor: `${color}15`, color, display: "grid", placeItems: "center", "& svg": { fontSize: 17 } }}>
          {icon}
        </Box>
        <Typography variant="caption" fontWeight={700} sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.4 }}>{title}</Typography>
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 800, color: "text.primary", lineHeight: 1.05 }}>{primary.value}</Typography>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>{primary.label}</Typography>
      <Box sx={{ borderTop: "1px solid", borderColor: "divider", my: 1.25 }} />
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

  // ── Derived chart data ───────────────────────────────────────────────────
  const INDIGO = "#6366f1";  // single-hue for the lead funnel (magnitude)
  const TEAL = "#14b8a6";    // single-hue for plan mix (distinct from the funnel)
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

  // Tenant health — status palette (good / warning / critical), always with labels.
  const tenantSeg = [
    { label: "Active", value: stats.activeHospitals, color: "#10b981" },
    { label: "In trial", value: stats.trialHospitals, color: "#f59e0b" },
    { label: "Expired", value: stats.expiredHospitals, color: "#ef4444" },
  ];
  const tenantTotal = tenantSeg.reduce((s, t) => s + t.value, 0);

  const planData = [...stats.hospitalsByPlan].sort((a, b) => b.count - a.count);

  // Shared chart card (title + optional right-slot headline + plot area).
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

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      
      {/* Welcome Banner - Minimalist */}
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <Box>
          <Typography variant="h4" fontWeight="800" sx={{ color: "text.primary", mb: 1, letterSpacing: "-0.5px" }}>
            Welcome back, {user?.firstName || "Admin"}
          </Typography>
          <Typography variant="subtitle1" sx={{ color: "text.secondary", fontWeight: 500 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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
            primary={{ label: "MRR (revenue)", value: `₹${stats.totalRevenue.toLocaleString()}` }}
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
                <Bar dataKey="count" fill={INDIGO} radius={[0, 4, 4, 0]} barSize={22}>
                  <LabelList dataKey="count" position="right" style={{ fill: "#475569", fontSize: 12, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {/* Tenant status — state palette (good/warning/critical), always labelled */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <ChartCard title="Tenant Status" subtitle={`${stats.totalHospitals} hospital${stats.totalHospitals === 1 ? "" : "s"}`}>
            <Box sx={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center", gap: 2.5 }}>
              <Box sx={{ display: "flex", gap: "2px", height: 14, borderRadius: 99, overflow: "hidden", bgcolor: "action.hover" }}>
                {tenantSeg.filter((t) => t.value > 0).map((t) => (
                  <Box key={t.label} sx={{ flexGrow: t.value, bgcolor: t.color }} />
                ))}
              </Box>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {tenantSeg.map((t) => (
                  <Box key={t.label} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: t.color, flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ flex: 1, color: "text.primary", fontWeight: 500 }}>{t.label}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: "text.primary" }}>{t.value}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", width: 42, textAlign: "right" }}>{tenantTotal ? Math.round((t.value / tenantTotal) * 100) : 0}%</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </ChartCard>
        </Grid>

        {/* Hospitals by plan — magnitude by category, single hue, sorted desc */}
        <Grid size={{ xs: 12 }}>
          <ChartCard title="Hospitals by Plan" subtitle="Active subscriptions by plan" height={Math.max(200, 96 + planData.length * 42)}>
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
      
    </Container>
  );
}
