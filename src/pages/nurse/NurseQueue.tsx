import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress,
  Alert, Avatar, Tooltip,
} from "@mui/material";
import {
  MonitorHeartRounded, CheckCircleRounded, SyncRounded, HourglassTopRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import VitalsModal from "../reception/VitalsModal";
import { useSocket } from "../../hooks/useSocket";

const NURSE_PURPLE = "#a78bfa";
const NURSE_PURPLE_DARK = "#7c3aed";

export default function NurseQueue() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vitalsRecorded, setVitalsRecorded] = useState<Set<string>>(new Set());
  const [vitalsDialog, setVitalsDialog] = useState<{ open: boolean; token: any }>({ open: false, token: null });

  const fetchQueue = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/reception/queue");
      const tokenList = res.data.data;
      setTokens(tokenList);

      const apptIds = tokenList.map((t: any) => t.appointmentId).filter(Boolean);
      const vitalsChecks = await Promise.allSettled(
        apptIds.map((id: string) => axiosInstance.get(`/reception/appointments/${id}/vitals`))
      );
      const recorded = new Set<string>();
      vitalsChecks.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value.data.data) {
          recorded.add(apptIds[i]);
        }
      });
      setVitalsRecorded(recorded);
    } catch {
      setError("Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    // Auto refresh every 30s as a fallback
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Listen for real-time queue updates
  useSocket({
    QUEUE_UPDATED: fetchQueue
  });

  const waiting = tokens.filter(t => t.statusCode === "WAITING_FOR_VITALS" || t.statusCode === "READY_FOR_DOCTOR" || t.statusCode === "SKIPPED").length;
  const inProgress = tokens.filter(t => t.statusCode === "IN_CONSULTATION").length;
  const completed = tokens.filter(t => t.statusCode === "COMPLETED").length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 800, mb: 0.5 }}>
            Patient Queue
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Record vitals for patients before their consultation
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<SyncRounded />}
          onClick={fetchQueue}
          sx={{
            color: NURSE_PURPLE, borderColor: `rgba(167,139,250,0.4)`,
            fontWeight: 600, textTransform: "none",
            "&:hover": { borderColor: NURSE_PURPLE, bgcolor: "rgba(167,139,250,0.06)" },
          }}
        >
          Refresh
        </Button>
      </Box>

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
          label={`${vitalsRecorded.size} Vitals Done`}
          sx={{ bgcolor: `rgba(167,139,250,0.1)`, color: NURSE_PURPLE, border: `1px solid rgba(167,139,250,0.3)`, fontWeight: 600 }}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper", overflow: "hidden" }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {["Token", "Patient", "Doctor", "Status", "Vitals Status", "Action"].map((h, i) => (
                  <TableCell
                    key={h}
                    align={i === 5 ? "right" : "left"}
                    sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", py: 2, bgcolor: "background.default", borderBottom: "1px solid", borderColor: "divider" }}
                  >
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && tokens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                    <CircularProgress size={30} sx={{ color: NURSE_PURPLE }} />
                  </TableCell>
                </TableRow>
              ) : tokens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8, color: "text.secondary" }}>
                    No patients in queue today
                  </TableCell>
                </TableRow>
              ) : (
                tokens.map(token => {
                  const hasVitals = token.appointmentId && vitalsRecorded.has(token.appointmentId);
                  const isCompleted = token.statusCode === "COMPLETED" || token.statusCode === "CANCELLED";
                  return (
                    <TableRow key={token.queueTokenId} sx={{ "&:hover": { bgcolor: "background.default" } }}>
                      {/* Token Number */}
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                        <Avatar
                          sx={{
                            width: 40, height: 40, fontWeight: 800, fontSize: "0.9rem",
                            bgcolor: hasVitals ? "rgba(16,185,129,0.15)" : `rgba(167,139,250,0.15)`,
                            color: hasVitals ? "#10b981" : NURSE_PURPLE,
                            border: `2px solid ${hasVitals ? "rgba(16,185,129,0.3)" : "rgba(167,139,250,0.3)"}`,
                          }}
                        >
                          {token.displayNumber}
                        </Avatar>
                      </TableCell>

                      {/* Patient */}
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                        <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>
                          {token.patientName}
                        </Typography>
                      </TableCell>

                      {/* Doctor */}
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.secondary", fontSize: "0.85rem" }}>
                        {token.doctorName}
                      </TableCell>

                      {/* Queue Status */}
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                        <Chip
                          label={token.statusLabel} size="small"
                          sx={{ bgcolor: `${token.statusColor}22`, color: token.statusColor, border: `1px solid ${token.statusColor}55`, fontWeight: 600, fontSize: "0.7rem" }}
                        />
                      </TableCell>

                      {/* Vitals Status */}
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                        {hasVitals ? (
                          <Tooltip title="Vitals recorded — click to update">
                            <Chip
                              icon={<MonitorHeartRounded sx={{ fontSize: "14px !important" }} />}
                              label="Recorded ✓"
                              size="small"
                              sx={{ bgcolor: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", fontWeight: 600, fontSize: "0.7rem", cursor: "pointer" }}
                              onClick={() => setVitalsDialog({ open: true, token })}
                            />
                          </Tooltip>
                        ) : isCompleted ? (
                          <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: "italic" }}>Not collected</Typography>
                        ) : (
                          <Chip
                            label="Pending"
                            size="small"
                            sx={{ bgcolor: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", fontWeight: 600, fontSize: "0.7rem" }}
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

      {/* Vitals Modal */}
      {vitalsDialog.token && (
        <VitalsModal
          open={vitalsDialog.open}
          onClose={() => setVitalsDialog({ open: false, token: null })}
          appointmentId={vitalsDialog.token.appointmentId}
          patientId={vitalsDialog.token.patientId}
          patientName={vitalsDialog.token.patientName}
          onSaved={() => {
            setVitalsRecorded(prev => new Set([...prev, vitalsDialog.token.appointmentId]));
          }}
        />
      )}
    </Box>
  );
}
