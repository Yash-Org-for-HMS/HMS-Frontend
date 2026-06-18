import { useQuery } from "@tanstack/react-query";
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
import Mascot from "../../../components/Mascot";
import ErrorState from "../../../components/ErrorState";

export default function DoctorLeaves() {
  const navigate = useNavigate();
  const { id } = useParams();

  const { data: doctorData, isLoading: initialLoad, isError, error, refetch } = useQuery({
    queryKey: ["doctor-leaves", id],
    queryFn: async () => (await axiosInstance.get(`/hospital/doctors/${id}`)).data.data,
    enabled: !!id,
  });
  const doctorName = doctorData ? `Dr. ${doctorData.user?.firstName} ${doctorData.user?.lastName}` : "";
  const leaves: any[] = doctorData?.leaves ?? [];

  if (initialLoad) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress sx={{ color: "#6366f1" }} />
      </Box>
    );
  }

  if (isError) {
    return <ErrorState title="Couldn't load leaves" message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />;
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
                <TableCell colSpan={3} sx={{ py: 3, borderBottom: "none" }}>
                  <Mascot pose="nothing-here-yet" subtitle="No leaves found for this doctor." size={110} />
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
