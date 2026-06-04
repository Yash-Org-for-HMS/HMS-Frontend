import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { axiosInstance } from "../../../api/axios";

export default function DoctorLeaves() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [doctorName, setDoctorName] = useState("");
  const [leaves, setLeaves] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const docRes = await axiosInstance.get(`/hospital/doctors/${id}`);
        const d = docRes.data.data;
        setDoctorName(`Dr. ${d.user?.firstName} ${d.user?.lastName}`);
        setLeaves(d.leaves || []);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load leaves");
      } finally {
        setInitialLoad(false);
      }
    };
    loadData();
  }, [id]);

  if (initialLoad) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress sx={{ color: "#6366f1" }} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
      <Box sx={{ mb: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 700, mb: 1 }}>
            Manage Leaves
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            {doctorName}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => navigate("/hospital/doctors")}
          sx={{ color: "text.secondary", borderColor: "divider" }}
        >
          Back to Doctors
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Leave Date</TableCell>
              <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Reason</TableCell>
              <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {leaves.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4, color: "text.secondary", borderBottom: "none" }}>
                  No leaves found for this doctor.
                </TableCell>
              </TableRow>
            ) : (
              leaves.map((leave) => (
                <TableRow key={leave.doctorLeaveId} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                  <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.primary" }}>
                    {new Date(leave.leaveDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                    {leave.leaveReason || "N/A"}
                  </TableCell>
                  <TableCell sx={{ color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}>
                    <Chip label={leave.status} size="small" sx={{ bgcolor: "rgba(255,255,255,0.1)", color: "text.primary" }} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
