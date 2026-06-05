import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress,
  Alert, Avatar, Tooltip, IconButton,
} from "@mui/material";
import {
  MonitorHeartRounded, CheckCircleRounded, SyncRounded, HourglassTopRounded,
  LocalHospitalRounded, PlayArrowRounded, VisibilityRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import VitalsModal from "../reception/VitalsModal";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../../hooks/useSocket";

const DOCTOR_BLUE = "#3b82f6";
const DOCTOR_BLUE_DARK = "#2563eb";

export default function DoctorQueue() {
  const navigate = useNavigate();
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vitalsRecorded, setVitalsRecorded] = useState<Set<string>>(new Set());
  const [vitalsDialog, setVitalsDialog] = useState<{ open: boolean; token: any; readonly: boolean }>({ open: false, token: null, readonly: true });

  const fetchQueue = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/doctor/queue");
      const tokenList = res.data.data;
      setTokens(tokenList);

      const apptIds = tokenList.map((t: any) => t.appointmentId).filter(Boolean);
      if (apptIds.length > 0) {
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
      }
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
    <Box sx={{ pb: 6 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 800, mb: 0.5 }}>
            My Queue
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Patients waiting for consultation
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<SyncRounded />}
          onClick={fetchQueue}
          sx={{
            color: DOCTOR_BLUE, borderColor: `rgba(59,130,246,0.4)`,
            fontWeight: 600, textTransform: "none",
            "&:hover": { borderColor: DOCTOR_BLUE, bgcolor: "rgba(59,130,246,0.06)" },
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
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper", overflow: "hidden" }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {["Token", "Patient", "Vitals Status", "Queue Status", "Action"].map((h, i) => (
                  <TableCell
                    key={h}
                    align={i === 4 ? "right" : "left"}
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
                  <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                    <CircularProgress size={30} sx={{ color: DOCTOR_BLUE }} />
                  </TableCell>
                </TableRow>
              ) : tokens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8, color: "text.secondary" }}>
                    No patients in queue today
                  </TableCell>
                </TableRow>
              ) : (
                tokens.map(token => {
                  const hasVitals = token.appointmentId && vitalsRecorded.has(token.appointmentId);
                  const isCompleted = token.statusCode === "COMPLETED" || token.statusCode === "CANCELLED";
                  const isInProgress = token.statusCode === "IN_CONSULTATION";

                  return (
                    <TableRow key={token.queueTokenId} sx={{ "&:hover": { bgcolor: "background.default" } }}>
                      {/* Token Number */}
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                        <Avatar
                          sx={{
                            width: 40, height: 40, fontWeight: 800, fontSize: "0.9rem",
                            bgcolor: isInProgress ? "rgba(59,130,246,0.15)" : `rgba(148,163,184,0.15)`,
                            color: isInProgress ? DOCTOR_BLUE : "text.secondary",
                            border: `2px solid ${isInProgress ? "rgba(59,130,246,0.3)" : "rgba(148,163,184,0.3)"}`,
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
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                          {token.reason || "General Consultation"}
                        </Typography>
                      </TableCell>

                      {/* Vitals Status */}
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                        {hasVitals ? (
                          <Tooltip title="View Vitals">
                            <Chip
                              icon={<MonitorHeartRounded sx={{ fontSize: "14px !important" }} />}
                              label="Recorded"
                              size="small"
                              sx={{ bgcolor: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", fontWeight: 600, fontSize: "0.7rem", cursor: "pointer" }}
                              onClick={() => setVitalsDialog({ open: true, token, readonly: true })}
                            />
                          </Tooltip>
                        ) : (
                          <Chip
                            label="Not Recorded"
                            size="small"
                            sx={{ bgcolor: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", fontWeight: 600, fontSize: "0.7rem" }}
                          />
                        )}
                      </TableCell>

                      {/* Queue Status */}
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                        <Chip
                          label={token.statusLabel} size="small"
                          sx={{ bgcolor: `${token.statusColor}22`, color: token.statusColor, border: `1px solid ${token.statusColor}55`, fontWeight: 600, fontSize: "0.7rem" }}
                        />
                      </TableCell>

                      {/* Action */}
                      <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                        {!isCompleted ? (
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<LocalHospitalRounded />}
                            onClick={() => navigate(`/doctor/consultation/${token.appointmentId}`)}
                            sx={{
                              background: `linear-gradient(135deg, ${DOCTOR_BLUE_DARK}, ${DOCTOR_BLUE})`,
                              textTransform: "none", fontWeight: 600,
                              boxShadow: "0 2px 8px rgba(59,130,246,0.25)",
                              "&:hover": { background: `linear-gradient(135deg, #1d4ed8, ${DOCTOR_BLUE_DARK})` },
                            }}
                          >
                            {isInProgress ? "Resume Consultation" : "Start Consultation"}
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<VisibilityRounded />}
                            onClick={() => navigate(`/doctor/consultation/${token.appointmentId}`)}
                            sx={{
                              color: "text.secondary", borderColor: "divider",
                              textTransform: "none", fontWeight: 600,
                              "&:hover": { bgcolor: "background.default", color: "text.primary" },
                            }}
                          >
                            View Summary
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
          onClose={() => setVitalsDialog({ open: false, token: null, readonly: true })}
          appointmentId={vitalsDialog.token.appointmentId}
          patientId={vitalsDialog.token.patientId}
          patientName={vitalsDialog.token.patientName}
          onSaved={() => {}} // Read-only for doctor in this view, though they could update if needed
          readonly={vitalsDialog.readonly}
        />
      )}
    </Box>
  );
}
