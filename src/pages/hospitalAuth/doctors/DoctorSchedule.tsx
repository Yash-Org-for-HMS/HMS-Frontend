import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import ErrorState from "../../../components/ErrorState";
import {
  Box,
  Paper,
  TextField,
  Button,
  Grid,
  CircularProgress,
  Alert,
  IconButton,
} from "@mui/material";
import { SaveRounded, DeleteRounded, AddRounded } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "../../../api/axios";
import { useToast } from "../../../contexts/ToastContext";
import PageHeader from "../../../components/layout/PageHeader";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function DoctorSchedule() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const [doctorName, setDoctorName] = useState("");
  const [schedules, setSchedules] = useState<any[]>([]);

  const { data: doctorData, isLoading: initialLoad, isError, error, refetch } = useQuery({
    queryKey: ["doctor-schedule", id],
    queryFn: async () => (await axiosInstance.get(`/hospital/doctors/${id}`)).data.data,
    enabled: !!id,
  });

  // Seed the editable schedule rows once the doctor loads.
  useEffect(() => {
    if (!doctorData) return;
    setDoctorName(`Dr. ${doctorData.user?.firstName} ${doctorData.user?.lastName}`);
    setSchedules(doctorData.schedules || []);
  }, [doctorData]);

  const handleAddSchedule = () => {
    setSchedules([...schedules, { dayOfWeek: 1, startTime: "09:00", endTime: "17:00", slotDurationMinutes: 15 }]);
  };

  const handleRemoveSchedule = (index: number) => {
    const updated = [...schedules];
    updated.splice(index, 1);
    setSchedules(updated);
  };

  const handleChange = (index: number, field: string, value: any) => {
    const updated = [...schedules];
    updated[index][field] = value;
    setSchedules(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axiosInstance.put(`/hospital/doctors/${id}/schedule`, { schedules });
      navigate("/hospital/doctors");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "An error occurred");
      setLoading(false);
    }
  };

  if (initialLoad) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress sx={{ color: "#6366f1" }} />
      </Box>
    );
  }

  if (isError) {
    return <ErrorState title="Couldn't load schedule" message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />;
  }

  const textFieldProps = {
    fullWidth: true,
    InputLabelProps: { style: { color: "text.secondary" } },
    sx: {
      "& .MuiOutlinedInput-root": {
        color: "text.primary",
        "& fieldset": { borderColor: "divider" },
        "&:hover fieldset": { borderColor: "divider" },
        "&.Mui-focused fieldset": { borderColor: "#6366f1" },
        "& .MuiSvgIcon-root": { color: "text.secondary" }
      },
    },
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
      <PageHeader
        title="Configure Schedule"
        subtitle={doctorName}
        actions={
          <Button
            variant="outlined"
            onClick={() => navigate("/hospital/doctors")}
            sx={{ color: "text.secondary", borderColor: "divider" }}
          >
            Cancel
          </Button>
        }
      />
<Paper sx={{ p: 4, bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2 }}>
        <form onSubmit={handleSubmit}>
          {schedules.map((schedule, idx) => (
            <Box key={idx} sx={{ p: 2, mb: 3, bgcolor: "action.hover", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    select
                    label="Day of Week"
                    value={schedule.dayOfWeek}
                    onChange={(e) => handleChange(idx, "dayOfWeek", e.target.value)}
                    SelectProps={{ native: true }}
                    {...textFieldProps}
                  >
                    {DAYS_OF_WEEK.map((day, dIdx) => (
                      <option key={dIdx} value={dIdx}>{day}</option>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <TextField
                    type="time"
                    label="Start Time"
                    value={schedule.startTime}
                    onChange={(e) => handleChange(idx, "startTime", e.target.value)}
                    {...textFieldProps}
                    InputLabelProps={{ shrink: true, style: { color: "text.secondary" } }}
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <TextField
                    type="time"
                    label="End Time"
                    value={schedule.endTime}
                    onChange={(e) => handleChange(idx, "endTime", e.target.value)}
                    {...textFieldProps}
                    InputLabelProps={{ shrink: true, style: { color: "text.secondary" } }}
                  />
                </Grid>
                <Grid size={{ xs: 10, md: 2 }}>
                  <TextField
                    type="number"
                    label="Slot (Min)"
                    value={schedule.slotDurationMinutes}
                    onChange={(e) => handleChange(idx, "slotDurationMinutes", e.target.value)}
                    {...textFieldProps}
                  />
                </Grid>
                <Grid size={{ xs: 2, md: 1 }} sx={{ textAlign: "right" }}>
                  <IconButton onClick={() => handleRemoveSchedule(idx)} sx={{ color: "#f43f5e" }}>
                    <DeleteRounded />
                  </IconButton>
                </Grid>
              </Grid>
            </Box>
          ))}

          <Button
            startIcon={<AddRounded />}
            onClick={handleAddSchedule}
            sx={{ color: "#38bdf8", textTransform: "none", fontWeight: 600, mb: 4 }}
          >
            Add Working Day
          </Button>

          <Box sx={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid", borderColor: "divider", pt: 3 }}>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={<SaveRounded />}
              sx={{ bgcolor: "#6366f1", "&:hover": { bgcolor: "#4f46e5" }, py: 1.5, px: 4 }}
            >
              {loading ? "Saving..." : "Save Schedule"}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
}
