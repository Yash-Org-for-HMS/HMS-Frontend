import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Tooltip,
  TextField, InputAdornment, Avatar, CircularProgress, Alert,
  Dialog, DialogContent, DialogActions
} from "@mui/material";
import {
  CalendarMonthRounded, AddRounded, SearchRounded,
  EditRounded, CancelRounded, CheckCircleRounded,
  WarningAmberRounded, VisibilityRounded, ReceiptRounded,
  NotificationsActiveRounded, ChecklistRounded
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "../../api/axios";
import BillingModal from "./BillingModal";

export default function AppointmentsList() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<{ open: boolean, type: 'cancel' | 'checkin' | null, appt: any }>({
    open: false, type: null, appt: null
  });
  const [processing, setProcessing] = useState(false);
  const [billingDialog, setBillingDialog] = useState<{ open: boolean, appt: any }>({ open: false, appt: null });

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/reception/appointments");
      setAppointments(res.data.data);
    } catch (err: any) {
      setError("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleAction = async () => {
    if (!actionDialog.appt || !actionDialog.type) return;
    setProcessing(true);
    try {
      if (actionDialog.type === 'cancel') {
        await axiosInstance.put(`/reception/appointments/${actionDialog.appt.appointmentId}/cancel`, { reason: "Cancelled by reception" });
      } else if (actionDialog.type === 'checkin') {
        await axiosInstance.put(`/reception/appointments/${actionDialog.appt.appointmentId}/checkin`);
      }
      setActionDialog({ open: false, type: null, appt: null });
      fetchAppointments();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to process action");
    } finally {
      setProcessing(false);
    }
  };

  const handleSendNotification = async (apptId: string, type: 'reminder' | 'visit-confirmation') => {
    try {
      setProcessing(true);
      setError(null);
      setSuccessMsg(null);
      const res = await axiosInstance.post(`/reception/notifications/appointments/${apptId}/${type}`);
      setSuccessMsg(res.data.message || "Notification sent");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to send notification");
    } finally {
      setProcessing(false);
    }
  };

  const filteredAppointments = appointments.filter(a =>
    a.patientName?.toLowerCase().includes(search.toLowerCase()) ||
    a.doctorName?.toLowerCase().includes(search.toLowerCase()) ||
    a.uhid?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 4, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 800, mb: 0.5 }}>
            Appointments
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Manage patient appointments and check-ins
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => navigate("/reception/appointments/new")}
          sx={{
            background: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)",
            fontWeight: 600, px: 3, py: 1.2, textTransform: "none", borderRadius: 2,
            boxShadow: "0 4px 14px rgba(6, 182, 212, 0.3)",
            "&:hover": { background: "linear-gradient(135deg, #0e7490 0%, #0891b2 100%)" }
          }}
        >
          Book Appointment
        </Button>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search by patient, doctor, or MRN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
          }}
          sx={{
            maxWidth: 400,
            "& .MuiOutlinedInput-root": {
              color: "text.primary", bgcolor: "background.default", borderRadius: 2,
              "& fieldset": { borderColor: "rgba(6, 182, 212, 0.15)" },
              "&:hover fieldset": { borderColor: "rgba(6, 182, 212, 0.3)" },
              "&.Mui-focused fieldset": { borderColor: "#06b6d4" },
            }
          }}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper", overflow: "hidden" }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {["Date & Time", "Token", "Patient", "Doctor", "Status", "Actions"].map((h, i) => (
                  <TableCell key={h} align={i === 5 ? "right" : "left"} sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", py: 2, bgcolor: "background.default", borderBottom: "1px solid", borderColor: "divider" }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress size={30} sx={{ color: "#06b6d4" }}/></TableCell></TableRow>
              ) : filteredAppointments.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: "text.secondary" }}>No appointments found</TableCell></TableRow>
              ) : (
                filteredAppointments.map(appt => (
                  <TableRow key={appt.appointmentId} sx={{ "&:hover": { bgcolor: "background.default" } }}>
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                      <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>
                        {new Date(appt.appointmentDate).toLocaleDateString("en-IN")}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {new Date(appt.appointmentDate).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                      <Chip label={`T-${appt.tokenNumber}`} size="small" sx={{ bgcolor: "rgba(6,182,212,0.1)", color: "#06b6d4", fontWeight: 700 }} />
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                      <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 500 }}>{appt.patientName}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>{appt.uhid}</Typography>
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.secondary", fontSize: "0.85rem" }}>
                      {appt.doctorName}
                    </TableCell>
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                      <Chip label={appt.statusLabel} size="small" sx={{ bgcolor: `${appt.statusColor}22`, color: appt.statusColor, border: `1px solid ${appt.statusColor}55`, fontWeight: 600, fontSize: "0.7rem" }} />
                    </TableCell>
                    <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                      {appt.statusLabel === 'Scheduled' && (
                        <>
                          <Tooltip title="Check In">
                            <IconButton size="small" onClick={() => setActionDialog({ open: true, type: 'checkin', appt })} sx={{ color: "#10b981", "&:hover": { bgcolor: "rgba(16,185,129,0.1)" } }}>
                              <CheckCircleRounded fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Reschedule">
                            <IconButton size="small" onClick={() => navigate(`/reception/appointments/${appt.appointmentId}/edit`)} sx={{ color: "#3b82f6", "&:hover": { bgcolor: "rgba(59,130,246,0.1)" } }}>
                              <EditRounded fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancel">
                            <IconButton size="small" onClick={() => setActionDialog({ open: true, type: 'cancel', appt })} sx={{ color: "#ef4444", "&:hover": { bgcolor: "rgba(239,68,68,0.1)" } }}>
                              <CancelRounded fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Send Reminder">
                            <IconButton size="small" onClick={() => handleSendNotification(appt.appointmentId, 'reminder')} sx={{ color: "#8b5cf6", "&:hover": { bgcolor: "rgba(139,92,246,0.1)" } }}>
                              <NotificationsActiveRounded fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Billing">
                            <IconButton size="small" onClick={() => setBillingDialog({ open: true, appt })} sx={{ color: "#f59e0b", "&:hover": { bgcolor: "rgba(245,158,11,0.1)" } }}>
                              <ReceiptRounded fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      {appt.statusLabel === 'Completed' && (
                        <Tooltip title="Send Visit Confirmation">
                          <IconButton size="small" onClick={() => handleSendNotification(appt.appointmentId, 'visit-confirmation')} sx={{ color: "#10b981", "&:hover": { bgcolor: "rgba(16,185,129,0.1)" } }}>
                            <ChecklistRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Action Dialog */}
      <Dialog open={actionDialog.open} onClose={() => setActionDialog({ open: false, type: null, appt: null })} PaperProps={{ sx: { bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3 } }}>
        <DialogContent sx={{ p: 4, textAlign: "center" }}>
          {actionDialog.type === 'cancel' ? (
            <WarningAmberRounded sx={{ fontSize: 48, color: "#ef4444", mb: 2 }} />
          ) : (
            <CheckCircleRounded sx={{ fontSize: 48, color: "#10b981", mb: 2 }} />
          )}
          <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700, mb: 1 }}>
            {actionDialog.type === 'cancel' ? 'Cancel Appointment?' : 'Check In Patient?'}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
            Are you sure you want to {actionDialog.type === 'cancel' ? 'cancel' : 'check in'} the appointment for {actionDialog.appt?.patientName}?
          </Typography>
          <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
            <Button variant="outlined" onClick={() => setActionDialog({ open: false, type: null, appt: null })} sx={{ color: "text.secondary", borderColor: "divider", textTransform: "none" }}>
              Go Back
            </Button>
            <Button variant="contained" onClick={handleAction} disabled={processing} sx={{ bgcolor: actionDialog.type === 'cancel' ? '#ef4444' : '#10b981', "&:hover": { bgcolor: actionDialog.type === 'cancel' ? '#dc2626' : '#059669' }, textTransform: "none" }}>
              {processing ? <CircularProgress size={20} color="inherit" /> : 'Confirm'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Billing Modal */}
      {billingDialog.appt && (
        <BillingModal
          open={billingDialog.open}
          onClose={() => setBillingDialog({ open: false, appt: null })}
          appointmentId={billingDialog.appt.appointmentId}
          patientName={billingDialog.appt.patientName}
          appointmentDate={billingDialog.appt.appointmentDate}
        />
      )}
    </Box>
  );
}
