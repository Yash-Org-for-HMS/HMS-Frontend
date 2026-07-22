import { ACCENTS, SEMANTIC } from "@/styles/accents";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Grid, Typography, Paper, Alert,
  Chip, Avatar, Button, Divider
} from "@mui/material";
import {
  MonitorHeartRounded, CheckCircleRounded, HourglassTopRounded,
  PeopleAltRounded, ArrowForwardRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import Mascot from "@/components/Mascot";
import ErrorState from "@/components/ErrorState";
import PageHeader from "@/components/layout/PageHeader";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import StatCard from "@/components/StatCard";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { useNavigate } from "react-router-dom";
import { apiErrorText } from "@/utils/apiError";
import { DASHBOARD_POLL_MS } from "@/constants/intervals";

const DOCTOR_BLUE = ACCENTS.doctor;

export default function DoctorDashboard() {
  const { hospital, user } = useHospitalAuth();
  const navigate = useNavigate();

  const { data: stats, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ["doctor-dashboard-stats"],
    queryFn: async () => (await axiosInstance.get("/doctor/dashboard/stats")).data.data,
    refetchInterval: DASHBOARD_POLL_MS, // refresh every minute
  });

  if (isError) {
    return (
      <Box sx={{ pb: 6 }}>
        <ErrorState
          title="Couldn't load your dashboard"
          message={apiErrorText(error)}
          onRetry={() => refetch()}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 6 }}>
      <PageHeader
        title={`Welcome, Dr. ${user?.lastName ?? ""}`}
        subtitle={`Here is your schedule for today at ${hospital?.name || "the hospital"}.`}
      />
{/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Today's Appointments"
            value={stats?.todaysAppointments || 0}
            icon={<PeopleAltRounded sx={{ color: DOCTOR_BLUE }} />}
            loading={loading}
            color={DOCTOR_BLUE}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Waiting Patients"
            value={stats?.waitingPatients || 0}
            icon={<HourglassTopRounded sx={{ color: SEMANTIC.warning }} />}
            loading={loading}
            color={SEMANTIC.warning}
            sub="Checked in, ready to be seen"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Vitals Recorded"
            value={stats?.vitalsRecorded || 0}
            icon={<MonitorHeartRounded sx={{ color: SEMANTIC.success }} />}
            loading={loading}
            color={SEMANTIC.success}
            sub="Pre-consultation complete"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Completed Consultations"
            value={stats?.completedVisits || 0}
            icon={<CheckCircleRounded sx={{ color: "#8b5cf6" }} />}
            loading={loading}
            color="#8b5cf6"
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
              <DashboardSkeleton />
            ) : !stats?.upcomingAppointments || stats.upcomingAppointments.length === 0 ? (
              <Mascot pose="all-caught-up" title="All caught up!" subtitle="No upcoming appointments found for today." />
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
                          fontSize: "0.75rem",
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
