import { ACCENTS } from "@/styles/accents";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip,
  Alert, Avatar, Tooltip, Grid, ToggleButton, ToggleButtonGroup,
} from "@mui/material";
import {
  MonitorHeartRounded, CheckCircleRounded, SyncRounded, HourglassTopRounded,
  ArrowForwardRounded, ViewListRounded, DashboardCustomizeRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import Mascot from "@/components/Mascot";
import StatusChip from "@/components/StatusChip";
import { TableRowsSkeleton, CardGridSkeleton } from "@/components/TableRowsSkeleton";
import PageHeader from "@/components/layout/PageHeader";
import VitalsModal from "../reception/VitalsModal";
import { useSocket } from "@/hooks/useSocket";
import { QUEUE_POLL_MS } from "@/constants/intervals";

const getDoctorInitials = (doctorName?: string) => {
  if (!doctorName || doctorName === "Unknown") return "";
  const cleanName = doctorName.replace(/^Dr\.\s*/i, "");
  const parts = cleanName.split(" ").filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const NURSE_PURPLE = ACCENTS.nurse;
const NURSE_PURPLE_DARK = ACCENTS.nurseDark;

type ViewMode = "queue" | "station";

export default function NurseQueue() {
  const location = useLocation();
  const { data, isLoading: loading, error, refetch: fetchQueue } = useQuery({
    queryKey: ["nurse-queue"],
    queryFn: async () => {
      const res = await axiosInstance.get("/reception/queue");
      return res.data.data;
    },
    refetchInterval: QUEUE_POLL_MS,
  });
  // Coerce to an array so an unexpected payload can never crash the page.
  const tokens: any[] = Array.isArray(data) ? data : [];

  const [view, setView] = useState<ViewMode>("queue");
  const [vitalsDialog, setVitalsDialog] = useState<{ open: boolean; token: any }>({ open: false, token: null });

  // Listen for real-time queue updates
  useSocket({
    QUEUE_UPDATED: fetchQueue,
  });

  // Deep-link from the dashboard's "Record Vitals" button: open the modal for the
  // passed token, then clear the history state so it doesn't re-trigger on refresh.
  useEffect(() => {
    const token = location.state?.token;
    if (token) {
      setVitalsDialog({ open: true, token });
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Memoized on `tokens` — this page re-renders on unrelated local state (view
  // toggle, vitals dialog open/close), which would otherwise re-run all 6 of
  // these full-array passes for no reason.
  const { waiting, inProgress, completed, vitalsRecordedCount, pending, done } = useMemo(() => ({
    waiting: tokens.filter((t: any) => t.statusCode === "WAITING_FOR_VITALS" || t.statusCode === "READY_FOR_DOCTOR" || t.statusCode === "SKIPPED").length,
    inProgress: tokens.filter((t: any) => t.statusCode === "IN_CONSULTATION").length,
    completed: tokens.filter((t: any) => t.statusCode === "COMPLETED").length,
    vitalsRecordedCount: tokens.filter((t: any) => t.vitalsRecorded).length,
    // Station view buckets
    pending: tokens.filter(
      (t: any) => t.appointmentId &&
        !t.vitalsRecorded &&
        !["COMPLETED", "CANCELLED"].includes(t.statusCode)
    ),
    done: tokens.filter((t: any) => t.appointmentId && t.vitalsRecorded),
  }), [tokens]);

  return (
    <Box>
      <PageHeader
        title="Patient Queue"
        subtitle="Record vitals for patients before their consultation"
        actions={
          <>
          <ToggleButtonGroup
            value={view}
            exclusive
            size="small"
            onChange={(_, v) => v && setView(v)}
            sx={{
              "& .MuiToggleButton-root": {
                textTransform: "none", fontWeight: 600, color: "text.secondary",
                borderColor: "rgba(167,139,250,0.3)", px: 2,
                "&.Mui-selected": {
                  color: NURSE_PURPLE, bgcolor: "rgba(167,139,250,0.12)",
                  "&:hover": { bgcolor: "rgba(167,139,250,0.18)" },
                },
              },
            }}
          >
            <ToggleButton value="queue">
              <ViewListRounded sx={{ fontSize: 18, mr: 0.75 }} /> Queue
            </ToggleButton>
            <ToggleButton value="station">
              <DashboardCustomizeRounded sx={{ fontSize: 18, mr: 0.75 }} /> Vitals Station
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            variant="outlined"
            startIcon={<SyncRounded />}
            onClick={() => fetchQueue()}
            sx={{
              color: NURSE_PURPLE, borderColor: `rgba(167,139,250,0.4)`,
              fontWeight: 600, textTransform: "none",
              "&:hover": { borderColor: NURSE_PURPLE, bgcolor: "rgba(167,139,250,0.06)" },
            }}
          >
            Refresh
          </Button>
          </>
        }
      />

      {/* Summary Chips */}
      <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
        <Chip
          icon={<HourglassTopRounded sx={{ fontSize: "16px !important" }} />}
          label={`${waiting} Waiting`}
          sx={{ bgcolor: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", fontWeight: 600 }}
        />
        <Chip
          icon={<CheckCircleRounded sx={{ fontSize: "16px !important" }} />}
          label={`${inProgress} In Progress`}
          sx={{ bgcolor: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)", fontWeight: 600 }}
        />
        <Chip
          icon={<CheckCircleRounded sx={{ fontSize: "16px !important" }} />}
          label={`${completed} Completed`}
          sx={{ bgcolor: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", fontWeight: 600 }}
        />
        <Chip
          icon={<MonitorHeartRounded sx={{ fontSize: "16px !important" }} />}
          label={`${vitalsRecordedCount} Vitals Done`}
          sx={{ bgcolor: `rgba(167,139,250,0.1)`, color: NURSE_PURPLE, border: `1px solid rgba(167,139,250,0.3)`, fontWeight: 600 }}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>Failed to load queue</Alert>}

      {/* ── QUEUE (table) VIEW ─────────────────────────────────────────── */}
      {view === "queue" && (
        <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper", overflow: "hidden" }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {["Token", "Patient", "Doctor", "Status", "Vitals Status", "Action"].map((h, i) => (
                    <TableCell
                      key={h}
                      align={i === 5 ? "right" : "left"}
                      sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", py: 2, bgcolor: "background.default", borderBottom: "1px solid", borderColor: "divider" }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && tokens.length === 0 ? (
                  <TableRowsSkeleton rows={6} columns={6} />
                ) : tokens.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 4, border: 0 }}>
                      <Mascot pose="all-caught-up" title="No patients in queue" subtitle="No patients in the queue today." />
                    </TableCell>
                  </TableRow>
                ) : (
                  tokens.map((token: any) => {
                    const hasVitals = token.vitalsRecorded;
                    const isCompleted = token.statusCode === "COMPLETED" || token.statusCode === "CANCELLED";
                    return (
                      <TableRow key={token.queueTokenId} sx={{ "&:hover": { bgcolor: "background.default" } }}>
                        {/* Token Number */}
                        <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                          <Chip
                            label={`${getDoctorInitials(token.doctorName)}-${token.displayNumber}`}
                            sx={{
                              bgcolor: hasVitals ? "rgba(16,185,129,0.15)" : `rgba(167,139,250,0.15)`,
                              color: hasVitals ? "#10b981" : NURSE_PURPLE,
                              border: `1px solid ${hasVitals ? "rgba(16,185,129,0.3)" : "rgba(167,139,250,0.3)"}`,
                              fontWeight: 800,
                              borderRadius: '8px'
                            }}
                          />
                        </TableCell>

                        {/* Patient */}
                        <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                          <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>
                            {token.patientName}
                          </Typography>
                        </TableCell>

                        {/* Doctor */}
                        <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.secondary", fontSize: "0.875rem" }}>
                          {token.doctorName}
                        </TableCell>

                        {/* Queue Status */}
                        <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                          <StatusChip label={token.statusLabel} color={token.statusColor} />
                        </TableCell>

                        {/* Vitals Status */}
                        <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                          {hasVitals ? (
                            <Tooltip title="Vitals recorded — click to update">
                              <Chip
                                icon={<MonitorHeartRounded sx={{ fontSize: "14px !important" }} />}
                                label="Recorded ✓"
                                size="small"
                                sx={{ bgcolor: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", fontWeight: 600, fontSize: "0.75rem", cursor: "pointer" }}
                                onClick={() => setVitalsDialog({ open: true, token })}
                              />
                            </Tooltip>
                          ) : isCompleted ? (
                            <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: "italic" }}>Not collected</Typography>
                          ) : (
                            <Chip
                              label="Pending"
                              size="small"
                              sx={{ bgcolor: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", fontWeight: 600, fontSize: "0.75rem" }}
                            />
                          )}
                        </TableCell>

                        {/* Action */}
                        <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                          {!isCompleted && token.appointmentId && (
                            <Button
                              size="small"
                              variant={hasVitals ? "outlined" : "contained"}
                              startIcon={<MonitorHeartRounded />}
                              onClick={() => setVitalsDialog({ open: true, token })}
                              sx={
                                hasVitals
                                  ? {
                                    color: "#10b981", borderColor: "rgba(16,185,129,0.4)",
                                    textTransform: "none", fontWeight: 600,
                                    "&:hover": { borderColor: "#10b981", bgcolor: "rgba(16,185,129,0.06)" },
                                  }
                                  : {
                                    background: `linear-gradient(135deg, ${NURSE_PURPLE_DARK}, ${NURSE_PURPLE})`,
                                    textTransform: "none", fontWeight: 600,
                                    boxShadow: "0 2px 8px rgba(124,58,237,0.25)",
                                    "&:hover": { background: `linear-gradient(135deg, #6d28d9, ${NURSE_PURPLE_DARK})` },
                                  }
                              }
                            >
                              {hasVitals ? "Update Vitals" : "Record Vitals"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ── VITALS STATION (focus board) VIEW ──────────────────────────── */}
      {view === "station" && (
        <Grid container spacing={4}>
          {/* Left: Pending Vitals */}
          <Grid size={{ xs: 12, lg: 7 }}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 4, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>
                    Needs Vitals
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {pending.length} patient{pending.length !== 1 ? "s" : ""} waiting
                  </Typography>
                </Box>
                <Chip
                  label={`${pending.length} Pending`}
                  sx={{ bgcolor: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", fontWeight: 700 }}
                />
              </Box>

              {loading ? (
                <CardGridSkeleton count={4} height={76} minWidth={300} />
              ) : pending.length === 0 ? (
                <Mascot pose="all-caught-up" title="All done!" subtitle="All patients have their vitals recorded." />
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {pending.map((token: any, index: number) => (
                    <Box
                      key={token.queueTokenId}
                      sx={{
                        display: "flex", alignItems: "center", gap: 2,
                        p: 2, borderRadius: 2.5,
                        border: "1px solid",
                        borderColor: index === 0 ? `rgba(167,139,250,0.4)` : "divider",
                        bgcolor: index === 0 ? `rgba(167,139,250,0.05)` : "background.default",
                        transition: "all 0.15s ease",
                        "&:hover": { borderColor: `rgba(167,139,250,0.4)`, bgcolor: `rgba(167,139,250,0.04)` },
                      }}
                    >
                      {/* Priority indicator */}
                      <Box sx={{ position: "relative" }}>
                        <Avatar
                          sx={{
                            width: 44, height: 44, fontWeight: 800,
                            background: index === 0
                              ? `linear-gradient(135deg, ${NURSE_PURPLE_DARK}, ${NURSE_PURPLE})`
                              : "rgba(100,116,139,0.15)",
                            color: index === 0 ? "#fff" : "text.secondary",
                          }}
                        >
                          {token.displayNumber}
                        </Avatar>
                        {index === 0 && (
                          <Box
                            sx={{
                              position: "absolute", top: -4, right: -4,
                              width: 14, height: 14, borderRadius: "50%",
                              bgcolor: "#f59e0b", border: "2px solid",
                              borderColor: "background.paper",
                            }}
                          />
                        )}
                      </Box>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }} noWrap>
                            {token.patientName}
                          </Typography>
                          {index === 0 && (
                            <Chip label="Next" size="small" sx={{ bgcolor: `rgba(167,139,250,0.15)`, color: NURSE_PURPLE, fontWeight: 700, fontSize: "0.75rem", height: 18 }} />
                          )}
                        </Box>
                        <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
                          {token.doctorName}
                        </Typography>
                      </Box>

                      <StatusChip label={token.statusLabel} color={token.statusColor} />

                      <Button
                        size="small"
                        variant="contained"
                        endIcon={<ArrowForwardRounded />}
                        onClick={() => setVitalsDialog({ open: true, token })}
                        sx={{
                          background: index === 0
                            ? `linear-gradient(135deg, ${NURSE_PURPLE_DARK}, ${NURSE_PURPLE})`
                            : "rgba(167,139,250,0.15)",
                          color: index === 0 ? "#fff" : NURSE_PURPLE,
                          textTransform: "none", fontWeight: 600, flexShrink: 0,
                          boxShadow: index === 0 ? "0 2px 8px rgba(124,58,237,0.3)" : "none",
                          "&:hover": {
                            background: index === 0
                              ? `linear-gradient(135deg, #6d28d9, ${NURSE_PURPLE_DARK})`
                              : `rgba(167,139,250,0.25)`,
                          },
                        }}
                      >
                        Record
                      </Button>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Right: Completed */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 4, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>
                  Vitals Done
                </Typography>
                <Chip
                  label={`${done.length} Done`}
                  sx={{ bgcolor: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", fontWeight: 700 }}
                />
              </Box>

              {done.length === 0 ? (
                <Mascot pose="nothing-here-yet" subtitle="No vitals recorded yet." size={120} />
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {done.map((token: any) => (
                    <Box
                      key={token.queueTokenId}
                      sx={{
                        display: "flex", alignItems: "center", gap: 1.5,
                        p: 1.5, borderRadius: 2,
                        bgcolor: "rgba(16,185,129,0.05)",
                        border: "1px solid rgba(16,185,129,0.15)",
                        cursor: "pointer",
                        "&:hover": { bgcolor: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.3)" },
                      }}
                      onClick={() => setVitalsDialog({ open: true, token })}
                    >
                      <Avatar sx={{ width: 34, height: 34, bgcolor: "rgba(16,185,129,0.15)", color: "#10b981", fontSize: "0.875rem", fontWeight: 800 }}>
                        {token.displayNumber}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }} noWrap>{token.patientName}</Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.75rem" }} noWrap>{token.doctorName}</Typography>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <CheckCircleRounded sx={{ color: "#10b981", fontSize: 18 }} />
                        <Typography variant="caption" sx={{ color: "#10b981", fontWeight: 600, fontSize: "0.75rem" }}>Update</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Vitals Modal */}
      {vitalsDialog.token && (
        <VitalsModal
          open={vitalsDialog.open}
          onClose={() => setVitalsDialog({ open: false, token: null })}
          appointmentId={vitalsDialog.token.appointmentId}
          patientId={vitalsDialog.token.patientId}
          patientName={vitalsDialog.token.patientName}
          onSaved={() => fetchQueue()}
        />
      )}
    </Box>
  );
}
