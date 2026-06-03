import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Tooltip,
  CircularProgress, Alert, Avatar, Menu, MenuItem
} from "@mui/material";
import {
  MoreVertRounded, PlayArrowRounded, CheckCircleRounded,
  SkipNextRounded, CancelRounded, SyncRounded, ReceiptRounded
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import BillingModal from "./BillingModal";

export default function QueueDashboard() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [selectedAppt, setSelectedAppt] = useState<any>(null);
  const [billingDialog, setBillingDialog] = useState<{ open: boolean, appt: any }>({ open: false, appt: null });

  const fetchQueue = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/reception/queue");
      setTokens(res.data.data);
    } catch (err: any) {
      setError("Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    // Auto refresh every 30s
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

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
      patientName: token.patientName,
      appointmentDate: token.createdAt // Queue token has createdAt or we can just use today
    });
  };

  const openBilling = () => {
    setAnchorEl(null);
    if (selectedAppt) {
      setBillingDialog({ open: true, appt: selectedAppt });
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: "#f1f5f9", fontWeight: 800, mb: 0.5 }}>
            Live Queue Management
          </Typography>
          <Typography variant="body2" sx={{ color: "#475569" }}>
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

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid rgba(6, 182, 212, 0.1)", background: "linear-gradient(135deg, #0c1a3a 0%, #0f172a 100%)", overflow: "hidden" }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {["Token", "Patient", "Doctor", "Status", "Quick Actions", ""].map((h, i) => (
                  <TableCell key={h} align={i >= 4 ? "right" : "left"} sx={{ color: "#475569", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", py: 2, bgcolor: "rgba(6, 182, 212, 0.03)", borderBottom: "1px solid rgba(6, 182, 212, 0.08)" }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && tokens.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress size={30} sx={{ color: "#06b6d4" }}/></TableCell></TableRow>
              ) : tokens.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: "#64748b" }}>No patients in queue today</TableCell></TableRow>
              ) : (
                tokens.map(token => {
                  const isWaiting = token.statusCode === 'WAITING' || token.statusCode === 'SKIPPED';
                  const isInProgress = token.statusCode === 'IN_PROGRESS';
                  return (
                    <TableRow key={token.queueTokenId} sx={{ "&:hover": { bgcolor: "rgba(6, 182, 212, 0.03)" } }}>
                      <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <Avatar sx={{ bgcolor: token.statusColor || "#f59e0b", width: 40, height: 40, fontWeight: 800 }}>
                          {token.displayNumber}
                        </Avatar>
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <Typography variant="body2" sx={{ color: "#e2e8f0", fontWeight: 600 }}>{token.patientName}</Typography>
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.04)", color: "#94a3b8", fontSize: "0.85rem" }}>
                        {token.doctorName}
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <Chip label={token.statusLabel} size="small" sx={{ bgcolor: `${token.statusColor}22`, color: token.statusColor, border: `1px solid ${token.statusColor}55`, fontWeight: 600, fontSize: "0.7rem" }} />
                      </TableCell>
                      <TableCell align="right" sx={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
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
                      <TableCell align="right" sx={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <IconButton size="small" onClick={(e) => handleMenuClick(e, token)} sx={{ color: "#475569" }}>
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
        PaperProps={{ sx: { bgcolor: "#0c1a3a", color: "#f8fafc", border: "1px solid rgba(6,182,212,0.2)" } }}
      >
        {selectedAppt?.appointmentId && (
          <MenuItem onClick={openBilling} sx={{ "&:hover": { bgcolor: "rgba(255,255,255,0.05)" } }}>
            <ReceiptRounded fontSize="small" sx={{ mr: 1.5, color: "#f59e0b" }} /> Billing & Receipt
          </MenuItem>
        )}
        <MenuItem onClick={() => handleAction('skip')} sx={{ "&:hover": { bgcolor: "rgba(255,255,255,0.05)" } }}>
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
    </Box>
  );
}
