import { useState, useEffect } from "react";
import {
  Box,
  Typography,
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

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function DoctorSchedule() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [doctorName, setDoctorName] = useState("");
  const [schedules, setSchedules] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const docRes = await axiosInstance.get(`/hospital/doctors/${id}`);
        const d = docRes.data.data;
        setDoctorName(`Dr. ${d.user?.firstName} ${d.user?.lastName}`);
        setSchedules(d.schedules || []);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load schedule");
      } finally {
        setInitialLoad(false);
      }
    };
    loadData();
  }, [id]);

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
    setError(null);

    try {
      await axiosInstance.put(`/hospital/doctors/${id}/schedule`, { schedules });
      navigate("/hospital/doctors");
    } catch (err: any) {
      setError(err.response?.data?.message || "An error occurred");
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

  const textFieldProps = {
    fullWidth: true,
    InputLabelProps: { style: { color: "#94a3b8" } },
    sx: {
      "& .MuiOutlinedInput-root": {
        color: "#f1f5f9",
        "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
        "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
        "&.Mui-focused fieldset": { borderColor: "#6366f1" },
        "& .MuiSvgIcon-root": { color: "#94a3b8" }
      },
    },
  };

  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
      <Box sx={{ mb: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 700, mb: 1 }}>
            Configure Schedule
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            {doctorName}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => navigate("/hospital/doctors")}
          sx={{ color: "#94a3b8", borderColor: "rgba(255,255,255,0.2)" }}
        >
          Cancel
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 4, bgcolor: "#1e293b", backgroundImage: "none", borderRadius: 2 }}>
        <form onSubmit={handleSubmit}>
          {schedules.map((schedule, idx) => (
            <Box key={idx} sx={{ p: 2, mb: 3, bgcolor: "rgba(255,255,255,0.02)", borderRadius: 1, border: "1px solid rgba(255,255,255,0.05)" }}>
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
                    InputLabelProps={{ shrink: true, style: { color: "#94a3b8" } }}
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <TextField
                    type="time"
                    label="End Time"
                    value={schedule.endTime}
                    onChange={(e) => handleChange(idx, "endTime", e.target.value)}
                    {...textFieldProps}
                    InputLabelProps={{ shrink: true, style: { color: "#94a3b8" } }}
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

          <Box sx={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid rgba(255,255,255,0.1)", pt: 3 }}>
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
