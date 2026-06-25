import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Tooltip,
  TextField, InputAdornment, CircularProgress, Alert,
  Dialog, DialogContent, Grid, Tabs, Tab, Avatar, Stack, Popover
} from "@mui/material";
import {
  AddRounded, SearchRounded, CancelRounded, CheckCircleRounded,
  WarningAmberRounded, ReceiptRounded, NotificationsActiveRounded, ChecklistRounded,
  NotesRounded, ChevronLeftRounded, ChevronRightRounded, CalendarMonthRounded,
  FilterAltRounded, EventRepeatRounded, CallSplitRounded
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "../../api/axios";
import Mascot from "../../components/Mascot";
import ErrorState from "../../components/ErrorState";
import BillingModal from "./BillingModal";
import { TableRowsSkeleton } from "../../components/TableRowsSkeleton";
import ReferralDialog from "../../components/reception/ReferralDialog";
import { useToast } from "../../contexts/ToastContext";
import PageHeader from "../../components/layout/PageHeader";
import dayjs, { Dayjs } from "dayjs";

const getAppointmentType = (reason: string | null | undefined) => {
  if (!reason) return { label: "Standard", color: "#64748b", bgcolor: "rgba(100,116,139,0.1)" };
  const lower = reason.toLowerCase();
  if (lower.includes("urgent") || lower.includes("emergency") || lower.includes("stat")) {
    return { label: "Urgent", color: "#ef4444", bgcolor: "rgba(239,68,68,0.1)" };
  }
  if (lower.includes("follow") || lower.includes("review")) {
    return { label: "Follow-up", color: "#3b82f6", bgcolor: "rgba(59,130,246,0.1)" };
  }
  return { label: "Standard", color: "#64748b", bgcolor: "rgba(100,116,139,0.1)" };
};

function MiniCalendar({ selectedDate, onDateChange, highlightedDays }: { selectedDate: Dayjs | null, onDateChange: (d: Dayjs) => void, highlightedDays: string[] }) {
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf('month'));
  
  const daysInMonth = currentMonth.daysInMonth();
  const firstDay = currentMonth.day();
  
  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(currentMonth.date(i));
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <IconButton size="small" onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))}>
          <ChevronLeftRounded />
        </IconButton>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
          {currentMonth.format("MMMM YYYY")}
        </Typography>
        <IconButton size="small" onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))}>
          <ChevronRightRounded />
        </IconButton>
      </Box>
      
      {/* Days of week header */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', mb: 1 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <Box key={d}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{d}</Typography>
          </Box>
        ))}
      </Box>

      {/* Calendar grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
        {days.map((day, idx) => {
          if (!day) return <Box key={`empty-${idx}`} />;
          const isSelected = selectedDate && day.isSame(selectedDate, 'day');
          const isToday = day.isSame(dayjs(), 'day');
          const dateStr = day.format("YYYY-MM-DD");
          const hasAppointments = highlightedDays.includes(dateStr);
          
          return (
            <Box key={dateStr} sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                onClick={() => onDateChange(day)}
                sx={{
                  minWidth: 0, width: 32, height: 32, p: 0, borderRadius: '50%',
                  bgcolor: isSelected ? '#0891b2' : isToday ? 'rgba(8,145,178,0.1)' : 'transparent',
                  color: isSelected ? '#fff' : isToday ? '#0891b2' : 'text.primary',
                  "&:hover": { bgcolor: isSelected ? '#0e7490' : 'rgba(8,145,178,0.2)' },
                  position: 'relative'
                }}
              >
                {day.date()}
                {hasAppointments && !isSelected && (
                  <Box sx={{ position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: '50%', bgcolor: '#0891b2' }} />
                )}
                {hasAppointments && isSelected && (
                  <Box sx={{ position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: '50%', bgcolor: '#fff' }} />
                )}
              </Button>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default function AppointmentsList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const toast = useToast();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const [tabValue, setTabValue] = useState("today");
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs());
  const [calendarAnchor, setCalendarAnchor] = useState<HTMLButtonElement | null>(null);

  const [actionDialog, setActionDialog] = useState<{ open: boolean, type: 'cancel' | 'checkin' | null, appt: any }>({
    open: false, type: null, appt: null
  });
  const [processing, setProcessing] = useState(false);
  const [billingDialog, setBillingDialog] = useState<{ open: boolean, appt: any }>({ open: false, appt: null });
  const [referralDialog, setReferralDialog] = useState<{ open: boolean, appt: any }>({ open: false, appt: null });

  const { data: appointments = [], isLoading: loading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["reception-appointments"],
    queryFn: async () => (await axiosInstance.get("/reception/appointments")).data.data,
  });

  const handleAction = async () => {
    if (!actionDialog.appt || !actionDialog.type) return;
    const actionType = actionDialog.type;
    setProcessing(true);
    try {
      if (actionType === 'cancel') {
        await axiosInstance.put(`/reception/appointments/${actionDialog.appt.appointmentId}/cancel`, { reason: "Cancelled by reception" });
      } else if (actionType === 'checkin') {
        await axiosInstance.put(`/reception/appointments/${actionDialog.appt.appointmentId}/checkin`);
      }
      setActionDialog({ open: false, type: null, appt: null });
      refetch();
      toast.success(actionType === 'cancel' ? "Appointment cancelled" : "Patient checked in");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to process action");
    } finally {
      setProcessing(false);
    }
  };

  const handleSendNotification = async (apptId: string, type: 'reminder' | 'visit-confirmation') => {
    try {
      setProcessing(true);
      setSuccessMsg(null);
      const res = await axiosInstance.post(`/reception/notifications/appointments/${apptId}/${type}`);
      setSuccessMsg(res.data.message || "Notification sent");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to send notification");
    } finally {
      setProcessing(false);
    }
  };

  const handleDateChange = (newDate: Dayjs) => {
    setSelectedDate(newDate);
    setTabValue("date");
    setCalendarAnchor(null);
  };

  const filteredAppointments = useMemo(() => {
    let filtered = appointments;

    // If searching, ignore date tabs and search globally
    if (search) {
      const s = search.toLowerCase();
      return filtered.filter(a =>
        (a.patientName && a.patientName.toLowerCase().includes(s)) ||
        (a.doctorName && a.doctorName.toLowerCase().includes(s)) ||
        (a.uhid && a.uhid.toLowerCase().includes(s)) ||
        (a.reason && a.reason.toLowerCase().includes(s)) ||
        (a.tokenNumber && String(a.tokenNumber).includes(s))
      );
    }

    const today = dayjs().startOf('day');
    if (tabValue === "today") {
      filtered = filtered.filter(a => dayjs(a.appointmentDate).isSame(today, 'day'));
    } else if (tabValue === "this_week") {
      const endOfWeek = today.add(7, 'day');
      filtered = filtered.filter(a => {
        const d = dayjs(a.appointmentDate);
        return (d.isAfter(today) || d.isSame(today, 'day')) && (d.isBefore(endOfWeek) || d.isSame(endOfWeek, 'day'));
      });
    } else if (tabValue === "date" && selectedDate) {
      filtered = filtered.filter(a => dayjs(a.appointmentDate).isSame(selectedDate, 'day'));
    }

    return filtered;
  }, [appointments, search, tabValue, selectedDate]);

  const highlightedDays = useMemo(() => {
    return appointments.map(a => dayjs(a.appointmentDate).format("YYYY-MM-DD"));
  }, [appointments]);

  const avatarColors = ["#0891b2", "#7c3aed", "#059669", "#dc2626", "#d97706", "#2563eb", "#db2777", "#65a30d"];
  const getAvatarColor = (id: string) => avatarColors[(id || "A").charCodeAt(0) % avatarColors.length];

  return (
    <Box>
      <PageHeader
        title="Appointments"
        subtitle="Manage scheduling, check-ins, and patient flow"
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<CalendarMonthRounded />}
              onClick={() => navigate("/reception/appointments/calendar")}
              sx={{ fontWeight: 600, px: 3, py: 1.2, textTransform: "none", borderRadius: 2, borderColor: "divider", color: "text.secondary" }}
            >
              Calendar view
            </Button>
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => navigate("/reception/appointments/new")}
              sx={{
                background: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)",
                fontWeight: 600, px: 3, py: 1.2, textTransform: "none", borderRadius: 2,
                boxShadow: "0 4px 14px rgba(6, 182, 212, 0.4)",
              }}
            >
              Book Appointment
            </Button>
          </>
        }
      />

      {successMsg && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}

      {/* Toolbar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', flexGrow: 1, display: 'flex', gap: 2, alignItems: 'center' }}>
          <Tabs 
            value={tabValue} 
            onChange={(e, v) => { setTabValue(v); if(v === "today") setSelectedDate(dayjs()); }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.95rem" } }}
          >
            <Tab label="Today" value="today" />
            <Tab label="Next 7 Days" value="this_week" />
            <Tab label="All" value="all" />
            {tabValue === "date" && <Tab label={`Selected: ${selectedDate?.format("MMM DD, YYYY")}`} value="date" />}
          </Tabs>

          <Button
            size="small"
            variant={tabValue === 'date' ? "contained" : "outlined"}
            startIcon={<FilterAltRounded />}
            onClick={(e) => setCalendarAnchor(e.currentTarget)}
            sx={{ 
              ml: 2, mb: 1, textTransform: 'none', borderRadius: 2, 
              bgcolor: tabValue === 'date' ? '#0891b2' : 'transparent',
              borderColor: tabValue === 'date' ? '#0891b2' : 'divider',
              color: tabValue === 'date' ? '#fff' : 'text.secondary',
              "&:hover": { bgcolor: tabValue === 'date' ? '#0e7490' : 'rgba(8,145,178,0.08)' }
            }}
          >
            {tabValue === 'date' ? selectedDate?.format("MMM DD") : "Filter by Date"}
          </Button>

          <Popover
            open={Boolean(calendarAnchor)}
            anchorEl={calendarAnchor}
            onClose={() => setCalendarAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            PaperProps={{ sx: { p: 2, borderRadius: 3, mt: 1, boxShadow: '0 10px 40px rgba(0,0,0,0.1)', border: '1px solid', borderColor: 'divider' } }}
          >
            <MiniCalendar selectedDate={selectedDate} onDateChange={handleDateChange} highlightedDays={highlightedDays} />
          </Popover>
        </Box>

        <TextField
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded sx={{ color: "text.secondary", fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            minWidth: 280,
            "& .MuiOutlinedInput-root": {
              bgcolor: "background.paper", borderRadius: 2,
              "& fieldset": { borderColor: "divider" },
              "&:hover fieldset": { borderColor: "rgba(6, 182, 212, 0.4)" },
              "&.Mui-focused fieldset": { borderColor: "#06b6d4" },
            }
          }}
        />
      </Box>

      {/* Appointments List */}
      <Paper elevation={0} sx={{ 
        borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper", overflow: "hidden"
      }}>
        <TableContainer sx={{ maxHeight: 'calc(100vh - 250px)' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {["Time & Type", "Patient", "Doctor", "Status", "Actions"].map((h, i) => (
                  <TableCell key={h} align={i === 4 ? "right" : "left"} sx={{ 
                    color: "text.secondary", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", 
                    py: 2, bgcolor: "background.default", borderBottom: "1px solid", borderColor: "divider"
                  }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRowsSkeleton rows={6} columns={5} />
              ) : isError ? (
                <TableRow><TableCell colSpan={5} sx={{ py: 4, border: 0 }}><ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} /></TableCell></TableRow>
              ) : filteredAppointments.length === 0 ? (
                <TableRow><TableCell colSpan={5} sx={{ py: 4, border: 0 }}><Mascot pose="all-caught-up" title="No appointments" subtitle="No appointments found." /></TableCell></TableRow>
              ) : (
                filteredAppointments.map(appt => {
                  const typeInfo = getAppointmentType(appt.reason);
                  return (
                    <TableRow key={appt.appointmentId} sx={{ "&:hover": { bgcolor: "background.default" }, transition: "background 0.15s ease" }}>
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1.5 }}>
                        <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>
                          {new Date(appt.appointmentDate).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: 'block', mb: 0.5 }}>
                          {new Date(appt.appointmentDate).toLocaleDateString("en-IN")}
                        </Typography>
                        <Chip label={typeInfo.label} size="small" sx={{ bgcolor: typeInfo.bgcolor, color: typeInfo.color, fontWeight: 700, fontSize: "0.65rem", height: 20 }} />
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 36, height: 36, bgcolor: getAvatarColor(appt.patientId || appt.patientName), fontSize: "0.8rem", fontWeight: 700 }}>
                            {appt.patientName.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>{appt.patientName}</Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>{appt.uhid} • T-{appt.tokenNumber}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.secondary", fontSize: "0.85rem", py: 1.5 }}>
                        {appt.doctorName}
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1.5 }}>
                        <Chip label={appt.statusLabel} size="small" sx={{ bgcolor: `${appt.statusColor}22`, color: appt.statusColor, border: `1px solid ${appt.statusColor}55`, fontWeight: 600, fontSize: "0.7rem" }} />
                      </TableCell>
                      <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1.5 }}>
                        <Tooltip title="Refer Patient">
                          <IconButton size="small" onClick={() => setReferralDialog({ open: true, appt })} sx={{ color: "text.secondary", "&:hover": { color: "#06b6d4", bgcolor: "rgba(6,182,212,0.08)" } }}>
                            <CallSplitRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {appt.statusLabel === 'Scheduled' && (
                          <>
                            <Tooltip title="Check In">
                              <IconButton size="small" onClick={() => setActionDialog({ open: true, type: 'checkin', appt })} sx={{ color: "text.secondary", "&:hover": { color: "#10b981", bgcolor: "rgba(16,185,129,0.08)" } }}>
                                <CheckCircleRounded fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit / Add Notes">
                              <IconButton size="small" onClick={() => navigate(`/reception/appointments/${appt.appointmentId}/edit`)} sx={{ color: "text.secondary", "&:hover": { color: "#3b82f6", bgcolor: "rgba(59,130,246,0.08)" } }}>
                                <NotesRounded fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Billing">
                              <IconButton size="small" onClick={() => setBillingDialog({ open: true, appt })} sx={{ color: "text.secondary", "&:hover": { color: "#f59e0b", bgcolor: "rgba(245,158,11,0.08)" } }}>
                                <ReceiptRounded fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Cancel">
                              <IconButton size="small" onClick={() => setActionDialog({ open: true, type: 'cancel', appt })} sx={{ color: "text.secondary", "&:hover": { color: "#ef4444", bgcolor: "rgba(239,68,68,0.08)" } }}>
                                <CancelRounded fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Send Reminder">
                              <IconButton size="small" onClick={() => handleSendNotification(appt.appointmentId, 'reminder')} sx={{ color: "text.secondary", "&:hover": { color: "#8b5cf6", bgcolor: "rgba(139,92,246,0.08)" } }}>
                                <NotificationsActiveRounded fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        {appt.statusLabel === 'Completed' && (
                          <>
                            <Tooltip title="Book Follow-up">
                              <IconButton size="small" onClick={() => navigate(`/reception/appointments/new?patientId=${appt.patientId}&doctorId=${appt.doctorId || ""}&followUpOf=${appt.appointmentId}`)} sx={{ color: "text.secondary", "&:hover": { color: "#0891b2", bgcolor: "rgba(8,145,178,0.08)" } }}>
                                <EventRepeatRounded fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Send Visit Confirmation">
                              <IconButton size="small" onClick={() => handleSendNotification(appt.appointmentId, 'visit-confirmation')} sx={{ color: "text.secondary", "&:hover": { color: "#10b981", bgcolor: "rgba(16,185,129,0.08)" } }}>
                                <ChecklistRounded fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
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

      {/* Referral Dialog */}
      {referralDialog.appt && (
        <ReferralDialog
          open={referralDialog.open}
          onClose={() => setReferralDialog({ open: false, appt: null })}
          onCreated={() => setReferralDialog({ open: false, appt: null })}
          prefilledPatientId={referralDialog.appt.patientId}
          prefilledFromDepartmentId={referralDialog.appt.departmentId}
          lockPatient
          patientLabel={referralDialog.appt.patientName}
        />
      )}
    </Box>
  );
}
