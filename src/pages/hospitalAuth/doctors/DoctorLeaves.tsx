import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, TextField, IconButton, Tooltip, Divider,
} from "@mui/material";
import { AddRounded, DeleteOutlineRounded } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { axiosInstance } from "../../../api/axios";
import Mascot from "../../../components/Mascot";
import ErrorState from "../../../components/ErrorState";
import { useToast } from "../../../contexts/ToastContext";
import PageHeader from "../../../components/layout/PageHeader";
import { useTableSort } from "../../../components/table/useTableSort";
import SortableHeadCell from "../../../components/table/SortableHeadCell";
import HeartbeatLoader from "../../../components/HeartbeatLoader";
import PageLoader from "../../../components/PageLoader";

const INACTIVE = ["rejected", "cancelled", "declined"];

// Match the file's existing sentence-case fontWeight-600 header look (override SortableHeadCell's default uppercase/700 style).
const HEAD_SX = { textTransform: "none" as const, letterSpacing: "normal", fontWeight: 600, fontSize: "0.875rem", py: undefined };

export default function DoctorLeaves() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [fromDate, setFromDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");

  const { data: doctorData } = useQuery({
    queryKey: ["doctor", id],
    queryFn: async () => (await axiosInstance.get(`/hospital/doctors/${id}`)).data.data,
    enabled: !!id,
  });
  const doctorName = doctorData ? `Dr. ${doctorData.user?.firstName ?? ""} ${doctorData.user?.lastName ?? ""}`.trim() : "";

  const { data: leaves = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["doctor-leaves", id],
    queryFn: async () => (await axiosInstance.get(`/hospital/doctors/${id}/leaves`)).data.data as any[],
    enabled: !!id,
  });

  const { sorted, orderBy, order, onSort } = useTableSort(leaves, {
    date: (l) => l.leaveDate ? new Date(l.leaveDate) : null,
    reason: (l) => l.leaveReason ?? null,
    status: (l) => l.status ?? null,
  });

  const addLeave = useMutation({
    mutationFn: async () =>
      (await axiosInstance.post(`/hospital/doctors/${id}/leaves`, {
        fromDate,
        toDate: toDate || undefined,
        reason: reason || undefined,
      })).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Leave added");
      setReason("");
      setToDate("");
      queryClient.invalidateQueries({ queryKey: ["doctor-leaves", id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to add leave"),
  });

  const removeLeave = useMutation({
    mutationFn: async (leaveId: string) => (await axiosInstance.delete(`/hospital/doctors/${id}/leaves/${leaveId}`)).data,
    onSuccess: () => {
      toast.success("Leave removed");
      queryClient.invalidateQueries({ queryKey: ["doctor-leaves", id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to remove leave"),
  });

  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
      <PageHeader
        title="Manage Leaves"
        subtitle={doctorName}
        actions={
          <Button variant="outlined" onClick={() => navigate("/hospital/doctors")} sx={{ color: "text.secondary", borderColor: "divider" }}>
            Back to Doctors
          </Button>
        }
      />

      {/* Add leave */}
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Add a leave</Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-end" }}>
          <TextField
            size="small" type="date" label="From" InputLabelProps={{ shrink: true }}
            value={fromDate} onChange={(e) => setFromDate(e.target.value)}
          />
          <TextField
            size="small" type="date" label="To (optional)" InputLabelProps={{ shrink: true }}
            value={toDate} onChange={(e) => setToDate(e.target.value)}
            helperText="Leave empty for a single day"
          />
          <TextField
            size="small" label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)}
            sx={{ minWidth: 220, flex: 1 }}
          />
          <Button
            variant="contained"
            startIcon={addLeave.isPending ? <HeartbeatLoader size={22} /> : <AddRounded />}
            onClick={() => addLeave.mutate()}
            disabled={addLeave.isPending || !fromDate}
            sx={{ bgcolor: "#6366f1", "&:hover": { bgcolor: "#4f46e5" }, textTransform: "none", fontWeight: 600 }}
          >
            Add Leave
          </Button>
        </Box>
      </Paper>

      <Divider sx={{ mb: 2 }} />

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <ErrorState title="Couldn't load leaves" message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, border: "1px solid", borderColor: "divider", maxHeight: "calc(100vh - 300px)" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <SortableHeadCell label="Leave Date" sortKey="date" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Reason" sortKey="reason" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <SortableHeadCell label="Status" sortKey="status" orderBy={orderBy} order={order} onSort={onSort} sx={HEAD_SX} />
                <TableCell sx={{ color: "text.secondary", fontWeight: 600, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.default" }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} sx={{ py: 3, borderBottom: "none" }}>
                    <Mascot pose="nothing-here-yet" subtitle="No leaves recorded for this doctor." size={110} />
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((leave) => {
                  const inactive = INACTIVE.includes((leave.status || "").toLowerCase());
                  return (
                    <TableRow key={leave.doctorLeaveId} hover sx={{ "&:last-child td": { border: 0 } }}>
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.primary", fontWeight: 600 }}>
                        {dayjs(leave.leaveDate).format("ddd, DD MMM YYYY")}
                      </TableCell>
                      <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>
                        {leave.leaveReason || "—"}
                      </TableCell>
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                        <Chip
                          label={leave.status}
                          size="small"
                          sx={{
                            bgcolor: inactive ? "rgba(148,163,184,0.15)" : "rgba(16,185,129,0.15)",
                            color: inactive ? "text.secondary" : "#16a34a",
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                        <Tooltip title="Remove leave">
                          <IconButton
                            size="small"
                            onClick={() => { if (window.confirm("Remove this leave?")) removeLeave.mutate(leave.doctorLeaveId); }}
                            disabled={removeLeave.isPending}
                            sx={{ color: "text.secondary", "&:hover": { color: "#ef4444" } }}
                          >
                            <DeleteOutlineRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
