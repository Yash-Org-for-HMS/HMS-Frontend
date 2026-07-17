import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Grid, Chip, TextField, Avatar,
  Button, Stack, Divider, Dialog, DialogTitle, DialogContent, IconButton,
} from "@mui/material";
import {
  EventAvailableRounded, BeachAccessRounded, DoNotDisturbRounded,
  ScheduleRounded, AddRounded, CloseRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import Mascot from "../../components/Mascot";
import { CardGridSkeleton } from "../../components/TableRowsSkeleton";
import PageHeader from "../../components/layout/PageHeader";
import AppointmentForm from "./AppointmentForm";
import BillingModal from "./BillingModal";
import { useToast } from "../../contexts/ToastContext";
import dayjs from "dayjs";
import { apiErrorText } from "../../utils/apiError";

const STATUS = {
  AVAILABLE: { label: "Available", color: "#10b981", icon: <EventAvailableRounded fontSize="small" /> },
  ON_LEAVE: { label: "On leave", color: "#ef4444", icon: <BeachAccessRounded fontSize="small" /> },
  OFF: { label: "Off today", color: "#64748b", icon: <DoNotDisturbRounded fontSize="small" /> },
} as const;

const fmtTime = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h)) return hhmm;
  return dayjs().hour(h).minute(m || 0).format("h:mm A");
};

export default function DoctorAvailability() {
  const toast = useToast();
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  // Booking from a doctor's card opens the SAME appointment form used
  // everywhere else (Front Desk, Appointments list) inline here, instead of
  // navigating away to a separate full-page — one consistent booking flow
  // regardless of entry point.
  const [bookingDoctorId, setBookingDoctorId] = useState<string | null>(null);
  const [billingDialog, setBillingDialog] = useState({ open: false, apptId: "", patientName: "", apptDate: "" });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["doctor-availability", date],
    queryFn: async () => (await axiosInstance.get("/reception/doctors/availability", { params: { date } })).data.data,
  });

  const summary = data?.summary;
  const doctors: any[] = data?.doctors || [];
  const isToday = date === dayjs().format("YYYY-MM-DD");

  return (
    <Box>
      {/* Header */}
      <PageHeader
        title="Doctor Availability"
        subtitle="Working hours, leaves, and today's load for the medical team"
        actions={
          <TextField
            type="date" size="small" label="Date"
            InputLabelProps={{ shrink: true }}
            value={date} onChange={(e) => setDate(e.target.value)}
            sx={{ minWidth: 180 }}
          />
        }
      />

      {/* Summary chips */}
      {summary && (
        <Stack direction="row" spacing={1.5} sx={{ mb: 3, flexWrap: "wrap", gap: 1 }}>
          <Chip label={`${summary.total} doctors`} sx={{ fontWeight: 700, bgcolor: "action.hover", color: "text.primary" }} />
          <Chip icon={STATUS.AVAILABLE.icon} label={`${summary.available} available`} sx={{ fontWeight: 700, bgcolor: "rgba(16,185,129,0.12)", color: STATUS.AVAILABLE.color }} />
          <Chip icon={STATUS.OFF.icon} label={`${summary.off} off`} sx={{ fontWeight: 700, bgcolor: "rgba(100,116,139,0.12)", color: STATUS.OFF.color }} />
          <Chip icon={STATUS.ON_LEAVE.icon} label={`${summary.onLeave} on leave`} sx={{ fontWeight: 700, bgcolor: "rgba(239,68,68,0.12)", color: STATUS.ON_LEAVE.color }} />
        </Stack>
      )}

      {isLoading ? (
        <CardGridSkeleton />
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : doctors.length === 0 ? (
        <Mascot pose="all-caught-up" title="No doctors" subtitle="No doctors are configured for this hospital yet." />
      ) : (
        <Grid container spacing={2}>
          {doctors.map((doc) => {
            const s = STATUS[doc.status as keyof typeof STATUS] || STATUS.OFF;
            return (
              <Grid key={doc.doctorId} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%", display: "flex", flexDirection: "column", gap: 1.5, opacity: doc.status === "ON_LEAVE" ? 0.85 : 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Avatar sx={{ bgcolor: s.color, width: 44, height: 44, fontWeight: 700 }}>
                      {doc.name?.replace("Dr. ", "").charAt(0) || "D"}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }} noWrap>{doc.name}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
                        {doc.department || "—"}{doc.qualification ? ` • ${doc.qualification}` : ""}
                      </Typography>
                    </Box>
                    <Chip icon={s.icon} label={s.label} size="small" sx={{ bgcolor: `${s.color}1f`, color: s.color, fontWeight: 700 }} />
                  </Box>

                  <Divider sx={{ borderColor: "divider" }} />

                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <ScheduleRounded sx={{ fontSize: 18, color: "text.secondary" }} />
                    {doc.onLeave ? (
                      <Typography variant="body2" sx={{ color: "#ef4444", fontWeight: 600 }}>
                        On leave{doc.leaveReason ? ` — ${doc.leaveReason}` : ""}
                      </Typography>
                    ) : doc.schedule ? (
                      <Typography variant="body2" sx={{ color: "text.primary" }}>
                        {fmtTime(doc.schedule.startTime)} – {fmtTime(doc.schedule.endTime)}
                        <Typography component="span" variant="caption" sx={{ color: "text.secondary", ml: 0.5 }}>
                          ({doc.schedule.slotDurationMinutes}-min slots)
                        </Typography>
                      </Typography>
                    ) : (
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>No hours scheduled</Typography>
                    )}
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: "auto" }}>
                    <Box>
                      <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>
                        {doc.appointmentCount} appt{doc.appointmentCount === 1 ? "" : "s"}
                      </Typography>
                      {doc.nextAppointmentTime && (
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {isToday ? "Next" : "First"}: {dayjs(doc.nextAppointmentTime).format("h:mm A")}
                        </Typography>
                      )}
                    </Box>
                    {!doc.onLeave && (
                      <Button
                        size="small" startIcon={<AddRounded />}
                        onClick={() => setBookingDoctorId(doc.doctorId)}
                        sx={{ textTransform: "none", color: "#0891b2", fontWeight: 600 }}
                      >
                        Book
                      </Button>
                    )}
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={!!bookingDoctorId} onClose={() => setBookingDoctorId(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Book Appointment
          <IconButton onClick={() => setBookingDoctorId(null)} sx={{ color: "text.secondary" }}><CloseRounded /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {bookingDoctorId && (
            <AppointmentForm
              isEmbedded
              initialDoctorId={bookingDoctorId}
              initialDate={date}
              onSuccess={(apptId, pName, apptDate) => {
                toast.success(`Appointment booked${pName ? ` for ${pName}` : ""}`);
                setBookingDoctorId(null);
                refetch();
                if (apptId) {
                  setBillingDialog({ open: true, apptId, patientName: pName || "Patient", apptDate: apptDate || new Date().toISOString() });
                }
              }}
              onCancel={() => setBookingDoctorId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {billingDialog.open && (
        <BillingModal
          open={billingDialog.open}
          onClose={() => setBillingDialog({ open: false, apptId: "", patientName: "", apptDate: "" })}
          appointmentId={billingDialog.apptId}
          patientName={billingDialog.patientName}
          appointmentDate={billingDialog.apptDate}
        />
      )}
    </Box>
  );
}
