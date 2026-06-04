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
          <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 700, mb: 1 }}>
            Doctor Management
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            Manage doctor profiles, schedules, and leaves. Doctors are auto-synced from Staff & Users.
          </Typography>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress sx={{ color: "#6366f1" }} />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Name</TableCell>
                <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Department</TableCell>
                <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Specialization</TableCell>
                <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>License No.</TableCell>
                <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Fee</TableCell>
                <TableCell align="right" sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {doctors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary", borderBottom: "none" }}>
                    No doctors found.
                  </TableCell>
                </TableRow>
              ) : (
                doctors.map((doctor) => (
                  <TableRow key={doctor.doctorId} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                    <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.primary", fontWeight: 500 }}>
                      Dr. {doctor.user?.firstName} {doctor.user?.lastName}
                      <Typography variant="caption" display="block" sx={{ color: "text.secondary" }}>
                        {doctor.user?.email}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                      {doctor.department ? (
                         <Chip label={doctor.department.departmentName} size="small" sx={{ bgcolor: "rgba(16, 185, 129, 0.1)", color: "#34d399" }} />
                      ) : "N/A"}
                    </TableCell>
                    <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                      {doctor.specialization?.specializationName || "General"}
                    </TableCell>
                    <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                      {doctor.licenseNumber || "-"}
                    </TableCell>
                    <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                      {doctor.consultationFee ? `$${doctor.consultationFee}` : "-"}
                    </TableCell>
                    <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
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
