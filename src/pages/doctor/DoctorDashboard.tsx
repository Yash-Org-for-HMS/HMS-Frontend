import { useState, useEffect } from "react";
import {
  Box, Grid, Typography, Paper, CircularProgress, Alert,
  Skeleton, Chip, Avatar, Button, Divider
} from "@mui/material";
import {
  MonitorHeartRounded, CheckCircleRounded, HourglassTopRounded,
  PeopleAltRounded, ArrowForwardRounded, LocalHospitalRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useHospitalAuth } from "../../contexts/HospitalAuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";

const DOCTOR_BLUE = "#3b82f6";

function StatCard({ title, value, icon, loading, accent, sub }: any) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3, borderRadius: 4,
        bgcolor: "background.paper",
        border: "1px solid", borderColor: "divider",
        transition: "all 0.2s ease-in-out",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        minHeight: 170, height: "auto",
        "&:hover": { boxShadow: `0 8px 30px rgba(0,0,0,0.06)`, transform: "translateY(-2px)" },
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box
          sx={{
            width: 48, height: 48, borderRadius: 3,
            bgcolor: accent ? `${accent}18` : "rgba(59,130,246,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
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
            {typeof value === "number" ? value.toLocaleString() : value}
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, display: "block", mt: 0.5 }}>
          {title}
        </Typography>
        {sub && (
          <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.68rem", display: "block", mt: 0.5 }}>
            {sub}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

export default function DoctorDashboard() {
  const { hospital, user } = useHospitalAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const [stats, setStats] = useState<any>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/doctor/dashboard/stats");
      setStats(res.data.data);
    } catch (err: any) {
      console.error("Dashboard error full:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to load dashboard statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <Box sx={{ pb: 6 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <Box
            sx={{
              width: 36, height: 36, borderRadius: 1.5,
              background: `linear-gradient(135deg, #2563eb, #3b82f6)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <LocalHospitalRounded sx={{ color: "#fff", fontSize: 20 }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "text.primary", letterSpacing: "-0.5px" }}>
            Welcome, Dr. {user?.lastName}
          </Typography>
        </Box>
        <Typography variant="body1" sx={{ color: "text.secondary", mt: 0.5, ml: 0.5 }}>
          Here is your schedule for today at {hospital?.name || "the hospital"}.
        </Typography>
      </Box>
{/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Today's Appointments"
            value={stats?.todaysAppointments || 0}
            icon={<PeopleAltRounded sx={{ color: DOCTOR_BLUE }} />}
            loading={loading}
            accent={DOCTOR_BLUE}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Waiting Patients"
            value={stats?.waitingPatients || 0}
            icon={<HourglassTopRounded sx={{ color: "#f59e0b" }} />}
            loading={loading}
            accent="#f59e0b"
            sub="Checked in, ready to be seen"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Vitals Recorded"
            value={stats?.vitalsRecorded || 0}
            icon={<MonitorHeartRounded sx={{ color: "#10b981" }} />}
            loading={loading}
            accent="#10b981"
            sub="Pre-consultation complete"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Completed Consultations"
            value={stats?.completedVisits || 0}
            icon={<CheckCircleRounded sx={{ color: "#8b5cf6" }} />}
            loading={loading}
            accent="#8b5cf6"
            sub="Finished today"
          />
        </Grid>
      </Grid>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>
                  Upcoming Schedule
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Your next scheduled appointments
                </Typography>
              </Box>
              <Button
                size="small" variant="outlined"
                endIcon={<ArrowForwardRounded />}
                onClick={() => navigate("/doctor/queue")}
                sx={{ color: DOCTOR_BLUE, borderColor: `rgba(59,130,246,0.4)`, textTransform: "none", "&:hover": { borderColor: DOCTOR_BLUE, bgcolor: "rgba(59,130,246,0.06)" } }}
              >
                Go to Queue
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={24} sx={{ color: DOCTOR_BLUE }} /></Box>
            ) : !stats?.upcomingAppointments || stats.upcomingAppointments.length === 0 ? (
              <Box sx={{ bgcolor: "background.default", borderRadius: 2, p: 4, textAlign: "center", border: "1px dashed", borderColor: "divider" }}>
                <CheckCircleRounded sx={{ fontSize: 40, color: "#10b981", opacity: 0.6, mb: 1 }} />
                <Typography variant="body1" sx={{ color: "text.primary", fontWeight: 600 }}>All caught up!</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>No upcoming appointments found for today.</Typography>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {stats.upcomingAppointments.map((appt: any, idx: number) => (
                  <Box
                    key={appt.appointmentId}
                    sx={{
                      display: "flex", alignItems: "center", gap: 2, p: 2,
                      borderRadius: 2, border: "1px solid", borderColor: "divider",
                      bgcolor: idx === 0 ? `rgba(59,130,246,0.05)` : "background.default",
                      "&:hover": { borderColor: DOCTOR_BLUE, bgcolor: `rgba(59,130,246,0.02)` },
                    }}
                  >
                    <Box sx={{ textAlign: "center", minWidth: 60 }}>
                      <Typography variant="subtitle2" sx={{ color: "text.primary", fontWeight: 800 }}>
                        {new Date(appt.appointmentTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                        TKN {appt.tokenNumber}
                      </Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem sx={{ borderColor: "divider" }} />
                    <Box sx={{ flex: 1, minWidth: 0, ml: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: "text.primary" }} noWrap>
                        {appt.patientName}
                      </Typography>
                      <Chip
                        label={appt.status.label}
                        size="small"
                        sx={{
                          mt: 0.5,
                          bgcolor: `${appt.status.color}15`,
                          color: appt.status.color,
                          border: `1px solid ${appt.status.color}30`,
                          fontWeight: 700,
                          fontSize: "0.65rem",
                          height: 20
                        }}
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
