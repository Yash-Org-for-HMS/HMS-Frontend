import { SEMANTIC, BRAND } from "@/styles/accents";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Grid, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Avatar, Button,
} from "@mui/material";
import {
  MonitorHeartRounded, CheckCircleRounded, HourglassTopRounded,
  PeopleAltRounded, ArrowForwardRounded, SyncRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import Mascot from "@/components/Mascot";
import StatusChip from "@/components/StatusChip";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import StatCard from "@/components/StatCard";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { useNavigate } from "react-router-dom";
import { apiErrorText } from "@/utils/apiError";
import { QUEUE_POLL_MS } from "@/constants/intervals";
import { needsVitals, hasVitals, isInConsultation } from "@/constants/queueStatus";

const NURSE_PURPLE = BRAND.action;
const NURSE_PURPLE_DARK = BRAND.actionDark;

export default function NurseDashboard() {
  const { hospital, user } = useHospitalAuth();
  const navigate = useNavigate();
  const { data, isLoading: loading, isError, error, refetch } = useQuery({
    // The queue endpoint already reports `vitalsRecorded` on every token, so
    // this used to fan out one extra GET /appointments/:id/vitals PER PATIENT to
    // learn something the list had already told it — 50 requests for a 50-token
    // queue, every 30 seconds. Read the flag off the token instead.
    queryKey: ["nurse-dashboard-queue"],
    queryFn: async () => {
      const res = await axiosInstance.get("/reception/queue");
      return Array.isArray(res.data?.data) ? (res.data.data as any[]) : [];
    },
    refetchInterval: QUEUE_POLL_MS, // refresh every 30s
  });
  const tokens: any[] = data ?? [];

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
  const inProgress = tokens.filter(isInConsultation).length;

  // The worklist and the tile above it are now the SAME list. They used to be
  // two different filters, and the tile could read "3 Vitals Pending" directly
  // above a table saying "All caught up!".
  //
  // Longest-waiting first. Token order is arrival order within a doctor's
  // queue, so with several doctors running the person who has been sitting
  // there an hour could appear below someone who walked in five minutes ago.
  // Sorting by wait is what makes this a worklist rather than a list.
  const waitedMs = (t: any) => Date.now() - new Date(t.createdAt).getTime();
  const pendingVitals = tokens.filter(needsVitals).sort((a, b) => waitedMs(b) - waitedMs(a));
  const doneVitals = tokens.filter(hasVitals);
  const vitalsPending = pendingVitals.length;
  const vitalsCompleted = doneVitals.length;

  // Whole minutes waited, as "1h 20m" once past the hour.
  const waitLabel = (t: any) => {
    const mins = Math.max(0, Math.floor(waitedMs(t) / 60000));
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  };

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
            icon={<HourglassTopRounded sx={{ color: SEMANTIC.warning }} />}
            loading={loading}
            color={SEMANTIC.warning}
            sub="Patients awaiting vitals"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Vitals Recorded"
            value={vitalsCompleted}
            icon={<MonitorHeartRounded sx={{ color: SEMANTIC.success }} />}
            loading={loading}
            color={SEMANTIC.success}
            sub="Completed today"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="In Consultation"
            value={inProgress}
            icon={<CheckCircleRounded sx={{ color: SEMANTIC.info }} />}
            loading={loading}
            color={SEMANTIC.info}
            sub="With doctor now"
          />
        </Grid>
      </Grid>

      {/* The worklist IS the page. It used to share the row with a "Vitals
          Completed" panel that took a third of the width to say what a number
          in this header says — and the patients already done aren't work. */}
      <Grid container spacing={4}>
        <Grid size={{ xs: 12 }}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 4, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, gap: 2, flexWrap: "wrap" }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>
                  Patients Awaiting Vitals
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Longest wait first — record vitals before their consultation
                  {vitalsCompleted > 0 && ` · ${vitalsCompleted} already recorded today`}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 1.5 }}>
                <Button
                  size="small" variant="outlined"
                  startIcon={<SyncRounded />}
                  onClick={() => refetch()}
                  sx={{ color: NURSE_PURPLE, borderColor: alpha(NURSE_PURPLE, 0.4), textTransform: "none", "&:hover": { borderColor: NURSE_PURPLE, bgcolor: alpha(NURSE_PURPLE, 0.06) } }}
                >
                  Refresh
                </Button>
                <Button
                  size="small" variant="outlined"
                  endIcon={<ArrowForwardRounded />}
                  onClick={() => navigate("/nurse/queue")}
                  sx={{ color: NURSE_PURPLE, borderColor: alpha(NURSE_PURPLE, 0.4), textTransform: "none", "&:hover": { borderColor: NURSE_PURPLE, bgcolor: alpha(NURSE_PURPLE, 0.06) } }}
                >
                  Full queue
                </Button>
              </Box>
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    {["Token", "Patient", "Doctor", "Waiting", "Status", ""].map((h, i) => (
                      <TableCell key={h || i}
                        align={i === 5 ? "right" : "left"}
                        sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", py: 1.5, bgcolor: "background.default", borderBottom: "1px solid", borderColor: "divider" }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading && pendingVitals.length === 0 ? (
                    <TableRowsSkeleton rows={6} columns={6} />
                  ) : pendingVitals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 4, border: 0 }}>
                        <Mascot pose="all-caught-up" title="All caught up!" subtitle="All vitals recorded for today." />
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingVitals.map(token => (
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
                        {/* How long they've been in the queue — the thing that
                            decides who to see next, and the reason the rows are
                            in this order. Turns red past 30 minutes. */}
                        <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                          <Typography variant="body2" sx={{
                            fontWeight: 700, fontVariantNumeric: "tabular-nums",
                            color: waitedMs(token) >= 30 * 60000 ? SEMANTIC.danger : "text.secondary",
                          }}>
                            {waitLabel(token)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                          <StatusChip label={token.statusLabel} color={token.statusColor} />
                        </TableCell>
                        <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                          <Button
                            size="small" variant="contained"
                            startIcon={<MonitorHeartRounded />}
                            onClick={() => navigate("/nurse/queue", { state: { token } })}
                            // Gradient and hover come from the theme's contained-primary
                            // style, so this button matches every other primary action
                            // in the product instead of carrying its own violet.
                            sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.875rem" }}
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

      </Grid>
    </Box>
  );
}
