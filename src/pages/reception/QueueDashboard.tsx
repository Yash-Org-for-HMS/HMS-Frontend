import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [selectedAppt, setSelectedAppt] = useState<any>(null);
  const [billingDialog, setBillingDialog] = useState<{ open: boolean, appt: any }>({ open: false, appt: null });
  const [vitalsDialog, setVitalsDialog] = useState<{ open: boolean, appt: any }>({ open: false, appt: null });

  const { data: vitalsCollector = "RECEPTIONIST" } = useQuery({
    queryKey: ['hospitalSettings', 'vitalsCollector'],
    queryFn: async () => {
      const res = await axiosInstance.get("/hospital/settings");
      return res.data?.data?.settings?.vitalsCollector || "RECEPTIONIST";
    }
  });

  const { data: tokens = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['queue'],
    queryFn: async () => {
      const res = await axiosInstance.get("/reception/queue");
      return res.data.data;
    },
    refetchInterval: 30000 // Auto refresh every 30s as a fallback
  });

  const error = queryError ? "Failed to load queue" : null;

  // Listen for real-time queue updates
  const invalidateQueue = useCallback(() => queryClient.invalidateQueries({ queryKey: ['queue'] }), [queryClient]);
  useSocket({
    QUEUE_UPDATED: invalidateQueue
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string, action: string }) => {
      return await axiosInstance.put(`/reception/queue/${id}/${action}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    }
  });

  const handleAction = async (action: 'call' | 'complete' | 'skip' | 'cancel', tokenId?: string) => {
    setAnchorEl(null);
    const idToUse = tokenId || selectedTokenId;
    if (!idToUse) return;
    actionMutation.mutate({ id: idToUse, action });
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
          onClick={invalidateQueue}
          sx={{
            color: "#06b6d4", borderColor: "rgba(6,182,212,0.5)", fontWeight: 600,
            "&:hover": { borderColor: "#0891b2", bgcolor: "rgba(6,182,212,0.1)" }
          }}
        >
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {actionMutation.isError && <Alert severity="error" sx={{ mb: 3 }}>{actionMutation.error?.message || "Action failed"}</Alert>}

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
                        {token.appointmentId && token.vitalsRecorded ? (
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
                            onClick={() => handleAction('call', token.queueTokenId)}
                            sx={{ bgcolor: "#3b82f6", "&:hover": { bgcolor: "#2563eb" }, textTransform: "none", mr: 1 }}
                          >
                            Call Next
                          </Button>
                        )}
                        {isInProgress && (
                          <Button
                            size="small" variant="contained"
                            startIcon={<CheckCircleRounded />}
                            onClick={() => handleAction('complete', token.queueTokenId)}
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
            {tokens.find((t: any) => t.appointmentId === selectedAppt.appointmentId)?.vitalsRecorded ? "Update Vitals" : "Record Vitals"}
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
            queryClient.invalidateQueries({ queryKey: ['queue'] });
          }}
        />
      )}
    </Box>
  );
}
