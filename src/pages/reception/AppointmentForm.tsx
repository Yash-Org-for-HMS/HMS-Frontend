import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Button, Paper, TextField, MenuItem,
  Alert, Grid, IconButton, FormControlLabel, Switch
} from "@mui/material";
import { ArrowBackRounded, SaveRounded } from "@mui/icons-material";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { axiosInstance } from "../../api/axios";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import ErrorState from "../../components/ErrorState";
import BillingModal from "./BillingModal";
import { useToast } from "../../contexts/ToastContext";
import PageHeader from "../../components/layout/PageHeader";

export interface AppointmentFormProps {
  isEmbedded?: boolean;
  prefilledPatientId?: string;
  onSuccess?: (apptId?: string, patientName?: string, apptDate?: string) => void;
  onCancel?: () => void;
}

export default function AppointmentForm({ isEmbedded = false, prefilledPatientId, onSuccess, onCancel }: AppointmentFormProps = {}) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get("patientId") || "";
  const initialDate = searchParams.get("date") || new Date().toISOString().split('T')[0];
  const initialTime = searchParams.get("time") || "";
  const initialDoctorId = searchParams.get("doctorId") || "";
  const followUpOf = searchParams.get("followUpOf") || "";

  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const [checkInImmediately, setCheckInImmediately] = useState(true);
  const [postBooking, setPostBooking] = useState<{ apptId?: string; patientName: string; apptDate: string } | null>(null);

  const { data: dropdowns = { departments: [], doctors: [], patients: [], statuses: [], doctorSchedules: [] }, isLoading: ddLoading, isError: ddIsError, error: ddError, refetch: refetchDd } = useQuery({
    queryKey: ["appointment-dropdowns"],
    queryFn: async () => (await axiosInstance.get("/reception/appointments/dropdowns")).data.data,
  });

  const [formData, setFormData] = useState({
    patientId: prefilledPatientId || initialPatientId,
    departmentId: "",
    doctorId: initialDoctorId,
    appointmentDate: initialDate,
    timeSlot: initialTime,
    visitType: followUpOf ? "Follow-up" : "Standard Visit",
    reason: ""
  });

  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  // Doctor availability for the chosen date: whether they're on leave, and the
  // times already booked (doctor-wide). Drives slot filtering below.
  const { data: availability } = useQuery<{ onLeave: boolean; leaveReason: string | null; bookedDateTimes: string[] }>({
    queryKey: ["appointment-availability", formData.doctorId, formData.appointmentDate, id],
    queryFn: async () => (await axiosInstance.get("/reception/appointments/availability", {
      params: { doctorId: formData.doctorId, date: formData.appointmentDate, ...(id ? { excludeAppointmentId: id } : {}) },
    })).data.data,
    enabled: !!formData.doctorId && !!formData.appointmentDate,
  });

  useEffect(() => {
    if (prefilledPatientId) {
      setFormData(prev => ({ ...prev, patientId: prefilledPatientId }));
    }
  }, [prefilledPatientId]);

  const { data: apptData, isLoading: apptLoading, isError: apptIsError, error: apptError, refetch: refetchAppt } = useQuery({
    queryKey: ["appointment-edit", id],
    queryFn: async () => (await axiosInstance.get(`/reception/appointments/${id}`)).data.data,
    enabled: !!id,
  });

  // Seed the form with the existing appointment when editing.
  useEffect(() => {
    if (!apptData) return;
    const appt = apptData;
    const dateObj = new Date(appt.appointmentDate);
    const dateStr = dateObj.toISOString().split('T')[0];
    const timeStr = dateObj.toLocaleTimeString("en-US", { hour12: false, hour: '2-digit', minute: '2-digit' });
    const existingReason = appt.reason || "";
    let parsedType = "Standard Visit";
    const lower = existingReason.toLowerCase();
    if (lower.includes("urgent") || lower.includes("emergency")) parsedType = "Urgent";
    else if (lower.includes("follow") || lower.includes("review")) parsedType = "Follow-up";
    const cleanReason = existingReason.replace(/\[.*?\]\s*/, "").trim();

    setFormData({
      patientId: appt.patientId || "",
      departmentId: appt.departmentId || "",
      doctorId: appt.doctorId || "",
      appointmentDate: dateStr,
      timeSlot: timeStr,
      visitType: parsedType,
      reason: cleanReason,
    });
  }, [apptData]);

  const loading = ddLoading || (!!id && apptLoading);
  const isError = ddIsError || apptIsError;
  const error = ddError || apptError;
  const refetch = () => { refetchDd(); if (id) refetchAppt(); };

  useEffect(() => {
    // No doctor/date, or the doctor is on leave that day -> no bookable slots.
    if (!formData.doctorId || !formData.appointmentDate || availability?.onLeave) {
      setAvailableSlots([]);
      return;
    }

    const date = new Date(formData.appointmentDate);
    const dayOfWeek = date.getDay(); // 0 (Sun) - 6 (Sat)
    const schedules = (dropdowns?.doctorSchedules || []).filter((s: any) => s.doctorId === formData.doctorId && s.dayOfWeek === dayOfWeek);

    let rawSlots: string[];
    if (schedules.length > 0) {
      // Generate slots from the first matching schedule.
      const sched = schedules[0];
      rawSlots = [];
      const [hour, minute] = (sched.startTime || "09:00").split(':').map(Number);
      const [endHour, endMinute] = (sched.endTime || "17:00").split(':').map(Number);
      const endTotal = endHour * 60 + endMinute;
      let currentTotal = hour * 60 + minute;
      while (currentTotal < endTotal) {
        const h = Math.floor(currentTotal / 60).toString().padStart(2, '0');
        const m = (currentTotal % 60).toString().padStart(2, '0');
        rawSlots.push(`${h}:${m}`);
        currentTotal += sched.slotDurationMinutes || 15;
      }
    } else {
      // Fallback generic slots if no strict schedule.
      rawSlots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30"];
    }

    // Remove times already booked for this doctor (formatted the same way the
    // slots are). The appointment being edited is excluded server-side, so its
    // own slot stays selectable.
    const bookedTimes = new Set(
      (availability?.bookedDateTimes || []).map((iso) =>
        new Date(iso).toLocaleTimeString("en-US", { hour12: false, hour: '2-digit', minute: '2-digit' })
      )
    );
    setAvailableSlots(rawSlots.filter((s) => !bookedTimes.has(s)));
  }, [formData.doctorId, formData.appointmentDate, dropdowns, availability]);

  useEffect(() => {
    // Default checkInImmediately to true only if appointment is for today
    const today = new Date().toISOString().split('T')[0];
    if (formData.appointmentDate === today && !id) {
      setCheckInImmediately(true);
    } else {
      setCheckInImmediately(false);
    }
  }, [formData.appointmentDate, id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Combine date and time
      const datetime = new Date(`${formData.appointmentDate}T${formData.timeSlot}:00`);
      
      const finalReason = formData.reason 
        ? `[${formData.visitType}] ${formData.reason}`
        : `[${formData.visitType}]`;

      const payload = {
        patientId: formData.patientId,
        departmentId: formData.departmentId,
        doctorId: formData.doctorId,
        appointmentDate: datetime.toISOString(),
        reason: finalReason,
        ...(followUpOf && !id ? { followUpOfAppointmentId: followUpOf } : {}),
      };

      let apptId = id;
      if (id) {
        await axiosInstance.put(`/reception/appointments/${id}`, payload);
      } else {
        const res = await axiosInstance.post("/reception/appointments", payload);
        apptId = res.data?.data?.appointmentId;
      }
      
      if (checkInImmediately && apptId) {
        await axiosInstance.put(`/reception/appointments/${apptId}/checkin`);
      }
      
      const selectedPatient = dropdowns.patients?.find((p: any) => p.patientId === formData.patientId);
      const pName = selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : "Patient";

      if (isEmbedded && onSuccess) {
        onSuccess(apptId, pName, payload.appointmentDate);
      } else if (!id && apptId) {
        // New booking from the standalone form: open the bill (same as the
        // Front Desk Console flow) instead of jumping straight to the list.
        toast.success("Appointment booked");
        setPostBooking({ apptId, patientName: pName, apptDate: payload.appointmentDate });
        setSaving(false);
      } else {
        navigate("/reception/appointments");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save appointment");
      setSaving(false);
    }
  };

  if (loading) return <Box sx={{ p: 4, textAlign: "center" }}><HeartbeatLoader size={96} /></Box>;

  if (isError) return <Box sx={{ p: 4 }}><ErrorState message={(error as any)?.response?.data?.message || "Failed to initialize form"} onRetry={refetch} /></Box>;

  const filteredDoctors = (dropdowns?.doctors || []).filter((d: any) => !formData.departmentId || d.departmentId === formData.departmentId);

  return (
    <Box sx={{ maxWidth: isEmbedded ? "100%" : 800, mx: "auto", pb: isEmbedded ? 0 : 4 }}>
      {!isEmbedded && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton onClick={() => navigate(-1)} sx={{ color: "text.secondary", "&:hover": { color: "text.primary", bgcolor: "action.hover" } }}>
            <ArrowBackRounded />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <PageHeader title={id ? "Reschedule Appointment" : "Book New Appointment"} />
          </Box>
        </Box>
      )}
<Paper component="form" onSubmit={handleSubmit} elevation={0} sx={{ p: 4, borderRadius: 3, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
        <Grid container spacing={3}>
          {followUpOf && !id && (
            <Grid size={{ xs: 12 }}>
              <Alert severity="info">Booking a follow-up visit for this patient — linked to their previous appointment.</Alert>
            </Grid>
          )}
          <Grid size={{ xs: 12 }}>
            <TextField
              select fullWidth required
              label="Select Patient" name="patientId"
              value={formData.patientId || ""} onChange={handleChange}
              disabled={!!id} // Disable changing patient if editing
              sx={{ "& .MuiInputBase-root": { color: "text.primary" }, "& .MuiInputLabel-root": { color: "text.secondary" } }}
            >
              <MenuItem value="" disabled>Select a Patient</MenuItem>
              {(dropdowns?.patients || []).map((p: any) => (
                <MenuItem key={p.patientId} value={p.patientId}>
                  {p.firstName} {p.lastName} - MRN: {p.uhidNumber} - Ph: {p.phone}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              select fullWidth
              label="Department (Optional Filter)" name="departmentId"
              value={formData.departmentId || ""} onChange={handleChange}
              sx={{ "& .MuiInputBase-root": { color: "text.primary" }, "& .MuiInputLabel-root": { color: "text.secondary" } }}
            >
              <MenuItem value="">All Departments</MenuItem>
              {(dropdowns?.departments || []).map((d: any) => (
                <MenuItem key={d.departmentId} value={d.departmentId}>{d.departmentName}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              select fullWidth required
              label="Doctor" name="doctorId"
              value={formData.doctorId || ""} onChange={handleChange}
              sx={{ "& .MuiInputBase-root": { color: "text.primary" }, "& .MuiInputLabel-root": { color: "text.secondary" } }}
            >
              <MenuItem value="" disabled>Select a Doctor</MenuItem>
              {filteredDoctors.map((d: any) => (
                <MenuItem key={d.doctorId} value={d.doctorId}>
                  Dr. {d.user?.firstName || "Unknown"} {d.user?.lastName || ""}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          {availability?.onLeave && (
            <Grid size={{ xs: 12 }}>
              <Alert severity="warning">
                {availability.leaveReason
                  ? `This doctor is on leave on the selected date (${availability.leaveReason}). Choose another date or doctor.`
                  : "This doctor is on leave on the selected date. Choose another date or doctor."}
              </Alert>
            </Grid>
          )}
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth required type="date"
              label="Appointment Date" name="appointmentDate"
              InputLabelProps={{ shrink: true }}
              value={formData.appointmentDate} onChange={handleChange}
              sx={{ "& .MuiInputBase-root": { color: "text.primary" }, "& .MuiInputLabel-root": { color: "text.secondary" } }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              select fullWidth required
              label="Time Slot" name="timeSlot"
              value={formData.timeSlot || ""} onChange={handleChange}
              disabled={!formData.appointmentDate || !formData.doctorId || !!availability?.onLeave}
              error={!!availability?.onLeave}
              helperText={
                availability?.onLeave
                  ? "Doctor is on leave on this date — pick another date or doctor."
                  : (formData.doctorId && formData.appointmentDate && availableSlots.length === 0
                      ? "No open slots for this doctor on this date."
                      : "")
              }
              sx={{ "& .MuiInputBase-root": { color: "text.primary" }, "& .MuiInputLabel-root": { color: "text.secondary" } }}
            >
              <MenuItem value="" disabled>Select a Time Slot</MenuItem>
              {/* Keep the currently-selected slot visible even if it's off-grid (e.g. an existing appointment being edited). */}
              {(formData.timeSlot && !availableSlots.includes(formData.timeSlot)
                ? [formData.timeSlot, ...availableSlots]
                : availableSlots
              ).map(slot => (
                <MenuItem key={slot} value={slot}>{slot}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select fullWidth required
              label="Visit Type" name="visitType"
              value={formData.visitType} onChange={handleChange}
              sx={{ "& .MuiInputBase-root": { color: "text.primary" }, "& .MuiInputLabel-root": { color: "text.secondary" } }}
            >
              <MenuItem value="Standard Visit">Standard Visit</MenuItem>
              <MenuItem value="Follow-up">Follow-up</MenuItem>
              <MenuItem value="Urgent" sx={{ color: '#ef4444', fontWeight: 600 }}>Urgent / Emergency</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField
              fullWidth
              label="Additional Notes (Optional)" name="reason"
              value={formData.reason} onChange={handleChange}
              placeholder="Symptoms, specific requests, etc."
              sx={{ "& .MuiInputBase-root": { color: "text.primary" }, "& .MuiInputLabel-root": { color: "text.secondary" } }}
            />
          </Grid>
          <Grid size={{ xs: 12 }} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 2 }}>
            <FormControlLabel
              control={
                <Switch 
                  checked={checkInImmediately} 
                  onChange={(e) => setCheckInImmediately(e.target.checked)} 
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": { color: "#06b6d4" },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#06b6d4" }
                  }}
                />
              }
              label={<Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>Check-In Immediately (Live Queue)</Typography>}
            />
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button variant="outlined" onClick={() => { if (isEmbedded && onCancel) onCancel(); else navigate(-1); }} sx={{ color: "text.secondary", borderColor: "divider", textTransform: "none" }}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={saving || !formData.patientId} startIcon={saving ? <HeartbeatLoader size={22} /> : <SaveRounded />} sx={{ bgcolor: "#06b6d4", "&:hover": { bgcolor: "#0891b2" }, textTransform: "none", fontWeight: 600 }}>
                {id ? "Update Appointment" : "Confirm Booking"}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {postBooking && (
        <BillingModal
          open
          onClose={() => { setPostBooking(null); navigate("/reception/appointments"); }}
          appointmentId={postBooking.apptId || ""}
          patientName={postBooking.patientName}
          appointmentDate={postBooking.apptDate}
        />
      )}
    </Box>
  );
}
