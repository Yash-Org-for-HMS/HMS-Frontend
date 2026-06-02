import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Container,
  Typography,
  Paper,
  CircularProgress,
  Divider,
  Avatar,
  Chip,
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
} from "recharts";
import { axiosInstance } from "../api/axios";

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
  onboardingProgress: Array<{ status: string; count: number }>;
  leadsByStatus: Array<{ status: string; count: number }>;
  hospitalsTrend: Array<{ month: string; count: number }>;
  recentActivities: Array<any>;
}

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6"];

export default function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

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
        <CircularProgress sx={{ color: "#6366f1" }} />
      </Box>
    );
  }

  if (!stats) return null;

  const StatCard = ({ title, value, icon, gradient, delay }: any) => (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        bgcolor: "rgba(30, 41, 59, 0.7)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        gap: 3,
        transition: "transform 0.3s ease, box-shadow 0.3s ease",
        animation: `fadeInUp 0.6s ease-out ${delay}s both`,
        "&:hover": {
          transform: "translateY(-5px)",
          boxShadow: `0 10px 25px -5px ${gradient.split(" ")[1]}40`,
          border: `1px solid ${gradient.split(" ")[1]}80`,
        },
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: 3,
          background: gradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 8px 16px -4px ${gradient.split(" ")[1]}60`,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="body2" sx={{ color: "#94a3b8", fontWeight: 600, mb: 0.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {title}
        </Typography>
        <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 800 }}>
          {value}
        </Typography>
      </Box>
    </Paper>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 5, animation: "fadeInDown 0.6s ease-out" }}>
        <Typography variant="h3" fontWeight="800" sx={{ color: "#f8fafc", mb: 1, letterSpacing: "-1px" }}>
          {t("dashboard.title")}
        </Typography>
        <Typography variant="subtitle1" sx={{ color: "#94a3b8", fontWeight: 500 }}>
          {t("dashboard.subtitle")}
        </Typography>
      </Box>

      {/* Primary Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title={t("dashboard.totalHospitals")}
            value={stats.totalHospitals}
            icon={<LocalHospitalRounded sx={{ color: "#fff", fontSize: 28 }} />}
            gradient="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
            delay={0.1}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title={t("dashboard.activeHospitals")}
            value={stats.activeHospitals}
            icon={<CheckCircleRounded sx={{ color: "#fff", fontSize: 28 }} />}
            gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
            delay={0.2}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title={t("dashboard.totalLeads")}
            value={stats.totalLeads}
            icon={<PeopleAltRounded sx={{ color: "#fff", fontSize: 28 }} />}
            gradient="linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
            delay={0.3}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title={t("dashboard.activePlans")}
            value={stats.activePlans}
            icon={<CardMembershipRounded sx={{ color: "#fff", fontSize: 28 }} />}
            gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
            delay={0.4}
          />
        </Grid>
      </Grid>

      {/* Secondary Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title={t("dashboard.activeTrials")}
            value={stats.activeTrials}
            icon={<TimerRounded sx={{ color: "#fff", fontSize: 28 }} />}
            gradient="linear-gradient(135deg, #ec4899 0%, #db2777 100%)"
            delay={0.5}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title={t("dashboard.convertedLeads")}
            value={stats.convertedLeads}
            icon={<TrendingUpRounded sx={{ color: "#fff", fontSize: 28 }} />}
            gradient="linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)"
            delay={0.6}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title={t("dashboard.hospitalAdmins")}
            value={stats.hospitalAdminCount}
            icon={<AdminPanelSettingsRounded sx={{ color: "#fff", fontSize: 28 }} />}
            gradient="linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
            delay={0.7}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title={t("dashboard.totalUsers")}
            value={stats.totalUsers}
            icon={<AssignmentTurnedInRounded sx={{ color: "#fff", fontSize: 28 }} />}
            gradient="linear-gradient(135deg, #64748b 0%, #475569 100%)"
            delay={0.8}
          />
        </Grid>
      </Grid>

      {/* Charts Section */}
      <Grid container spacing={4} sx={{ mb: 5 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              bgcolor: "rgba(30, 41, 59, 0.7)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 4,
              height: 400,
              animation: "fadeInUp 0.6s ease-out 0.9s both",
            }}
          >
            <Typography variant="h6" sx={{ color: "#f8fafc", mb: 3, fontWeight: 700 }}>
              {t("dashboard.leadsByStatus")}
            </Typography>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={stats.leadsByStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="status" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#f8fafc" }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              bgcolor: "rgba(30, 41, 59, 0.7)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 4,
              height: 400,
              animation: "fadeInUp 0.6s ease-out 1s both",
            }}
          >
            <Typography variant="h6" sx={{ color: "#f8fafc", mb: 3, fontWeight: 700 }}>
              {t("dashboard.onboardingProgress")}
            </Typography>
            <ResponsiveContainer width="100%" height="85%">
              <PieChart>
                <Pie
                  data={stats.onboardingProgress}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="status"
                >
                  {stats.onboardingProgress.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#f8fafc" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Activity List */}
      <Paper
        elevation={0}
        sx={{
          p: 0,
          bgcolor: "rgba(30, 41, 59, 0.7)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 4,
          overflow: "hidden",
          animation: "fadeInUp 0.6s ease-out 1.1s both",
        }}
      >
        <Box sx={{ p: 3, borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 700 }}>
            {t("dashboard.recentActivity")}
          </Typography>
        </Box>
        <Box sx={{ px: 3, py: 1 }}>
          {stats.recentActivities.length === 0 ? (
            <Typography sx={{ color: "#94a3b8", py: 3, textAlign: "center" }}>
              {t("common.noData")}
            </Typography>
          ) : (
            stats.recentActivities.map((activity, index) => (
              <Box key={activity.activityLogId}>
                <Box sx={{ py: 2.5, display: "flex", alignItems: "flex-start", gap: 3 }}>
                  <Avatar
                    sx={{
                      bgcolor: "rgba(99, 102, 241, 0.1)",
                      color: "#818cf8",
                      border: "1px solid rgba(99, 102, 241, 0.2)",
                    }}
                  >
                    {activity.moduleName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography sx={{ color: "#f8fafc", fontWeight: 500, mb: 0.5 }}>
                      {activity.description}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Chip
                        label={activity.moduleName}
                        size="small"
                        sx={{
                          bgcolor: "rgba(255, 255, 255, 0.05)",
                          color: "#cbd5e1",
                          height: 20,
                          fontSize: "0.7rem",
                          border: "1px solid rgba(255, 255, 255, 0.1)"
                        }}
                      />
                      <Typography variant="caption" sx={{ color: "#64748b" }}>
                        {new Date(activity.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                {index < stats.recentActivities.length - 1 && (
                  <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.05)" }} />
                )}
              </Box>
            ))
          )}
        </Box>
      </Paper>
    </Container>
  );
}
