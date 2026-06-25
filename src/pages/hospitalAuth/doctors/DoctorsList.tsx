import { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Box,
  Typography,
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
  TextField,
  InputAdornment,
  Pagination,
} from "@mui/material";
import { EditRounded, EventAvailableRounded, CalendarTodayRounded, SearchRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "../../../api/axios";
import Mascot from "../../../components/Mascot";
import ErrorState from "../../../components/ErrorState";
import PageHeader from "../../../components/layout/PageHeader";
import { ListSkeleton } from "../../../components/TableRowsSkeleton";

const PAGE_SIZE = 20;

export default function DoctorsList() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Debounce the search box; reset to page 1 whenever the term changes.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading: loading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["hospital-doctors", search, page],
    queryFn: async () =>
      (await axiosInstance.get("/hospital/doctors", { params: { search, page, limit: PAGE_SIZE } })).data,
    placeholderData: keepPreviousData,
  });
  const doctors: any[] = data?.data || [];
  const meta = data?.meta as { total: number; totalPages: number } | undefined;

  return (
    <Box>
      <PageHeader
        title="Doctor Management"
        subtitle="Manage doctor profiles, schedules, and leaves. Doctors are auto-synced from Staff & Users."
      />

      <TextField
        size="small"
        placeholder="Search by name, email, license, specialization, department…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        sx={{ mb: 2, width: "100%", maxWidth: 460 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchRounded sx={{ color: "text.secondary" }} /></InputAdornment>,
          endAdornment: isFetching ? <CircularProgress size={16} sx={{ color: "primary.main" }} /> : undefined,
        }}
      />

      {loading ? (
        <ListSkeleton rows={6} />
      ) : isError ? (
        <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
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
                  <TableCell colSpan={6} sx={{ py: 3, borderBottom: "none" }}>
                    <Mascot pose="nothing-here-yet" subtitle="No doctors found." size={120} />
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
                      {doctor.consultationFee ? `₹${doctor.consultationFee}` : "-"}
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
          {meta && meta.totalPages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 2, py: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {meta.total} doctor{meta.total === 1 ? "" : "s"}
              </Typography>
              <Pagination count={meta.totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" shape="rounded" size="small" />
            </Box>
          )}
        </TableContainer>
      )}
    </Box>
  );
}
