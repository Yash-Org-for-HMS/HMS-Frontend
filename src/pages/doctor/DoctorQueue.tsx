import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

const getDoctorInitials = (doctorName?: string) => {
  if (!doctorName || doctorName === "Unknown") return "";
  const cleanName = doctorName.replace(/^Dr\.\s*/i, "");
  const parts = cleanName.split(" ").filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const DOCTOR_BLUE = "#3b82f6";
const DOCTOR_BLUE_DARK = "#2563eb";

export default function DoctorQueue() {
  const navigate = useNavigate();
  const { data: tokens = [], isLoading: loading, error, refetch: fetchQueue } = useQuery({
    queryKey: ["doctor-queue"],
    queryFn: async () => {
      const res = await axiosInstance.get("/doctor/queue");
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  const [vitalsDialog, setVitalsDialog] = useState<{ open: boolean; token: any; readonly: boolean }>({ open: false, token: null, readonly: true });

  // Listen for real-time queue updates
  useSocket({
    QUEUE_UPDATED: fetchQueue
  });

  const waiting = tokens.filter((t: any) => t.statusCode === "WAITING_FOR_VITALS" || t.statusCode === "READY_FOR_DOCTOR").length;
  const inProgress = tokens.filter((t: any) => t.statusCode === "IN_CONSULTATION").length;
  const completed = tokens.filter((t: any) => t.statusCode === "COMPLETED" || t.statusCode === "CANCELLED").length;
  const skipped = tokens.filter((t: any) => t.statusCode === "SKIPPED").length;

  const activeTokens = tokens.filter((t: any) => t.statusCode !== "SKIPPED" && t.statusCode !== "COMPLETED" && t.statusCode !== "CANCELLED");
  const skippedTokens = tokens.filter((t: any) => t.statusCode === "SKIPPED");

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
          onClick={() => fetchQueue()}
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
        {skipped > 0 && (
          <Chip
            label={`${skipped} Skipped`}
            sx={{ bgcolor: "rgba(249,115,22,0.1)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)", fontWeight: 600 }}
          />
        )}
        <Chip
          icon={<CheckCircleRounded sx={{ fontSize: "16px !important" }} />}
          label={`${completed} Completed`}
          sx={{ bgcolor: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", fontWeight: 600 }}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>Failed to load queue</Alert>}

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
              {loading && activeTokens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                    <CircularProgress size={30} sx={{ color: DOCTOR_BLUE }} />
                  </TableCell>
                </TableRow>
              ) : activeTokens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8, color: "text.secondary" }}>
                    No active patients in queue
                  </TableCell>
                </TableRow>
              ) : (
                activeTokens.map((token: any) => {
                  const hasVitals = token.vitalsRecorded;
                  const isInProgress = token.statusCode === "IN_CONSULTATION";

                  return (
                    <TableRow key={token.queueTokenId} sx={{ "&:hover": { bgcolor: "background.default" } }}>
                      {/* Token Number */}
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                        <Chip 
                          label={`${getDoctorInitials(token.doctorName)}-${token.displayNumber}`}
                          sx={{
                            bgcolor: isInProgress ? "rgba(59,130,246,0.15)" : `rgba(148,163,184,0.15)`,
                            color: isInProgress ? DOCTOR_BLUE : "text.secondary",
                            border: `1px solid ${isInProgress ? "rgba(59,130,246,0.3)" : "rgba(148,163,184,0.3)"}`,
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
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Skipped Patients Section */}
      {skippedTokens.length > 0 && (
        <Box sx={{ mt: 6 }}>
          <Typography variant="h6" sx={{ color: "text.secondary", fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            Skipped / Absent Patients
            <Chip label={skippedTokens.length} size="small" sx={{ bgcolor: 'rgba(249,115,22,0.1)', color: '#f97316', fontWeight: 800 }} />
          </Typography>
          <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "rgba(249,115,22,0.2)", bgcolor: "rgba(249,115,22,0.02)", overflow: "hidden" }}>
            <TableContainer>
              <Table>
                <TableBody>
                  {skippedTokens.map((token: any) => (
                    <TableRow key={token.queueTokenId} sx={{ opacity: 0.85, "&:hover": { opacity: 1, bgcolor: "rgba(249,115,22,0.05)" }, transition: 'all 0.2s' }}>
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "rgba(249,115,22,0.1)", width: '15%' }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#f97316' }}>{getDoctorInitials(token.doctorName)}-{token.displayNumber}</Typography>
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "rgba(249,115,22,0.1)", width: '35%' }}>
                        <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>{token.patientName}</Typography>
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "rgba(249,115,22,0.1)", width: '25%' }}>
                        <Chip
                          label="Skipped" size="small"
                          sx={{ bgcolor: `rgba(249,115,22,0.1)`, color: '#f97316', border: `1px solid rgba(249,115,22,0.3)`, fontWeight: 600, fontSize: "0.7rem" }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "rgba(249,115,22,0.1)", width: '25%' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<PlayArrowRounded />}
                          onClick={() => navigate(`/doctor/consultation/${token.appointmentId}`)}
                          sx={{
                            color: "#f97316", borderColor: "rgba(249,115,22,0.5)",
                            textTransform: "none", fontWeight: 600,
                            "&:hover": { bgcolor: "rgba(249,115,22,0.1)", borderColor: "#f97316" },
                          }}
                        >
                          Recall Patient
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

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
