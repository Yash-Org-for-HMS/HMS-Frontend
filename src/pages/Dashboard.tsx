import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Box,
  Container,
  Typography,
  Paper,
  Avatar,
  Chip,
  Button,
  Tabs,
  Tab,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  LocalHospitalRounded,
  PeopleAltRounded,
  TimerRounded,
  CardMembershipRounded,
  TrendingUpRounded,
  AdminPanelSettingsRounded,
  AssignmentTurnedInRounded,
  CheckCircleRounded,
  ArrowForwardIosRounded,
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
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { axiosInstance } from "../api/axios";
import { useAuth } from "../contexts/AuthContext";
import ErrorState from "../components/ErrorState";
import HeartbeatLoader from "../components/HeartbeatLoader";

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

const COLORS = ["#4F46E5", "#10B981", "#EC4899", "#F59E0B", "#3B82F6", "#8B5CF6"];
const PLAN_COLORS = ["#8B5CF6", "#3B82F6", "#14B8A6", "#F59E0B", "#EF4444"];

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tabIndex, setTabIndex] = useState(0);

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
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <HeartbeatLoader size={48} />
      </Box>
    );
  }

  // Previously a failed fetch left `stats` null and the page rendered nothing
  // (blank screen). Now we surface the real error with a retry.
  if (isError || !stats) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <ErrorState
          title="Couldn't load the dashboard"
          message={(error as any)?.response?.data?.message || "Please check your connection and try again."}
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
            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.68rem", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</Typography>
          </Box>
        ))}
      </Box>
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

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 5 }}>
        {/* Trend Chart */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper
            elevation={2}
            sx={{
              p: 3,
              bgcolor: "#FFFFFF",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              height: 400,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Typography variant="h6" sx={{ color: "text.primary", mb: 3, fontWeight: 700 }}>
              Hospitals Growth Trend
            </Typography>
            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.hospitalsTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.05)" vertical={false} />
                  <XAxis dataKey="month" stroke="#64748B" tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis stroke="#64748B" tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(15,23,42,0.1)", borderRadius: 8, color: "#0F172A", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}
                    itemStyle={{ color: "#4F46E5", fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Hospitals By Plan Pie Chart */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper
            elevation={2}
            sx={{
              p: 3,
              bgcolor: "#FFFFFF",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              height: 400,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Typography variant="h6" sx={{ color: "text.primary", mb: 3, fontWeight: 700 }}>
              Hospitals By Plan
            </Typography>
            <Box sx={{ flexGrow: 1, minHeight: 0, position: "relative" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.hospitalsByPlan}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="planName"
                    stroke="none"
                  >
                    {stats.hospitalsByPlan.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={PLAN_COLORS[index % PLAN_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(15,23,42,0.1)", borderRadius: 8, color: "#0F172A", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}
                    itemStyle={{ fontWeight: 600 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 700 }}>
                    {stats.hospitalsByPlan.reduce((sum, item) => sum + item.count, 0)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Total</Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>
        
        {/* Leads By Status Bar Chart */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper
            elevation={2}
            sx={{
              p: 3,
              bgcolor: "#FFFFFF",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              height: 400,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Typography variant="h6" sx={{ color: "text.primary", mb: 3, fontWeight: 700 }}>
              {t("dashboard.leadsByStatus")}
            </Typography>
            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.leadsByStatus} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.05)" vertical={false} />
                  <XAxis dataKey="status" stroke="#64748B" tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis stroke="#64748B" tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(15,23,42,0.02)" }}
                    contentStyle={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(15,23,42,0.1)", borderRadius: 8, color: "#0F172A", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}
                    itemStyle={{ color: "#3B82F6", fontWeight: 600 }}
                  />
                  <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Onboarding Progress */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper
            elevation={2}
            sx={{
              p: 3,
              bgcolor: "#FFFFFF",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              height: 400,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Typography variant="h6" sx={{ color: "text.primary", mb: 3, fontWeight: 700 }}>
              {t("dashboard.onboardingProgress")}
            </Typography>
            <Box sx={{ flexGrow: 1, minHeight: 0, position: "relative" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.onboardingProgress}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="status"
                    stroke="none"
                  >
                    {stats.onboardingProgress.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(15,23,42,0.1)", borderRadius: 8, color: "#0F172A", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}
                    itemStyle={{ fontWeight: 600 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 700 }}>
                    {stats.onboardingProgress.reduce((sum, item) => sum + item.count, 0)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Total</Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Activity List */}
      <Paper
        elevation={2}
        sx={{
          bgcolor: "#FFFFFF",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <Box sx={{ p: 3, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700 }}>
            {t("dashboard.recentActivity")}
          </Typography>
          <Button 
            endIcon={<ArrowForwardIosRounded sx={{ fontSize: 12 }} />} 
            sx={{ color: "primary.main", textTransform: "none", fontWeight: 600 }}
          >
            View All
          </Button>
        </Box>
        <Box sx={{ p: 0 }}>
          {stats.recentActivities.length === 0 ? (
            <Box sx={{ py: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <Typography sx={{ color: "text.secondary", textAlign: "center" }}>
                {t("common.noData")}
              </Typography>
            </Box>
          ) : (
            stats.recentActivities.map((activity, index) => (
              <Box 
                key={activity.activityLogId}
                sx={{ 
                  px: 3, 
                  py: 2, 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 2,
                  "&:hover": { bgcolor: "background.paper" },
                  borderBottom: index < stats.recentActivities.length - 1 ? "1px solid" : "none",
                  borderColor: "divider"
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: "rgba(79, 70, 229, 0.1)",
                    color: "#4F46E5",
                    width: 40,
                    height: 40,
                    fontSize: "1rem",
                    fontWeight: 600,
                  }}
                >
                  {activity.moduleName.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography sx={{ color: "text.primary", fontWeight: 500, fontSize: "0.95rem" }}>
                    {activity.description}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 0.5 }}>
                    <Chip
                      label={activity.moduleName}
                      size="small"
                      sx={{
                        bgcolor: "background.paper",
                        color: "text.secondary",
                        height: 20,
                        fontSize: "0.7rem",
                        fontWeight: 600,
                      }}
                    />
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {new Date(activity.createdAt).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Paper>
      
    </Container>
  );
}
