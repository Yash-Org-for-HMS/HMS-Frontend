import { useQuery } from "@tanstack/react-query";
import {
  Box, Grid, Typography, Paper, CircularProgress, Alert,
  Skeleton, Chip, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Avatar, Button,
} from "@mui/material";
import {
  MonitorHeartRounded, CheckCircleRounded, HourglassTopRounded,
  PeopleAltRounded, ArrowForwardRounded, SyncRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import Mascot from "../../components/Mascot";
import ErrorState from "../../components/ErrorState";
import { useHospitalAuth } from "../../contexts/HospitalAuthContext";
import { useNavigate } from "react-router-dom";

const NURSE_PURPLE = "#a78bfa";
const NURSE_PURPLE_DARK = "#7c3aed";

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
            bgcolor: accent ? `${accent}18` : "rgba(167,139,250,0.1)",
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

export default function NurseDashboard() {
  const { hospital, user } = useHospitalAuth();
  const navigate = useNavigate();
  const { data, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ["nurse-queue"],
    queryFn: async () => {
      const res = await axiosInstance.get("/reception/queue");
      const tokenList: any[] = res.data.data;
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
          message={(error as any)?.response?.data?.message}
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
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <Box
            sx={{
              width: 36, height: 36, borderRadius: 1.5,
              background: `linear-gradient(135deg, ${NURSE_PURPLE_DARK}, ${NURSE_PURPLE})`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <MonitorHeartRounded sx={{ color: "#fff", fontSize: 20 }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "text.primary", letterSpacing: "-0.5px" }}>
            Nursing Station
          </Typography>
        </Box>
        <Typography variant="body1" sx={{ color: "text.secondary", mt: 0.5, ml: 0.5 }}>
          Good morning, {user?.firstName}! Today's vitals overview for {hospital?.name || "the hospital"}.
        </Typography>
      </Box>
{/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Patients Today"
            value={totalPatients}
            icon={<PeopleAltRounded sx={{ color: NURSE_PURPLE }} />}
            loading={loading}
            accent={NURSE_PURPLE}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Vitals Pending"
            value={vitalsPending}
            icon={<HourglassTopRounded sx={{ color: "#f59e0b" }} />}
            loading={loading}
            accent="#f59e0b"
            sub="Patients awaiting vitals"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Vitals Recorded"
            value={vitalsCompleted}
            icon={<MonitorHeartRounded sx={{ color: "#10b981" }} />}
            loading={loading}
            accent="#10b981"
            sub="Completed today"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="In Consultation"
            value={inProgress}
            icon={<CheckCircleRounded sx={{ color: "#3b82f6" }} />}
            loading={loading}
            accent="#3b82f6"
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
                        sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", py: 1.5, bgcolor: "background.default", borderBottom: "1px solid", borderColor: "divider" }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading && needsVitals.length === 0 ? (
                    <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress size={28} sx={{ color: NURSE_PURPLE }} /></TableCell></TableRow>
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
                          <Avatar sx={{ bgcolor: `${NURSE_PURPLE_DARK}cc`, width: 36, height: 36, fontSize: "0.85rem", fontWeight: 800 }}>
                            {token.displayNumber}
                          </Avatar>
                        </TableCell>
                        <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                          <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>{token.patientName}</Typography>
                        </TableCell>
                        <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.secondary", fontSize: "0.85rem" }}>
                          {token.doctorName}
                        </TableCell>
                        <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                          <Chip
                            label={token.statusLabel} size="small"
                            sx={{ bgcolor: `${token.statusColor}22`, color: token.statusColor, border: `1px solid ${token.statusColor}55`, fontWeight: 600, fontSize: "0.7rem" }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                          <Button
                            size="small" variant="contained"
                            startIcon={<MonitorHeartRounded />}
                            onClick={() => navigate("/nurse/queue", { state: { token } })}
                            sx={{
                              background: `linear-gradient(135deg, ${NURSE_PURPLE_DARK}, ${NURSE_PURPLE})`,
                              textTransform: "none", fontWeight: 600, fontSize: "0.8rem",
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
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={24} sx={{ color: NURSE_PURPLE }} /></Box>
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
