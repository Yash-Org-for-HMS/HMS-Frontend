import { useQuery } from "@tanstack/react-query";
import { SEMANTIC } from "@/styles/accents";
import {
  Box,
  Typography,
  Paper,
  Grid,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  useTheme
} from "@mui/material";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { axiosInstance } from "@/api/axios";
import Mascot from "@/components/Mascot";
import ErrorState from "@/components/ErrorState";
import PageHeader from "@/components/layout/PageHeader";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import StatCard from "@/components/StatCard";
import { useNavigate } from "react-router-dom";
import { 
  PeopleAltRounded,
  DomainRounded,
  VerifiedUserRounded,
  CheckCircleOutlineRounded,
  RadioButtonUncheckedRounded,
  LocalHospitalRounded,
  AssignmentRounded,
  AccountCircleRounded,
  SettingsRounded,
  NotificationsActiveRounded,
  HistoryRounded,
  ArrowForwardIosRounded,
  MedicalServicesRounded
} from "@mui/icons-material";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { apiErrorText } from "@/utils/apiError";

interface DashboardStats {
  activePlanName: string;
  profileCompletionPercentage: number;
  totalStaff: number;
  activeUsers: number;
  totalDoctors: number;
  totalDepartments: number;
  enabledModules: number;
  pendingTasks: { id: string; title: string; completed: boolean; description?: string; path?: string }[];
  recentActivities: { activityLogId: string; action: string; timestamp: string }[];
  recentNotifications: { id: string; message: string; timestamp: string }[];
  staffGrowth: { month: string; count: number }[];
  departmentDistribution: { name: string; count: number }[];
}

const COLORS = [SEMANTIC.success, SEMANTIC.info, SEMANTIC.warning, "#ec4899", "#8b5cf6", "#06b6d4"];


export default function HospitalDashboard() {
  const { user } = useHospitalAuth();
  const theme = useTheme();
  const navigate = useNavigate();
  const { data: stats, isLoading: loading, isError, error, refetch } = useQuery<DashboardStats>({
    queryKey: ["hospital-dashboard-stats"],
    queryFn: async () => (await axiosInstance.get("/hospital/dashboard/stats")).data.data,
  });

  if (loading) {
    return (
      <DashboardSkeleton />
    );
  }

  if (isError || !stats) {
    return (
      <Box sx={{ pb: 6 }}>
        <ErrorState
          title="Couldn't load the dashboard"
          message={apiErrorText(error)}
          onRetry={() => refetch()}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 6 }}>
      <PageHeader
        title="Hospital Dashboard"
        subtitle={`Welcome back, ${user?.firstName} ${user?.lastName}. Here's what's happening today.`}
        actions={
          stats?.activePlanName ? (
            <Chip
              label={`Active Plan: ${stats.activePlanName}`}
              sx={{ bgcolor: "background.paper", color: "text.primary", fontWeight: 600, px: 1, border: "1px solid", borderColor: "divider" }}
            />
          ) : undefined
        }
      />

      {/* Primary Metrics Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6 }} sx={{ flexBasis: { md: "20%" }, maxWidth: { md: "20%" } }}>
          <StatCard 
            label="Total Staff"
            value={stats?.totalStaff || 0} 
            icon={<PeopleAltRounded />} 
            color="#818cf8" 
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }} sx={{ flexBasis: { md: "20%" }, maxWidth: { md: "20%" } }}>
          <StatCard 
            label="Total Doctors"
            value={stats?.totalDoctors || 0} 
            icon={<MedicalServicesRounded />} 
            color={SEMANTIC.successLight} 
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }} sx={{ flexBasis: { md: "20%" }, maxWidth: { md: "20%" } }}>
          <StatCard 
            label="Departments"
            value={stats?.totalDepartments || 0} 
            icon={<DomainRounded />} 
            color={SEMANTIC.warningLight} 
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }} sx={{ flexBasis: { md: "20%" }, maxWidth: { md: "20%" } }}>
          <StatCard 
            label="Active Users"
            value={stats?.activeUsers || 0} 
            icon={<VerifiedUserRounded />} 
            color="#f472b6" 
          />
        </Grid>
      </Grid>

      {/* Analytics Charts Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 4, height: 350 }}>
            <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 600, mb: 3 }}>Staff Onboarding</Typography>
            <ResponsiveContainer width="100%" height="80%">
              <LineChart data={stats?.staffGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                <XAxis dataKey="month" stroke={theme.palette.text.secondary} tick={{fill: theme.palette.text.secondary, fontSize: 12}} />
                <YAxis stroke={theme.palette.text.secondary} tick={{fill: theme.palette.text.secondary, fontSize: 12}} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: theme.palette.background.paper, borderColor: theme.palette.divider, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
                  itemStyle={{ color: theme.palette.text.primary, fontWeight: 600 }}
                />
                <Line type="monotone" dataKey="count" stroke={theme.palette.primary.main} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 4, height: 350 }}>
            <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 600, mb: 3 }}>Staff Distribution</Typography>
            {stats?.departmentDistribution && stats.departmentDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={stats.departmentDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="count"
                  >
                    {stats.departmentDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: theme.palette.background.paper, borderColor: theme.palette.divider, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
                    itemStyle={{ color: theme.palette.text.primary, fontWeight: 600 }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: "12px", color: theme.palette.text.primary }}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80%" }}>
                <Mascot pose="nothing-here-yet" subtitle="No department data available." size={120} />
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Two Column Layout for Lists */}
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 8 }} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <Paper elevation={0} sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 4, overflow: "hidden" }}>
            <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <AssignmentRounded sx={{ color: "text.secondary" }} />
                <Box>
                  <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 600 }}>Setup Guide</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Complete these steps in order to get your hospital running.</Typography>
                </Box>
              </Box>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, whiteSpace: "nowrap" }}>
                {stats?.pendingTasks.filter((t) => t.completed).length ?? 0} of {stats?.pendingTasks.length ?? 0} done
              </Typography>
            </Box>
            <List disablePadding>
              {stats?.pendingTasks.map((task, index) => (
                <Box key={task.id}>
                  <ListItemButton
                    onClick={() => task.path && navigate(task.path)}
                    sx={{ py: 2, alignItems: "flex-start" }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, mt: 0.25 }}>
                      {task.completed ? (
                        <CheckCircleOutlineRounded sx={{ color: "success.main" }} />
                      ) : (
                        <RadioButtonUncheckedRounded sx={{ color: "text.disabled" }} />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={`${index + 1}. ${task.title}`}
                      secondary={task.description}
                      primaryTypographyProps={{
                        color: task.completed ? "text.disabled" : "text.primary",
                        fontWeight: task.completed ? 500 : 700,
                        sx: { textDecoration: task.completed ? "line-through" : "none" }
                      }}
                      secondaryTypographyProps={{ color: "text.secondary", sx: { mt: 0.25 } }}
                    />
                    {!task.completed && (
                      <ArrowForwardIosRounded sx={{ fontSize: 14, color: "text.disabled", mt: 1, ml: 1, flexShrink: 0 }} />
                    )}
                  </ListItemButton>
                  {index < stats.pendingTasks.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper elevation={0} sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 4, overflow: "hidden", height: "100%" }}>
            <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 1.5 }}>
              <HistoryRounded sx={{ color: "text.secondary" }} />
              <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 600 }}>Recent Activities</Typography>
            </Box>
            <List disablePadding>
              {stats?.recentActivities.length === 0 ? (
                <ListItem sx={{ py: 2, justifyContent: "center" }}>
                  <Mascot pose="nothing-here-yet" subtitle="No recent activities found." size={120} />
                </ListItem>
              ) : (
                stats?.recentActivities.map((activity, index) => (
                  <Box key={activity.activityLogId}>
                    <ListItem sx={{ py: 2 }}>
                      <ListItemText 
                        primary={activity.action} 
                        secondary={new Date(activity.timestamp).toLocaleString()}
                        primaryTypographyProps={{ color: "text.primary", fontWeight: 500, fontSize: "0.875rem" }}
                        secondaryTypographyProps={{ color: "text.secondary", fontSize: "0.875rem", mt: 0.5 }}
                      />
                    </ListItem>
                    {index < stats.recentActivities.length - 1 && <Divider />}
                  </Box>
                ))
              )}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
