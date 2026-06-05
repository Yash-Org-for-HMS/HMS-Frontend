import { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Skeleton,
  Chip,
  Divider,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  CalendarTodayRounded,
  HowToRegRounded,
  HourglassTopRounded,
  CheckCircleRounded,
  CurrencyRupeeRounded,
  TrendingUpRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useHospitalAuth } from "../../contexts/HospitalAuthContext";

interface AppointmentEntry {
  appointmentId: string;
  appointmentTime: string;
  tokenNumber: number;
  patientId: string | null;
  doctorId: string | null;
  status: { label: string; color: string };
}

interface DashboardStats {
  todaysAppointments: number;
  checkedInPatients: number;
  waitingPatients: number;
  completedVisits: number;
  todaysRevenue: number;
  upcomingAppointments: AppointmentEntry[];
  lastUpdated: string;
}

// Minimalist Square Stat Card
function StatCard({ title, value, icon, loading, prefix }: any) {
  return (
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
            bgcolor: "primary.light",
            color: "primary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.8
          }}
        >
          {icon}
        </Box>
      </Box>
      <Box>
        {loading ? (
          <Skeleton width={80} height={40} />
        ) : (
          <Typography variant="h4" sx={{ fontWeight: 800, color: "text.primary" }}>
            {prefix && <span style={{ fontSize: "1.2rem", marginRight: "4px", color: "text.secondary" }}>{prefix}</span>}
            {typeof value === "number" ? value.toLocaleString("en-IN") : value}
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, mt: 1, display: "block" }}>
          {title}
        </Typography>
      </Box>
    </Paper>
  );
}

export default function ReceptionDashboard() {
  const { hospital } = useHospitalAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosInstance.get("/reception/dashboard/stats");
      setStats(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load dashboard statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <Box sx={{ pb: 6 }}>
      {/* Welcome Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: "text.primary", letterSpacing: "-0.5px" }}>
          Reception Desk
        </Typography>
        <Typography variant="body1" sx={{ color: "text.secondary", mt: 0.5 }}>
          Manage patient flow and front desk operations for {hospital?.name || "the hospital"}.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6 }} sx={{ flexBasis: { md: "20%" }, maxWidth: { md: "20%" } }}>
          <StatCard
            title="Appointments"
            value={stats?.todaysAppointments || 0}
            icon={<CalendarTodayRounded />}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }} sx={{ flexBasis: { md: "20%" }, maxWidth: { md: "20%" } }}>
          <StatCard
            title="Checked In"
            value={stats?.checkedInPatients || 0}
            icon={<HowToRegRounded />}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }} sx={{ flexBasis: { md: "20%" }, maxWidth: { md: "20%" } }}>
          <StatCard
            title="Waiting"
            value={stats?.waitingPatients || 0}
            icon={<HourglassTopRounded />}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }} sx={{ flexBasis: { md: "20%" }, maxWidth: { md: "20%" } }}>
          <StatCard
            title="Completed"
            value={stats?.completedVisits || 0}
            icon={<CheckCircleRounded />}
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }} sx={{ flexBasis: { md: "20%" }, maxWidth: { md: "20%" } }}>
          <StatCard
            title="Today's Revenue"
            value={stats?.todaysRevenue || 0}
            prefix="₹"
            icon={<CurrencyRupeeRounded />}
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* Main Content Area */}
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>
                Upcoming Queue
              </Typography>
            </Box>
            
            <TableContainer>
              <Table size="medium">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider" }}>Token</TableCell>
                    <TableCell sx={{ color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider" }}>Time</TableCell>
                    <TableCell sx={{ color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider" }}>Patient ID</TableCell>
                    <TableCell sx={{ color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider" }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    Array.from(new Array(4)).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton width={30} /></TableCell>
                        <TableCell><Skeleton width={80} /></TableCell>
                        <TableCell><Skeleton width={100} /></TableCell>
                        <TableCell><Skeleton width={70} /></TableCell>
                      </TableRow>
                    ))
                  ) : stats?.upcomingAppointments?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 6, color: "text.secondary" }}>
                        No upcoming appointments in the queue.
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats?.upcomingAppointments?.map((appt) => (
                      <TableRow key={appt.appointmentId} hover>
                        <TableCell sx={{ fontWeight: 700, color: "text.primary" }}>#{appt.tokenNumber}</TableCell>
                        <TableCell sx={{ color: "text.primary" }}>
                          {new Date(appt.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell sx={{ color: "text.primary" }}>
                          {appt.patientId || <Typography variant="caption" sx={{ color: "text.secondary" }}>Unregistered</Typography>}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={appt.status.label} 
                            size="small" 
                            sx={{ 
                              bgcolor: `${appt.status.color}15`, 
                              color: appt.status.color,
                              fontWeight: 600,
                              borderRadius: 1.5
                            }} 
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
        
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", height: "100%" }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary", mb: 2 }}>
              Quick Actions
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
              Use the sidebar navigation to register new patients, schedule appointments, or collect payments.
            </Typography>
            
            {/* Minimalist illustration or placeholder could go here */}
            <Box sx={{ 
              bgcolor: "background.default", 
              borderRadius: 2, 
              p: 3, 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              border: "1px dashed",
              borderColor: "divider",
              mt: 4
            }}>
              <CheckCircleRounded sx={{ fontSize: 40, color: "primary.main", opacity: 0.5, mb: 1 }} />
              <Typography variant="subtitle2" sx={{ color: "text.primary", fontWeight: 600 }}>System Status Normal</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                All reception services are operating properly.
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
