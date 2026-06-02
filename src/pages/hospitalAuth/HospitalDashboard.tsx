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
  Chip
} from "@mui/material";
import { useHospitalAuth } from "../../contexts/HospitalAuthContext";
import { axiosInstance } from "../../api/axios";
import { 
  PeopleAltRounded,
  DomainRounded,
  ToggleOnRounded,
  VerifiedUserRounded,
  CheckCircleOutlineRounded,
  RadioButtonUncheckedRounded,
  LocalHospitalRounded,
  AssignmentRounded,
  AccountCircleRounded,
  SettingsRounded,
  NotificationsActiveRounded,
  HistoryRounded,
  ArrowForwardIosRounded
} from "@mui/icons-material";

interface DashboardStats {
  profileCompletionPercentage: number;
  totalStaff: number;
  activeUsers: number;
  totalDepartments: number;
  enabledModules: number;
  pendingTasks: { id: string; title: string; completed: boolean }[];
  recentActivities: { activityLogId: string; action: string; timestamp: string }[];
  recentNotifications: { id: string; message: string; timestamp: string }[];
}

export default function HospitalDashboard() {
  const { user } = useHospitalAuth();
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
        <CircularProgress sx={{ color: "#10b981" }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: "#f8fafc", mb: 1 }}>
            Hospital Dashboard
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            Welcome back, {user?.firstName} {user?.lastName}. Here's what's happening today.
          </Typography>
        </Box>
      </Box>

      {/* Primary Metrics Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card
            sx={{
              p: 3,
              bgcolor: "rgba(30, 41, 59, 0.5)",
              border: "1px solid rgba(255,255,255,0.05)",
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
                sx={{ color: "rgba(16, 185, 129, 0.2)" }} 
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
                <Typography variant="caption" component="div" color="#f8fafc" fontWeight="bold">
                  {stats?.profileCompletionPercentage}%
                </Typography>
              </Box>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: "#94a3b8", mb: 0.5 }}>Profile Completion</Typography>
              <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 700 }}>
                {stats?.profileCompletionPercentage === 100 ? "Complete" : "Action Needed"}
              </Typography>
            </Box>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={9}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 3, bgcolor: "rgba(30, 41, 59, 0.5)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 3, height: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                  <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: "rgba(99, 102, 241, 0.1)", color: "#818cf8", display: "flex" }}>
                    <PeopleAltRounded fontSize="small" />
                  </Box>
                  <Typography variant="body2" sx={{ color: "#94a3b8", fontWeight: 600 }}>Total Staff</Typography>
                </Box>
                <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 700 }}>{stats?.totalStaff}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 3, bgcolor: "rgba(30, 41, 59, 0.5)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 3, height: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                  <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: "rgba(245, 158, 11, 0.1)", color: "#fbbf24", display: "flex" }}>
                    <DomainRounded fontSize="small" />
                  </Box>
                  <Typography variant="body2" sx={{ color: "#94a3b8", fontWeight: 600 }}>Departments</Typography>
                </Box>
                <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 700 }}>{stats?.totalDepartments}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 3, bgcolor: "rgba(30, 41, 59, 0.5)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 3, height: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                  <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: "rgba(16, 185, 129, 0.1)", color: "#34d399", display: "flex" }}>
                    <VerifiedUserRounded fontSize="small" />
                  </Box>
                  <Typography variant="body2" sx={{ color: "#94a3b8", fontWeight: 600 }}>Active Users</Typography>
                </Box>
                <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 700 }}>{stats?.activeUsers}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 3, bgcolor: "rgba(30, 41, 59, 0.5)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 3, height: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                  <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: "rgba(236, 72, 153, 0.1)", color: "#f472b6", display: "flex" }}>
                    <ToggleOnRounded fontSize="small" />
                  </Box>
                  <Typography variant="body2" sx={{ color: "#94a3b8", fontWeight: 600 }}>Enabled Modules</Typography>
                </Box>
                <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 700 }}>{stats?.enabledModules}</Typography>
              </Paper>
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {/* Quick Actions Row */}
      <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 600, mb: 2 }}>
        Dashboard Actions
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<LocalHospitalRounded />}
            sx={{
              py: 1.5,
              justifyContent: "flex-start",
              bgcolor: "rgba(16, 185, 129, 0.1)",
              color: "#10b981",
              border: "1px solid rgba(16, 185, 129, 0.2)",
              "&:hover": { bgcolor: "rgba(16, 185, 129, 0.2)" },
              textTransform: "none",
              fontWeight: 600
            }}
          >
            Complete Hospital Profile
          </Button>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<AssignmentRounded />}
            sx={{
              py: 1.5,
              justifyContent: "flex-start",
              bgcolor: "rgba(99, 102, 241, 0.1)",
              color: "#818cf8",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              "&:hover": { bgcolor: "rgba(99, 102, 241, 0.2)" },
              textTransform: "none",
              fontWeight: 600
            }}
          >
            Create Department
          </Button>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<AccountCircleRounded />}
            sx={{
              py: 1.5,
              justifyContent: "flex-start",
              bgcolor: "rgba(245, 158, 11, 0.1)",
              color: "#fbbf24",
              border: "1px solid rgba(245, 158, 11, 0.2)",
              "&:hover": { bgcolor: "rgba(245, 158, 11, 0.2)" },
              textTransform: "none",
              fontWeight: 600
            }}
          >
            Create Staff
          </Button>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<SettingsRounded />}
            sx={{
              py: 1.5,
              justifyContent: "flex-start",
              bgcolor: "rgba(148, 163, 184, 0.1)",
              color: "#cbd5e1",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              "&:hover": { bgcolor: "rgba(148, 163, 184, 0.2)" },
              textTransform: "none",
              fontWeight: 600
            }}
          >
            Configure Settings
          </Button>
        </Grid>
      </Grid>

      {/* Two Column Layout for Lists */}
      <Grid container spacing={3}>
        {/* Left Column */}
        <Grid item xs={12} md={6} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Pending Tasks */}
          <Paper sx={{ bgcolor: "rgba(30, 41, 59, 0.5)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
            <Box sx={{ p: 2, borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 1.5 }}>
              <AssignmentRounded sx={{ color: "#818cf8" }} />
              <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 600 }}>Pending Setup Tasks</Typography>
            </Box>
            <List disablePadding>
              {stats?.pendingTasks.map((task, index) => (
                <Box key={task.id}>
                  <ListItem sx={{ py: 2 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {task.completed ? (
                        <CheckCircleOutlineRounded sx={{ color: "#10b981" }} />
                      ) : (
                        <RadioButtonUncheckedRounded sx={{ color: "#64748b" }} />
                      )}
                    </ListItemIcon>
                    <ListItemText 
                      primary={task.title} 
                      primaryTypographyProps={{ 
                        color: task.completed ? "#94a3b8" : "#f1f5f9",
                        fontWeight: task.completed ? 400 : 500,
                        sx: { textDecoration: task.completed ? "line-through" : "none" }
                      }} 
                    />
                    {!task.completed && (
                      <Chip label="Action Required" size="small" sx={{ bgcolor: "rgba(239, 68, 68, 0.1)", color: "#f87171", fontWeight: 600 }} />
                    )}
                  </ListItem>
                  {index < stats.pendingTasks.length - 1 && <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />}
                </Box>
              ))}
            </List>
          </Paper>

          {/* Recent Activities */}
          <Paper sx={{ bgcolor: "rgba(30, 41, 59, 0.5)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
            <Box sx={{ p: 2, borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 1.5 }}>
              <HistoryRounded sx={{ color: "#94a3b8" }} />
              <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 600 }}>Recent Activities</Typography>
            </Box>
            <List disablePadding>
              {stats?.recentActivities.length === 0 ? (
                <ListItem sx={{ py: 4, justifyContent: "center" }}>
                  <Typography variant="body2" color="#64748b">No recent activities found.</Typography>
                </ListItem>
              ) : (
                stats?.recentActivities.map((activity, index) => (
                  <Box key={activity.activityLogId}>
                    <ListItem sx={{ py: 2 }}>
                      <ListItemText 
                        primary={activity.action} 
                        secondary={new Date(activity.timestamp).toLocaleString()}
                        primaryTypographyProps={{ color: "#e2e8f0", fontWeight: 500, fontSize: "0.9rem" }}
                        secondaryTypographyProps={{ color: "#64748b", fontSize: "0.8rem", mt: 0.5 }}
                      />
                    </ListItem>
                    {index < stats.recentActivities.length - 1 && <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />}
                  </Box>
                ))
              )}
            </List>
          </Paper>
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ bgcolor: "rgba(30, 41, 59, 0.5)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden", height: "100%" }}>
            <Box sx={{ p: 2, borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 1.5 }}>
              <NotificationsActiveRounded sx={{ color: "#fbbf24" }} />
              <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 600 }}>Recent Notifications</Typography>
            </Box>
            <List disablePadding>
              {stats?.recentNotifications.length === 0 ? (
                <ListItem sx={{ py: 4, justifyContent: "center" }}>
                  <Typography variant="body2" color="#64748b">You're all caught up!</Typography>
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
                        primaryTypographyProps={{ color: "#f1f5f9", fontWeight: 500, mb: 0.5 }}
                        secondaryTypographyProps={{ color: "#64748b", fontSize: "0.8rem" }}
                      />
                    </ListItem>
                    {index < stats.recentNotifications.length - 1 && <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />}
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
