import { useState, useEffect } from "react";
import {
  Box, Typography, Button, Paper, TextField, MenuItem,
  CircularProgress, Alert, Grid, IconButton
} from "@mui/material";
import { ArrowBackRounded, SaveRounded } from "@mui/icons-material";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { axiosInstance } from "../../api/axios";

export default function AppointmentForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get("patientId") || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dropdowns, setDropdowns] = useState<any>({
    departments: [], doctors: [], patients: [], statuses: [], doctorSchedules: []
  });

  const [formData, setFormData] = useState({
    patientId: initialPatientId,
    departmentId: "",
    doctorId: "",
    appointmentDate: new Date().toISOString().split('T')[0],
    timeSlot: "",
    reason: ""
  });

  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        const ddRes = await axiosInstance.get("/reception/appointments/dropdowns");
        if (ddRes.data?.data) {
          setDropdowns(ddRes.data.data);
        }

        if (id) {
          const res = await axiosInstance.get(`/reception/appointments/${id}`);
          const appt = res.data.data;
          if (appt) {
            const dateObj = new Date(appt.appointmentDate);
            const dateStr = dateObj.toISOString().split('T')[0];
            const timeStr = dateObj.toLocaleTimeString("en-US", { hour12: false, hour: '2-digit', minute: '2-digit' });
            setFormData({
              patientId: appt.patientId || "",
              departmentId: appt.departmentId || "",
              doctorId: appt.doctorId || "",
              appointmentDate: dateStr,
              timeSlot: timeStr,
              reason: appt.reason || ""
            });
          }
        }
      } catch (err) {
        setError("Failed to initialize form");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id]);

  useEffect(() => {
    // Generate slots based on doctor, date, and schedule
    if (formData.doctorId && formData.appointmentDate) {
      const date = new Date(formData.appointmentDate);
      const dayOfWeek = date.getDay(); // 0 (Sun) - 6 (Sat)
      const schedules = (dropdowns?.doctorSchedules || []).filter((s: any) => s.doctorId === formData.doctorId && s.dayOfWeek === dayOfWeek);

      if (schedules.length > 0) {
        // Generate slots from the first matching schedule
        const sched = schedules[0];
        const slots = [];
        let [hour, minute] = (sched.startTime || "09:00").split(':').map(Number);
        const [endHour, endMinute] = (sched.endTime || "17:00").split(':').map(Number);
        
        const endTotal = endHour * 60 + endMinute;
        let currentTotal = hour * 60 + minute;

        while (currentTotal < endTotal) {
          const h = Math.floor(currentTotal / 60).toString().padStart(2, '0');
          const m = (currentTotal % 60).toString().padStart(2, '0');
          slots.push(`${h}:${m}`);
          currentTotal += sched.slotDurationMinutes || 15;
        }
        setAvailableSlots(slots);
      } else {
        // Fallback generic slots if no strict schedule
        setAvailableSlots(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30"]);
      }
    } else {
      setAvailableSlots([]);
    }
  }, [formData.doctorId, formData.appointmentDate, dropdowns]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Combine date and time
      const datetime = new Date(`${formData.appointmentDate}T${formData.timeSlot}:00`);

      const payload = {
        patientId: formData.patientId,
        departmentId: formData.departmentId,
        doctorId: formData.doctorId,
        appointmentDate: datetime.toISOString(),
        reason: formData.reason
      };

      if (id) {
        await axiosInstance.put(`/reception/appointments/${id}`, payload);
      } else {
        await axiosInstance.post("/reception/appointments", payload);
      }
      navigate("/reception/appointments");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save appointment");
      setSaving(false);
    }
  };

  if (loading) return <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress sx={{ color: "#06b6d4" }}/></Box>;

  const filteredDoctors = (dropdowns?.doctors || []).filter((d: any) => !formData.departmentId || d.departmentId === formData.departmentId);

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", pb: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
        <IconButton onClick={() => navigate(-1)} sx={{ color: "#94a3b8", "&:hover": { color: "#f1f5f9", bgcolor: "rgba(255,255,255,0.05)" } }}>
          <ArrowBackRounded />
        </IconButton>
        <Box>
          <Typography variant="h4" sx={{ color: "#f1f5f9", fontWeight: 800 }}>
            {id ? "Reschedule Appointment" : "Book New Appointment"}
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      <Paper component="form" onSubmit={handleSubmit} elevation={0} sx={{ p: 4, borderRadius: 3, background: "linear-gradient(135deg, #0c1a3a 0%, #0f172a 100%)", border: "1px solid rgba(6,182,212,0.15)" }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <TextField
              select fullWidth required
              label="Select Patient" name="patientId"
              value={formData.patientId || ""} onChange={handleChange}
              disabled={!!id} // Disable changing patient if editing
              sx={{ "& .MuiInputBase-root": { color: "#f1f5f9" }, "& .MuiInputLabel-root": { color: "#94a3b8" } }}
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
              sx={{ "& .MuiInputBase-root": { color: "#f1f5f9" }, "& .MuiInputLabel-root": { color: "#94a3b8" } }}
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
              sx={{ "& .MuiInputBase-root": { color: "#f1f5f9" }, "& .MuiInputLabel-root": { color: "#94a3b8" } }}
            >
              <MenuItem value="" disabled>Select a Doctor</MenuItem>
              {filteredDoctors.map((d: any) => (
                <MenuItem key={d.doctorId} value={d.doctorId}>
                  Dr. {d.user?.firstName || "Unknown"} {d.user?.lastName || ""}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth required type="date"
              label="Appointment Date" name="appointmentDate"
              InputLabelProps={{ shrink: true }}
              value={formData.appointmentDate} onChange={handleChange}
              sx={{ "& .MuiInputBase-root": { color: "#f1f5f9" }, "& .MuiInputLabel-root": { color: "#94a3b8" } }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              select fullWidth required
              label="Time Slot" name="timeSlot"
              value={formData.timeSlot || ""} onChange={handleChange}
              disabled={!formData.appointmentDate || !formData.doctorId}
              sx={{ "& .MuiInputBase-root": { color: "#f1f5f9" }, "& .MuiInputLabel-root": { color: "#94a3b8" } }}
            >
              <MenuItem value="" disabled>Select a Time Slot</MenuItem>
              {availableSlots.map(slot => (
                <MenuItem key={slot} value={slot}>{slot}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth multiline rows={3}
              label="Reason for Visit" name="reason"
              value={formData.reason} onChange={handleChange}
              placeholder="E.g., Follow-up, Routine checkup..."
              sx={{ "& .MuiInputBase-root": { color: "#f1f5f9" }, "& .MuiInputLabel-root": { color: "#94a3b8" } }}
            />
          </Grid>
          <Grid size={{ xs: 12 }} sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 2 }}>
            <Button variant="outlined" onClick={() => navigate(-1)} sx={{ color: "#94a3b8", borderColor: "rgba(255,255,255,0.1)", textTransform: "none" }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={20} /> : <SaveRounded />} sx={{ bgcolor: "#06b6d4", "&:hover": { bgcolor: "#0891b2" }, textTransform: "none", fontWeight: 600 }}>
              {id ? "Update Appointment" : "Confirm Booking"}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
