import { useState, useEffect } from "react";
import { ACCENTS, SEMANTIC } from "@/styles/accents";
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
  TextField,
  InputAdornment,
  Pagination,
  Button,
} from "@mui/material";
import { EditRounded, EventAvailableRounded, CalendarTodayRounded, SearchRounded, AddRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "@/api/axios";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import Mascot from "@/components/Mascot";
import ErrorState from "@/components/ErrorState";
import PageHeader from "@/components/layout/PageHeader";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { useServerSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";
import { apiErrorText } from "@/utils/apiError";

const PAGE_SIZE = 20;

// Match this page's existing table-head styling so SortableHeadCell blends in.
const HEAD_SX = { color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" } as const;

export default function DoctorsList() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim(), 350);
  const [page, setPage] = useState(1);

  // Server-side column sorting (the list is paginated, so sorting happens server-side).
  const { orderBy, order, onSort } = useServerSort();

  // Reset to page 1 whenever the (debounced) search term changes.
  useEffect(() => { setPage(1); }, [search]);

  // Jump back to the first page whenever the sort changes.
  useEffect(() => { setPage(1); }, [orderBy, order]);

  const { data, isLoading: loading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["hospital-doctors", search, page, orderBy, order],
    queryFn: async () =>
      (await axiosInstance.get("/hospital/doctors", { params: { search, page, limit: PAGE_SIZE, sortBy: orderBy || undefined, sortOrder: order } })).data,
    placeholderData: keepPreviousData,
  });
  const doctors: any[] = data?.data || [];
  const meta = data?.meta as { total: number; totalPages: number } | undefined;

  // Subscription-plan doctor usage (used / limit) — drives the header indicator
  // and disables "Add Doctor" once the plan's cap is reached.
  const { data: quota } = useQuery({
    queryKey: ["hospital-doctors-quota"],
    queryFn: async () =>
      (await axiosInstance.get("/hospital/doctors/quota")).data.data as {
        used: number; limit: number | null; planName: string | null; unlimited: boolean;
      },
  });
  const atLimit = !!quota && !quota.unlimited && quota.limit != null && quota.used >= quota.limit;

  return (
    <Box>
      <PageHeader
        title="Doctor Management"
        subtitle="Add doctors and manage their profiles, schedules, and leaves."
        actions={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {quota && (
              quota.unlimited ? (
                <Chip size="small" label={`${quota.used} doctor${quota.used === 1 ? "" : "s"}`} sx={{ fontWeight: 600 }} />
              ) : (
                <Tooltip title={quota.planName ? `${quota.planName} plan limit` : "Plan limit"}>
                  <Chip
                    size="small"
                    label={`${quota.used} / ${quota.limit} doctors`}
                    color={atLimit ? "error" : quota.limit != null && quota.used >= quota.limit * 0.8 ? "warning" : "success"}
                    variant={atLimit ? "filled" : "outlined"}
                    sx={{ fontWeight: 600 }}
                  />
                </Tooltip>
              )
            )}
            <Tooltip title={atLimit ? `Doctor limit reached for the ${quota?.planName ?? "current"} plan — upgrade to add more.` : ""}>
              <span>
                <Button
                  variant="contained"
                  startIcon={<AddRounded />}
                  disabled={atLimit}
                  onClick={() => navigate("/hospital/doctors/new")}
                  sx={{ bgcolor: ACCENTS.hospital, "&:hover": { bgcolor: ACCENTS.hospitalDark }, textTransform: "none", fontWeight: 600, px: 3 }}
                >
                  Add Doctor
                </Button>
              </span>
            </Tooltip>
          </Box>
        }
      />

      <TextField
        size="small"
        placeholder="Search by name, email, license, specialization, department…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        sx={{ mb: 2, width: "100%", maxWidth: 460 }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchRounded sx={{ color: "text.secondary" }} /></InputAdornment>,
          endAdornment: isFetching ? <HeartbeatLoader size={22} /> : undefined,
        }}
      />

      {loading ? (
        <ListSkeleton rows={6} />
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : (
        <TableContainer component={Paper} sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, maxHeight: "calc(100vh - 300px)" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={HEAD_SX}>Name</TableCell>
                <TableCell sx={HEAD_SX}>Department</TableCell>
                <TableCell sx={HEAD_SX}>Specialization</TableCell>
                <SortableHeadCell label="License No." sortKey="license" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Fee" sortKey="fee" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <TableCell align="right" sx={HEAD_SX}>Actions</TableCell>
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
                         <Chip label={doctor.department.departmentName} size="small" sx={{ bgcolor: "rgba(16, 185, 129, 0.1)", color: SEMANTIC.successLight }} />
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
                          sx={{ color: ACCENTS.hospital, "&:hover": { bgcolor: "rgba(99, 102, 241, 0.1)" } }}
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
