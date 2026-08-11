import { useQuery } from "@tanstack/react-query";
import { ACCENTS, SEMANTIC } from "@/styles/accents";
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
  AssignmentRounded,
  HistoryRounded,
  ArrowForwardIosRounded,
  MedicalServicesRounded,
  EventAvailableRounded,
  BedRounded,
  AddCircleRounded,
  EditRounded,
  RemoveCircleRounded,
} from "@mui/icons-material";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, LabelList } from "recharts";
import { apiErrorText } from "@/utils/apiError";

interface DashboardStats {
  activePlanName: string;
  profileCompletionPercentage: number;
  totalStaff: number;
  activeUsers: number;
  totalDoctors: number;
  totalDepartments: number;
  enabledModules: number;
  todayAppointments: number;
  activeAdmissions: number;
  pendingTasks: { id: string; title: string; completed: boolean; description?: string; path?: string }[];
  recentActivities: { activityLogId: string; action: string; timestamp: string }[];
  staffGrowth: { month: string; count: number }[];
  departmentDistribution: { name: string; count: number }[];
}

const TEAM_BAR = "#818cf8"; // single hue for the staff-by-department magnitude bars

// First word of the humanized action ("Added Doctor" / "Updated Onboarding" /
// "Removed Nursing Note") picks the feed icon + colour — advisory, not a status.
const ACTIVITY_ICON: Record<string, { icon: typeof AddCircleRounded; color: string }> = {
  Added: { icon: AddCircleRounded, color: SEMANTIC.success },
  Updated: { icon: EditRounded, color: SEMANTIC.info },
  Removed: { icon: RemoveCircleRounded, color: SEMANTIC.danger },
};


export default function HospitalDashboard() {
  const { user } = useHospitalAuth();
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

  // Once every setup step is done the guide has served its purpose — hide it so
  // it doesn't permanently occupy the dashboard. Recent Activities then expands
  // to full width (see the Grid `size` below).
  const setupComplete = stats.pendingTasks.length > 0 && stats.pendingTasks.every((t) => t.completed);

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

      {/* Today — live operational signals, distinct from the static org counts below */}
      <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 0.6, display: "block", mb: 1 }}>
        Today
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Appointments Today" value={stats?.todayAppointments ?? 0} icon={<EventAvailableRounded />} color={ACCENTS.reception} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Active Admissions" value={stats?.activeAdmissions ?? 0} icon={<BedRounded />} color={ACCENTS.ipd} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Total Doctors" value={stats?.totalDoctors || 0} icon={<MedicalServicesRounded />} color={SEMANTIC.successLight} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Active Staff" value={stats?.activeUsers || 0} icon={<VerifiedUserRounded />} color="#f472b6" />
        </Grid>
      </Grid>

      {/* Organization — setup-time facts, secondary to what's happening today */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatCard layout="horizontal" label="Total Staff" value={stats?.totalStaff || 0} icon={<PeopleAltRounded />} color="#818cf8" />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatCard layout="horizontal" label="Departments" value={stats?.totalDepartments || 0} icon={<DomainRounded />} color={SEMANTIC.warningLight} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Staff by department — sorted magnitude bars, single hue, direct labels. */}
          <Paper elevation={0} sx={{ p: 2.5, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%", minHeight: 96 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, display: "block", mb: 1 }}>
              Staff by Department
            </Typography>
            {stats?.departmentDistribution && stats.departmentDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(60, stats.departmentDistribution.length * 28)}>
                <BarChart
                  data={[...stats.departmentDistribution].sort((a, b) => b.count - a.count).slice(0, 4)}
                  layout="vertical"
                  margin={{ top: 0, right: 28, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip cursor={{ fill: "rgba(129,140,248,0.08)" }} contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [v, "Staff"]} />
                  <Bar dataKey="count" fill={TEAM_BAR} radius={[0, 4, 4, 0]} barSize={14}>
                    <LabelList dataKey="count" position="right" style={{ fill: "#475569", fontSize: 11, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>No department data yet.</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Two Column Layout for Lists */}
      <Grid container spacing={4}>
        {!setupComplete && (
        <Grid size={{ xs: 12, md: 8 }} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <Paper elevation={0} sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 4, overflow: "hidden" }}>
            <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <AssignmentRounded sx={{ color: "text.secondary" }} />
                <Box>
                  <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 600 }}>Setup Guide</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>A recommended order to get your hospital running — most links are optional and can be revisited anytime.</Typography>
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
        )}

        <Grid size={{ xs: 12, md: setupComplete ? 12 : 4 }}>
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
                    <ListItem sx={{ py: 1.5 }}>
                      {(() => {
                        const verb = activity.action.split(" ")[0];
                        const meta = ACTIVITY_ICON[verb];
                        const Icon = meta?.icon;
                        return Icon ? (
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <Icon sx={{ fontSize: 20, color: meta.color }} />
                          </ListItemIcon>
                        ) : null;
                      })()}
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
