import { useState, useEffect } from "react";
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Card, 
  CircularProgress,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  useTheme
} from "@mui/material";
import { useHospitalAuth } from "../../contexts/HospitalAuthContext";
import { axiosInstance } from "../../api/axios";
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

interface DashboardStats {
  profileCompletionPercentage: number;
  totalStaff: number;
  activeUsers: number;
  totalDoctors: number;
  totalDepartments: number;
  enabledModules: number;
  pendingTasks: { id: string; title: string; completed: boolean }[];
  recentActivities: { activityLogId: string; action: string; timestamp: string }[];
  recentNotifications: { id: string; message: string; timestamp: string }[];
  staffGrowth: { month: string; count: number }[];
  departmentDistribution: { name: string; count: number }[];
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

export default function HospitalDashboard() {
  const { user } = useHospitalAuth();
  const theme = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axiosInstance.get("/hospital/dashboard/stats");
        setStats(res.data.data);
      } catch (err) {
        console.error("Failed to fetch dashboard stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: theme.palette.primary.main }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: "text.primary", mb: 1 }}>
            Hospital Dashboard
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            Welcome back, {user?.firstName} {user?.lastName}. Here's what's happening today.
          </Typography>
        </Box>
      </Box>

      {/* Primary Metrics Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card
            elevation={0}
            sx={{
              p: 3,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              gap: 3,
              height: "100%",
            }}
          >
            <Box sx={{ position: "relative", display: "inline-flex" }}>
              <CircularProgress 
                variant="determinate" 
                value={100} 
                size={64}
                thickness={4}
                sx={{ color: theme.palette.mode === "dark" ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0.1)" }} 
              />
              <CircularProgress 
                variant="determinate" 
                value={stats?.profileCompletionPercentage || 0} 
                size={64}
                thickness={4}
                sx={{ 
                  color: "#10b981", 
                  position: "absolute",
                  left: 0,
                }} 
              />
              <Box
                sx={{
                  top: 0,
                  left: 0,
                  bottom: 0,
                  right: 0,
                  position: "absolute",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography variant="caption" component="div" color="text.primary" fontWeight="bold">
                  {stats?.profileCompletionPercentage}%
                </Typography>
              </Box>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>Profile Completion</Typography>
              <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700 }}>
                {stats?.profileCompletionPercentage === 100 ? "Complete" : "Action Needed"}
              </Typography>
            </Box>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={9}>
          <Grid container spacing={2}>
            {/* Staff Card */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                  <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: "rgba(99, 102, 241, 0.1)", color: "#818cf8", display: "flex" }}>
                    <PeopleAltRounded fontSize="small" />
                  </Box>
                  <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600 }}>Total Staff</Typography>
                </Box>
                <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 700 }}>{stats?.totalStaff}</Typography>
              </Paper>
            </Grid>
            {/* Doctors Card */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                  <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: "rgba(16, 185, 129, 0.1)", color: "#34d399", display: "flex" }}>
                    <MedicalServicesRounded fontSize="small" />
                  </Box>
                  <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600 }}>Total Doctors</Typography>
                </Box>
                <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 700 }}>{stats?.totalDoctors}</Typography>
              </Paper>
            </Grid>
            {/* Departments Card */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                  <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: "rgba(245, 158, 11, 0.1)", color: "#fbbf24", display: "flex" }}>
                    <DomainRounded fontSize="small" />
                  </Box>
                  <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600 }}>Departments</Typography>
                </Box>
                <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 700 }}>{stats?.totalDepartments}</Typography>
              </Paper>
            </Grid>
            {/* Active Users Card */}
            <Grid item xs={12} sm={6} md={3}>
              <Paper elevation={0} sx={{ p: 2, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                  <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: "rgba(236, 72, 153, 0.1)", color: "#f472b6", display: "flex" }}>
                    <VerifiedUserRounded fontSize="small" />
                  </Box>
                  <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600 }}>Active Users</Typography>
                </Box>
                <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 700 }}>{stats?.activeUsers}</Typography>
              </Paper>
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {/* Analytics Charts Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={7}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, height: 350 }}>
            <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 600, mb: 3 }}>Staff Onboarding (Last 6 Months)</Typography>
            <ResponsiveContainer width="100%" height="80%">
              <LineChart data={stats?.staffGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                <XAxis dataKey="month" stroke={theme.palette.text.secondary} tick={{fill: theme.palette.text.secondary}} />
                <YAxis stroke={theme.palette.text.secondary} tick={{fill: theme.palette.text.secondary}} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: theme.palette.background.paper, borderColor: theme.palette.divider, borderRadius: 8 }}
                  itemStyle={{ color: theme.palette.text.primary }}
                />
                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper elevation={0} sx={{ p: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, height: 350 }}>
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
                    paddingAngle={5}
                    dataKey="count"
                  >
                    {stats.departmentDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: theme.palette.background.paper, borderColor: theme.palette.divider, borderRadius: 8 }}
                    itemStyle={{ color: theme.palette.text.primary }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: theme.palette.text.primary }}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80%" }}>
                <Typography color="text.secondary">No department data available</Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Quick Actions Row */}
      <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 600, mb: 2 }}>
        Dashboard Actions
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            onClick={() => navigate("/hospital/profile")}
            sx={{
              p: 2.5,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 1.5,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              cursor: "pointer",
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                borderColor: "#10b981",
                bgcolor: "rgba(16, 185, 129, 0.03)",
                transform: "translateY(-4px)",
                boxShadow: "0 10px 15px -3px rgba(16, 185, 129, 0.1), 0 4px 6px -4px rgba(16, 185, 129, 0.1)"
              }
            }}
          >
            <Box sx={{ p: 1.5, borderRadius: "50%", bgcolor: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}>
              <LocalHospitalRounded fontSize="large" />
            </Box>
            <Typography variant="body1" sx={{ color: "text.primary", fontWeight: 600 }}>Complete Profile</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            onClick={() => navigate("/hospital/departments")}
            sx={{
              p: 2.5,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 1.5,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              cursor: "pointer",
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                borderColor: "#818cf8",
                bgcolor: "rgba(129, 140, 248, 0.03)",
                transform: "translateY(-4px)",
                boxShadow: "0 10px 15px -3px rgba(129, 140, 248, 0.1), 0 4px 6px -4px rgba(129, 140, 248, 0.1)"
              }
            }}
          >
            <Box sx={{ p: 1.5, borderRadius: "50%", bgcolor: "rgba(129, 140, 248, 0.1)", color: "#818cf8" }}>
              <AssignmentRounded fontSize="large" />
            </Box>
            <Typography variant="body1" sx={{ color: "text.primary", fontWeight: 600 }}>Manage Departments</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            onClick={() => navigate("/hospital/users")}
            sx={{
              p: 2.5,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 1.5,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              cursor: "pointer",
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                borderColor: "#fbbf24",
                bgcolor: "rgba(251, 191, 36, 0.03)",
                transform: "translateY(-4px)",
                boxShadow: "0 10px 15px -3px rgba(251, 191, 36, 0.1), 0 4px 6px -4px rgba(251, 191, 36, 0.1)"
              }
            }}
          >
            <Box sx={{ p: 1.5, borderRadius: "50%", bgcolor: "rgba(251, 191, 36, 0.1)", color: "#fbbf24" }}>
              <AccountCircleRounded fontSize="large" />
            </Box>
            <Typography variant="body1" sx={{ color: "text.primary", fontWeight: 600 }}>Manage Staff</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            onClick={() => navigate("/hospital/settings/modules")}
            sx={{
              p: 2.5,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 1.5,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              cursor: "pointer",
              transition: "all 0.2s ease-in-out",
              "&:hover": {
                borderColor: "#38bdf8",
                bgcolor: "rgba(56, 189, 248, 0.03)",
                transform: "translateY(-4px)",
                boxShadow: "0 10px 15px -3px rgba(56, 189, 248, 0.1), 0 4px 6px -4px rgba(56, 189, 248, 0.1)"
              }
            }}
          >
            <Box sx={{ p: 1.5, borderRadius: "50%", bgcolor: "rgba(56, 189, 248, 0.1)", color: "#38bdf8" }}>
              <SettingsRounded fontSize="large" />
            </Box>
            <Typography variant="body1" sx={{ color: "text.primary", fontWeight: 600 }}>Configure Settings</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Two Column Layout for Lists */}
      <Grid container spacing={3}>
        {/* Left Column */}
        <Grid item xs={12} md={6} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Pending Tasks */}
          <Paper elevation={0} sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>
            <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 1.5 }}>
              <AssignmentRounded sx={{ color: "#818cf8" }} />
              <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 600 }}>Pending Setup Tasks</Typography>
            </Box>
            <List disablePadding>
              {stats?.pendingTasks.map((task, index) => (
                <Box key={task.id}>
                  <ListItem sx={{ py: 2 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {task.completed ? (
                        <CheckCircleOutlineRounded sx={{ color: "#10b981" }} />
                      ) : (
                        <RadioButtonUncheckedRounded sx={{ color: "text.secondary" }} />
                      )}
                    </ListItemIcon>
                    <ListItemText 
                      primary={task.title} 
                      primaryTypographyProps={{ 
                        color: task.completed ? "text.secondary" : "text.primary",
                        fontWeight: task.completed ? 400 : 500,
                        sx: { textDecoration: task.completed ? "line-through" : "none" }
                      }} 
                    />
                    {!task.completed && (
                      <Chip label="Action Required" size="small" sx={{ bgcolor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", fontWeight: 600 }} />
                    )}
                  </ListItem>
                  {index < stats.pendingTasks.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          </Paper>

          {/* Recent Activities */}
          <Paper elevation={0} sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>
            <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 1.5 }}>
              <HistoryRounded sx={{ color: "text.secondary" }} />
              <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 600 }}>Recent Activities</Typography>
            </Box>
            <List disablePadding>
              {stats?.recentActivities.length === 0 ? (
                <ListItem sx={{ py: 4, justifyContent: "center" }}>
                  <Typography variant="body2" color="text.secondary">No recent activities found.</Typography>
                </ListItem>
              ) : (
                stats?.recentActivities.map((activity, index) => (
                  <Box key={activity.activityLogId}>
                    <ListItem sx={{ py: 2 }}>
                      <ListItemText 
                        primary={activity.action} 
                        secondary={new Date(activity.timestamp).toLocaleString()}
                        primaryTypographyProps={{ color: "text.primary", fontWeight: 500, fontSize: "0.9rem" }}
                        secondaryTypographyProps={{ color: "text.secondary", fontSize: "0.8rem", mt: 0.5 }}
                      />
                    </ListItem>
                    {index < stats.recentActivities.length - 1 && <Divider />}
                  </Box>
                ))
              )}
            </List>
          </Paper>
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden", height: "100%" }}>
            <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 1.5 }}>
              <NotificationsActiveRounded sx={{ color: "#fbbf24" }} />
              <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 600 }}>Recent Notifications</Typography>
            </Box>
            <List disablePadding>
              {stats?.recentNotifications.length === 0 ? (
                <ListItem sx={{ py: 4, justifyContent: "center" }}>
                  <Typography variant="body2" color="text.secondary">You're all caught up!</Typography>
                </ListItem>
              ) : (
                stats?.recentNotifications.map((notification, index) => (
                  <Box key={notification.id}>
                    <ListItem sx={{ py: 2.5, alignItems: "flex-start" }}>
                      <Box sx={{ mt: 0.5, mr: 2, p: 0.5, bgcolor: "rgba(99, 102, 241, 0.1)", borderRadius: "50%", display: "flex" }}>
                        <ArrowForwardIosRounded sx={{ fontSize: 12, color: "#818cf8" }} />
                      </Box>
                      <ListItemText 
                        primary={notification.message} 
                        secondary={new Date(notification.timestamp).toLocaleString()}
                        primaryTypographyProps={{ color: "text.primary", fontWeight: 500, mb: 0.5 }}
                        secondaryTypographyProps={{ color: "text.secondary", fontSize: "0.8rem" }}
                      />
                    </ListItem>
                    {index < stats.recentNotifications.length - 1 && <Divider />}
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
