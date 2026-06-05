import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Tooltip,
  CircularProgress, Alert, Avatar, Menu, MenuItem
} from "@mui/material";
import {
  MoreVertRounded, PlayArrowRounded, CheckCircleRounded,
  SkipNextRounded, CancelRounded, SyncRounded, ReceiptRounded,
  MonitorHeartRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import BillingModal from "./BillingModal";
import VitalsModal from "./VitalsModal";
import { useSocket } from "../../hooks/useSocket";

export default function QueueDashboard() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [selectedAppt, setSelectedAppt] = useState<any>(null);
  const [billingDialog, setBillingDialog] = useState<{ open: boolean, appt: any }>({ open: false, appt: null });
  const [vitalsDialog, setVitalsDialog] = useState<{ open: boolean, appt: any }>({ open: false, appt: null });
  const [vitalsCollector, setVitalsCollector] = useState<"RECEPTIONIST" | "NURSE">("RECEPTIONIST");
  const [vitalsRecorded, setVitalsRecorded] = useState<Set<string>>(new Set()); // appointmentIds

  const fetchQueue = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/reception/queue");
      const tokenList = res.data.data;
      setTokens(tokenList);

      // Check which appointments already have vitals recorded
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
    } catch (err: any) {
      setError("Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    // Fetch hospital settings to determine vitalsCollector
    axiosInstance.get("/hospital/settings").then(res => {
      const collector = res.data?.data?.settings?.vitalsCollector;
      if (collector) setVitalsCollector(collector);
    }).catch(() => {});
    // Auto refresh every 30s as a fallback
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Listen for real-time queue updates
  useSocket({
    QUEUE_UPDATED: fetchQueue
  });

  const handleAction = async (action: 'call' | 'complete' | 'skip' | 'cancel') => {
    setAnchorEl(null);
    if (!selectedTokenId) return;
    try {
      await axiosInstance.put(`/reception/queue/${selectedTokenId}/${action}`);
      fetchQueue();
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to ${action} patient`);
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, token: any) => {
    setAnchorEl(event.currentTarget);
    setSelectedTokenId(token.queueTokenId);
    setSelectedAppt({
      appointmentId: token.appointmentId,
      patientId: token.patientId,
      patientName: token.patientName,
      appointmentDate: token.createdAt
    });
  };

  const openBilling = () => {
    setAnchorEl(null);
    if (selectedAppt) {
      setBillingDialog({ open: true, appt: selectedAppt });
    }
  };

  const openVitals = () => {
    setAnchorEl(null);
    if (selectedAppt) {
      setVitalsDialog({ open: true, appt: selectedAppt });
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 800, mb: 0.5 }}>
            Live Queue Management
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Monitor and manage today's patient queue
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<SyncRounded />}
          onClick={fetchQueue}
          sx={{
            color: "#06b6d4", borderColor: "rgba(6,182,212,0.5)", fontWeight: 600,
            "&:hover": { borderColor: "#0891b2", bgcolor: "rgba(6,182,212,0.1)" }
          }}
        >
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper", overflow: "hidden" }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {["Token", "Patient", "Doctor", "Status", "Vitals", "Quick Actions", ""].map((h, i) => (
                  <TableCell key={h} align={i >= 5 ? "right" : "left"} sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", py: 2, bgcolor: "background.default", borderBottom: "1px solid", borderColor: "divider" }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && tokens.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress size={30} sx={{ color: "#06b6d4" }}/></TableCell></TableRow>
              ) : tokens.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: "text.secondary" }}>No patients in queue today</TableCell></TableRow>
              ) : (
                tokens.map(token => {
                  const isWaiting = token.statusCode === 'WAITING_FOR_VITALS' || token.statusCode === 'READY_FOR_DOCTOR' || token.statusCode === 'SKIPPED';
                  const isInProgress = token.statusCode === 'IN_CONSULTATION';
                  return (
                    <TableRow key={token.queueTokenId} sx={{ "&:hover": { bgcolor: "background.default" } }}>
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                        <Avatar sx={{ bgcolor: token.statusColor || "#f59e0b", width: 40, height: 40, fontWeight: 800 }}>
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
                        <Chip label={token.statusLabel} size="small" sx={{ bgcolor: `${token.statusColor}22`, color: token.statusColor, border: `1px solid ${token.statusColor}55`, fontWeight: 600, fontSize: "0.7rem" }} />
                      </TableCell>
                      {/* Vitals Badge Cell */}
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                        {token.appointmentId && vitalsRecorded.has(token.appointmentId) ? (
                          <Tooltip title="Vitals recorded">
                            <Chip
                              icon={<MonitorHeartRounded sx={{ fontSize: "14px !important" }} />}
                              label="Recorded"
                              size="small"
                              sx={{ bgcolor: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", fontWeight: 600, fontSize: "0.68rem" }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: "italic" }}>Pending</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                        {isWaiting && (
                          <Button
                            size="small" variant="contained"
                            startIcon={<PlayArrowRounded />}
                            onClick={() => { setSelectedTokenId(token.queueTokenId); handleAction('call'); }}
                            sx={{ bgcolor: "#3b82f6", "&:hover": { bgcolor: "#2563eb" }, textTransform: "none", mr: 1 }}
                          >
                            Call Next
                          </Button>
                        )}
                        {isInProgress && (
                          <Button
                            size="small" variant="contained"
                            startIcon={<CheckCircleRounded />}
                            onClick={() => { setSelectedTokenId(token.queueTokenId); handleAction('complete'); }}
                            sx={{ bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" }, textTransform: "none", mr: 1 }}
                          >
                            Complete
                          </Button>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                        <IconButton size="small" onClick={(e) => handleMenuClick(e, token)} sx={{ color: "text.secondary" }}>
                          <MoreVertRounded fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { bgcolor: "background.paper", color: "text.primary", border: "1px solid", borderColor: "divider" } }}
      >
        {/* Record Vitals — only shown when hospital is configured for Receptionist vitals */}
        {vitalsCollector === "RECEPTIONIST" && selectedAppt?.appointmentId && (
          <MenuItem onClick={openVitals} sx={{ "&:hover": { bgcolor: "rgba(6,182,212,0.08)" } }}>
            <MonitorHeartRounded fontSize="small" sx={{ mr: 1.5, color: "#06b6d4" }} />
            {vitalsRecorded.has(selectedAppt.appointmentId) ? "Update Vitals" : "Record Vitals"}
          </MenuItem>
        )}
        {selectedAppt?.appointmentId && (
          <MenuItem onClick={openBilling} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
            <ReceiptRounded fontSize="small" sx={{ mr: 1.5, color: "#f59e0b" }} /> Billing & Receipt
          </MenuItem>
        )}
        <MenuItem onClick={() => handleAction('skip')} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
          <SkipNextRounded fontSize="small" sx={{ mr: 1.5, color: "#f59e0b" }} /> Skip Patient
        </MenuItem>
        <MenuItem onClick={() => handleAction('cancel')} sx={{ "&:hover": { bgcolor: "rgba(239,68,68,0.1)" }, color: "#ef4444" }}>
          <CancelRounded fontSize="small" sx={{ mr: 1.5, color: "#ef4444" }} /> Cancel Token
        </MenuItem>
      </Menu>

      {/* Billing Modal */}
      {billingDialog.appt && (
        <BillingModal
          open={billingDialog.open}
          onClose={() => setBillingDialog({ open: false, appt: null })}
          appointmentId={billingDialog.appt.appointmentId}
          patientName={billingDialog.appt.patientName}
          appointmentDate={billingDialog.appt.appointmentDate || new Date().toISOString()}
        />
      )}

      {/* Vitals Modal */}
      {vitalsDialog.appt && (
        <VitalsModal
          open={vitalsDialog.open}
          onClose={() => setVitalsDialog({ open: false, appt: null })}
          appointmentId={vitalsDialog.appt.appointmentId}
          patientId={vitalsDialog.appt.patientId}
          patientName={vitalsDialog.appt.patientName}
          onSaved={() => {
            setVitalsRecorded(prev => new Set([...prev, vitalsDialog.appt.appointmentId]));
          }}
        />
      )}
    </Box>
  );
}
