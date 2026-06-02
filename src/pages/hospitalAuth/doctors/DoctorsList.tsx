import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import { AddRounded, EditRounded, EventAvailableRounded, CalendarTodayRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "../../../api/axios";

export default function DoctorsList() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const response = await axiosInstance.get("/hospital/doctors");
      setDoctors(response.data.data);
    } catch (error) {
      console.error("Error fetching doctors", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 700, mb: 1 }}>
            Doctor Management
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            Manage doctor profiles, schedules, and leaves.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => navigate("/hospital/doctors/new")}
          sx={{
            bgcolor: "#6366f1",
            "&:hover": { bgcolor: "#4f46e5" },
            textTransform: "none",
            fontWeight: 600,
            px: 3,
          }}
        >
          Add Doctor
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress sx={{ color: "#6366f1" }} />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ bgcolor: "#1e293b", backgroundImage: "none", borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Name</TableCell>
                <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Department</TableCell>
                <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Specialization</TableCell>
                <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>License No.</TableCell>
                <TableCell sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Fee</TableCell>
                <TableCell align="right" sx={{ color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {doctors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: "#94a3b8", borderBottom: "none" }}>
                    No doctors found.
                  </TableCell>
                </TableRow>
              ) : (
                doctors.map((doctor) => (
                  <TableRow key={doctor.doctorId} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                    <TableCell sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#f8fafc", fontWeight: 500 }}>
                      Dr. {doctor.user?.firstName} {doctor.user?.lastName}
                      <Typography variant="caption" display="block" sx={{ color: "#94a3b8" }}>
                        {doctor.user?.email}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      {doctor.department ? (
                         <Chip label={doctor.department.departmentName} size="small" sx={{ bgcolor: "rgba(16, 185, 129, 0.1)", color: "#34d399" }} />
                      ) : "N/A"}
                    </TableCell>
                    <TableCell sx={{ color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      {doctor.specialization?.specializationName || "General"}
                    </TableCell>
                    <TableCell sx={{ color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      {doctor.licenseNumber}
                    </TableCell>
                    <TableCell sx={{ color: "#cbd5e1", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      ${doctor.consultationFee}
                    </TableCell>
                    <TableCell align="right" sx={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <Tooltip title="Configure Schedule">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/hospital/doctors/${doctor.doctorId}/schedule`)}
                          sx={{ color: "#38bdf8", "&:hover": { bgcolor: "rgba(56, 189, 248, 0.1)" } }}
                        >
                          <EventAvailableRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Manage Leaves">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/hospital/doctors/${doctor.doctorId}/leaves`)}
                          sx={{ color: "#f43f5e", "&:hover": { bgcolor: "rgba(244, 63, 94, 0.1)" } }}
                        >
                          <CalendarTodayRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit Profile">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/hospital/doctors/${doctor.doctorId}/edit`)}
                          sx={{ color: "#6366f1", "&:hover": { bgcolor: "rgba(99, 102, 241, 0.1)" } }}
                        >
                          <EditRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
