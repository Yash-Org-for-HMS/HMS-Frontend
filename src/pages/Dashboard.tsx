import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Container,
  Typography,
  Paper,
  CircularProgress,
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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axiosInstance.get("/dashboard/stats");
        setStats(response.data.data);
      } catch (error) {
        console.error("Failed to fetch dashboard stats", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <CircularProgress sx={{ color: "#4F46E5" }} />
      </Box>
    );
  }

  if (!stats) return null;

  const StatCard = ({ title, value, icon, colorHex }: any) => (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 4,
        bgcolor: "background.paper",
        border: "1px solid", borderColor: "divider",
        transition: "all 0.2s ease-in-out",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: 160,
        "&:hover": {
          boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
          transform: "translateY(-2px)",
        },
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 3,
            bgcolor: `${colorHex}15`,
            color: colorHex,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </Box>
      </Box>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800, color: "text.primary" }}>
          {value}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, mt: 1, display: "block" }}>
          {title}
        </Typography>
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

      {/* Tabs for Grouping Stats */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 4 }}>
        <Tabs 
          value={tabIndex} 
          onChange={(_e, v) => setTabIndex(v)}
          TabIndicatorProps={{ sx: { bgcolor: "#4F46E5", height: 3, borderRadius: "3px 3px 0 0" } }}
          sx={{ "& .MuiTab-root": { fontWeight: 600, textTransform: "none", fontSize: "1rem" }, "& .Mui-selected": { color: "#4F46E5 !important" } }}
        >
          <Tab label="Business Overview" />
          <Tab label="Platform Metrics" />
          <Tab label="Trials & Onboarding" />
        </Tabs>
      </Box>

      {/* Primary Stats Grid */}
      <Box hidden={tabIndex !== 0}>
        <Grid container spacing={3} sx={{ mb: 5 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="MRR (Revenue)" value={`$${stats.totalRevenue.toLocaleString()}`} icon={<AccountBalanceRounded />} colorHex="#10B981" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="Total Hospitals" value={stats.totalHospitals} icon={<LocalHospitalRounded />} colorHex="#3B82F6" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="Active Hospitals" value={stats.activeHospitals} icon={<CheckCircleRounded />} colorHex="#10B981" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="Total Leads" value={stats.totalLeads} icon={<PeopleAltRounded />} colorHex="#8B5CF6" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="Converted Leads" value={stats.convertedLeads} icon={<TrendingUpRounded />} colorHex="#14B8A6" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="Active Plans" value={stats.activePlans} icon={<CardMembershipRounded />} colorHex="#F59E0B" />
          </Grid>
        </Grid>
      </Box>

      <Box hidden={tabIndex !== 1}>
        <Grid container spacing={3} sx={{ mb: 5 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="Total Doctors" value={stats.totalDoctors} icon={<MedicalServicesRounded />} colorHex="#EC4899" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="Total Patients" value={stats.totalPatients} icon={<HealingRounded />} colorHex="#F59E0B" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="Total Branches" value={stats.totalBranches} icon={<BusinessRounded />} colorHex="#3B82F6" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="Total Users" value={stats.totalUsers} icon={<AssignmentTurnedInRounded />} colorHex="#64748B" />
          </Grid>
        </Grid>
      </Box>

      <Box hidden={tabIndex !== 2}>
        <Grid container spacing={3} sx={{ mb: 5 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="Active Trials" value={stats.activeTrials} icon={<TimerRounded />} colorHex="#EC4899" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="Expired Trials" value={stats.expiredHospitals} icon={<TimerOffRounded />} colorHex="#EF4444" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="Trial Hospitals" value={stats.trialHospitals} icon={<LocalHospitalRounded />} colorHex="#8B5CF6" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard title="Hospital Admins" value={stats.hospitalAdminCount} icon={<AdminPanelSettingsRounded />} colorHex="#4F46E5" />
          </Grid>
        </Grid>
      </Box>

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
