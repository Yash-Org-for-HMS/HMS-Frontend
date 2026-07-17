import { ACCENTS } from "@/styles/accents";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Grid, Typography, Paper, Alert,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Avatar, Button,
} from "@mui/material";
import {
  MonitorHeartRounded, CheckCircleRounded, HourglassTopRounded,
  PeopleAltRounded, ArrowForwardRounded, SyncRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import Mascot from "@/components/Mascot";
import StatusChip from "@/components/StatusChip";
import { TableRowsSkeleton, CardGridSkeleton } from "@/components/TableRowsSkeleton";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import StatCard from "@/components/StatCard";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { useNavigate } from "react-router-dom";
import { apiErrorText } from "@/utils/apiError";

const NURSE_PURPLE = ACCENTS.nurse;
const NURSE_PURPLE_DARK = ACCENTS.nurseDark;

export default function NurseDashboard() {
  const { hospital, user } = useHospitalAuth();
  const navigate = useNavigate();
  const { data, isLoading: loading, isError, error, refetch } = useQuery({
    // Distinct key from NurseQueue's ["nurse-queue"]: this query returns an
    // aggregate object ({ tokens, vitalsRecorded }), not the raw token array, so
    // sharing a cache key would feed the wrong shape to whichever page reads it.
    queryKey: ["nurse-dashboard-queue"],
    queryFn: async () => {
      const res = await axiosInstance.get("/reception/queue");
      const tokenList: any[] = Array.isArray(res.data?.data) ? res.data.data : [];
      // Resolve which appointments already have vitals recorded.
      const apptIds = tokenList.map((t: any) => t.appointmentId).filter(Boolean);
      const vitalsChecks = await Promise.allSettled(
        apptIds.map((id: string) => axiosInstance.get(`/reception/appointments/${id}/vitals`))
      );
      const recorded = new Set<string>();
      vitalsChecks.forEach((result, i) => {
        if (result.status === "fulfilled" && (result.value as any).data.data) recorded.add(apptIds[i]);
      });
      return { tokens: tokenList, vitalsRecorded: recorded };
    },
    refetchInterval: 30000, // refresh every 30s
  });
  const tokens: any[] = data?.tokens ?? [];
  const vitalsRecorded: Set<string> = data?.vitalsRecorded ?? new Set();

  if (isError) {
    return (
      <Box sx={{ pb: 6 }}>
        <ErrorState
          title="Couldn't load the queue"
          message={apiErrorText(error)}
          onRetry={() => refetch()}
        />
      </Box>
    );
  }

  const totalPatients = tokens.length;
  const waiting = tokens.filter(t => t.statusCode === "WAITING" || t.statusCode === "SKIPPED").length;
  const inProgress = tokens.filter(t => t.statusCode === "IN_PROGRESS").length;
  const vitalsPending = tokens.filter(t => t.appointmentId && !vitalsRecorded.has(t.appointmentId)).length;
  const vitalsCompleted = vitalsRecorded.size;

  // Patients needing vitals — waiting or in progress without vitals
  const needsVitals = tokens.filter(
    t => t.appointmentId && !vitalsRecorded.has(t.appointmentId) &&
      (t.statusCode === "WAITING" || t.statusCode === "IN_PROGRESS" || t.statusCode === "SKIPPED")
  );

  return (
    <Box sx={{ pb: 6 }}>
      {/* Header */}
      <PageHeader
        title="Nursing Station"
        subtitle={`Good morning, ${user?.firstName}! Today's vitals overview for ${hospital?.name || "the hospital"}.`}
      />
      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Total Patients Today"
            value={totalPatients}
            icon={<PeopleAltRounded sx={{ color: NURSE_PURPLE }} />}
            loading={loading}
            color={NURSE_PURPLE}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Vitals Pending"
            value={vitalsPending}
            icon={<HourglassTopRounded sx={{ color: "#f59e0b" }} />}
            loading={loading}
            color="#f59e0b"
            sub="Patients awaiting vitals"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Vitals Recorded"
            value={vitalsCompleted}
            icon={<MonitorHeartRounded sx={{ color: "#10b981" }} />}
            loading={loading}
            color="#10b981"
            sub="Completed today"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="In Consultation"
            value={inProgress}
            icon={<CheckCircleRounded sx={{ color: "#3b82f6" }} />}
            loading={loading}
            color="#3b82f6"
            sub="With doctor now"
          />
        </Grid>
      </Grid>

      {/* Priority: Needs Vitals */}
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>
                  Patients Awaiting Vitals
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Record vitals for these patients before their consultation
                </Typography>
              </Box>
              <Button
                size="small" variant="outlined"
                startIcon={<SyncRounded />}
                onClick={() => refetch()}
                sx={{ color: NURSE_PURPLE, borderColor: `rgba(167,139,250,0.4)`, textTransform: "none", "&:hover": { borderColor: NURSE_PURPLE, bgcolor: "rgba(167,139,250,0.06)" } }}
              >
                Refresh
              </Button>
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    {["Token", "Patient", "Doctor", "Status", ""].map((h, i) => (
                      <TableCell key={h || i}
                        align={i === 4 ? "right" : "left"}
                        sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", py: 1.5, bgcolor: "background.default", borderBottom: "1px solid", borderColor: "divider" }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading && needsVitals.length === 0 ? (
                    <TableRowsSkeleton rows={6} columns={5} />
                  ) : needsVitals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ py: 4, border: 0 }}>
                        <Mascot pose="all-caught-up" title="All caught up!" subtitle="All vitals recorded for today." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    needsVitals.map(token => (
                      <TableRow key={token.queueTokenId} sx={{ "&:hover": { bgcolor: "background.default" } }}>
                        <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                          <Avatar sx={{ bgcolor: `${NURSE_PURPLE_DARK}cc`, width: 36, height: 36, fontSize: "0.875rem", fontWeight: 800 }}>
                            {token.displayNumber}
                          </Avatar>
                        </TableCell>
                        <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                          <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>{token.patientName}</Typography>
                        </TableCell>
                        <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.secondary", fontSize: "0.875rem" }}>
                          {token.doctorName}
                        </TableCell>
                        <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                          <StatusChip label={token.statusLabel} color={token.statusColor} />
                        </TableCell>
                        <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                          <Button
                            size="small" variant="contained"
                            startIcon={<MonitorHeartRounded />}
                            onClick={() => navigate("/nurse/queue", { state: { token } })}
                            sx={{
                              background: `linear-gradient(135deg, ${NURSE_PURPLE_DARK}, ${NURSE_PURPLE})`,
                              textTransform: "none", fontWeight: 600, fontSize: "0.875rem",
                              boxShadow: "0 2px 8px rgba(124,58,237,0.25)",
                              "&:hover": { background: `linear-gradient(135deg, #6d28d9, ${NURSE_PURPLE_DARK})` },
                            }}
                          >
                            Record Vitals
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Right side: Vitals Done */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", height: "100%" }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary", mb: 0.5 }}>
              Vitals Completed
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
              Patients whose vitals are recorded
            </Typography>
            {loading ? (
              <CardGridSkeleton count={4} height={60} minWidth={220} />
            ) : tokens.filter(t => t.appointmentId && vitalsRecorded.has(t.appointmentId)).length === 0 ? (
              <Mascot pose="nothing-here-yet" subtitle="No vitals recorded yet today." size={130} />
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {tokens.filter(t => t.appointmentId && vitalsRecorded.has(t.appointmentId)).map(token => (
                  <Box
                    key={token.queueTokenId}
                    sx={{
                      display: "flex", alignItems: "center", gap: 1.5,
                      p: 1.5, borderRadius: 2, bgcolor: "rgba(16,185,129,0.06)",
                      border: "1px solid rgba(16,185,129,0.2)",
                    }}
                  >
                    <Avatar sx={{ width: 32, height: 32, bgcolor: "rgba(16,185,129,0.15)", color: "#10b981", fontSize: "0.75rem", fontWeight: 800 }}>
                      {token.displayNumber}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }} noWrap>{token.patientName}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>{token.doctorName}</Typography>
                    </Box>
                    <CheckCircleRounded sx={{ color: "#10b981", fontSize: 18 }} />
                  </Box>
                ))}
              </Box>
            )}

            <Box sx={{ mt: 3 }}>
              <Button
                fullWidth variant="outlined"
                endIcon={<ArrowForwardRounded />}
                onClick={() => navigate("/nurse/queue")}
                sx={{
                  color: NURSE_PURPLE, borderColor: `rgba(167,139,250,0.4)`,
                  textTransform: "none", fontWeight: 600,
                  "&:hover": { borderColor: NURSE_PURPLE, bgcolor: "rgba(167,139,250,0.06)" },
                }}
              >
                View Full Queue
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
