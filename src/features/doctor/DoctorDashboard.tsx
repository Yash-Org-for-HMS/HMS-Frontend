import { ACCENTS, SEMANTIC, BRAND } from "@/styles/accents";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Grid, Typography, Paper, Alert,
  Chip, Avatar, Button, Divider
} from "@mui/material";
import {
  MonitorHeartRounded, CheckCircleRounded, HourglassTopRounded,
  PeopleAltRounded, ArrowForwardRounded, CrisisAlertRounded,
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
import AttentionList from "@/components/dashboard/AttentionList";
import { DASHBOARD_POLL_MS } from "@/constants/intervals";

const DOCTOR_BLUE = BRAND.action;

const waitLabel = (mins: number) => (mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`);
const hoursSince = (iso: string) => {
  const h = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000));
  return h >= 24 ? `${Math.floor(h / 24)}d` : `${h}h`;
};

export default function DoctorDashboard() {
  const { hospital, user } = useHospitalAuth();
  const navigate = useNavigate();

  const { data: stats, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ["doctor-dashboard-stats"],
    queryFn: async () => (await axiosInstance.get("/doctor/dashboard/stats")).data.data,
    refetchInterval: DASHBOARD_POLL_MS, // refresh every minute
  });

  const todaysPatients: any[] = stats?.todaysPatients ?? [];
  const criticalResults: any[] = stats?.criticalResults ?? [];

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
            // "Ready to be seen" wasn't necessarily true: a patient can be
            // checked in and waiting with vitals still not taken, which is what
            // actually blocks the consultation.
            sub={
              stats && stats.waitingPatients > 0
                ? `${stats.vitalsRecorded ?? 0} of them have vitals done`
                : "Nobody waiting"
            }
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
            icon={<CheckCircleRounded sx={{ color: SEMANTIC.success }} />}
            loading={loading}
            color={SEMANTIC.success}
            sub="Finished today"
          />
        </Grid>
      </Grid>

      {/* Critical results this doctor ordered and hasn't acknowledged. The
          acknowledgement is the ordering clinician's, so this is the only
          genuinely time-critical thing on a doctor's screen — and it wasn't on
          it at all. */}
      {criticalResults.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <AttentionList
            title="Critical results awaiting your acknowledgement"
            subtitle="Oldest first — these were flagged critical on tests you ordered"
            items={criticalResults.map((c: any) => ({
              id: c.labReportId,
              primary: `${c.patientName} — ${c.testName}`,
              secondary: `Result: ${c.resultValue ?? "—"}`,
              meta: hoursSince(c.reportedAt),
              severity: "critical" as const,
              icon: <CrisisAlertRounded sx={{ fontSize: 18 }} />,
              onClick: () => navigate("/doctor/results"),
            }))}
            actionLabel="All results"
            onAction={() => navigate("/doctor/results")}
          />
        </Box>
      )}

      <Grid container spacing={4}>
        <Grid size={{ xs: 12 }}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
              <Box>
                {/* Was "Upcoming Schedule / Your next scheduled appointments"
                    over a list that never excluded times already past — so a
                    patient waiting seven hours read as upcoming. */}
                <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>
                  Today's Patients
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  In appointment order — waiting time shown for anyone checked in
                </Typography>
              </Box>
              <Button
                size="small" variant="outlined"
                endIcon={<ArrowForwardRounded />}
                onClick={() => navigate("/doctor/queue")}
                sx={{ color: DOCTOR_BLUE, borderColor: alpha(DOCTOR_BLUE, 0.4), textTransform: "none", "&:hover": { borderColor: DOCTOR_BLUE, bgcolor: alpha(DOCTOR_BLUE, 0.06) } }}
              >
                Go to Queue
              </Button>
            </Box>

            {loading ? (
              <DashboardSkeleton />
            ) : todaysPatients.length === 0 ? (
              <Mascot pose="all-caught-up" title="All caught up!" subtitle="No appointments booked with you today." />
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {todaysPatients.map((appt: any) => {
                  const waiting = appt.waitingMinutes;
                  const longWait = waiting != null && waiting >= 30;
                  return (
                    <Box
                      key={appt.appointmentId}
                      sx={{
                        display: "flex", alignItems: "center", gap: 2, p: 2,
                        borderRadius: 2, border: "1px solid", borderColor: "divider",
                        // The row that stands out is the one keeping someone
                        // waiting, not simply the first one in the list.
                        bgcolor: appt.isDone ? "background.default" : longWait ? alpha(SEMANTIC.danger, 0.05) : alpha(DOCTOR_BLUE, 0.04),
                        opacity: appt.isDone ? 0.65 : 1,
                        "&:hover": { borderColor: DOCTOR_BLUE, bgcolor: alpha(DOCTOR_BLUE, 0.02) },
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
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
                          <Chip
                            label={appt.status.label}
                            size="small"
                            sx={{
                              bgcolor: `${appt.status.color}15`,
                              color: appt.status.color,
                              border: `1px solid ${appt.status.color}30`,
                              fontWeight: 700, fontSize: "0.75rem", height: 20,
                            }}
                          />
                          {/* Vitals gate the consultation, so whether they're
                              done belongs next to the patient, not only in a
                              count tile. */}
                          {!appt.isDone && (
                            <Typography variant="caption" sx={{ color: appt.vitalsRecorded ? SEMANTIC.success : "text.secondary", fontWeight: 600 }}>
                              {appt.vitalsRecorded ? "Vitals done" : "Vitals not recorded"}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      {waiting != null && !appt.isDone && (
                        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", color: longWait ? SEMANTIC.danger : "text.secondary" }}>
                            {waitLabel(waiting)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>waiting</Typography>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
