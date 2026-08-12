import { useState } from "react";
import { ACCENTS, SEMANTIC } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, TextField, IconButton, Tooltip, Divider, Alert,
} from "@mui/material";
import { AddRounded, DeleteOutlineRounded, EventBusyRounded } from "@mui/icons-material";
import dayjs from "dayjs";
import { axiosInstance } from "@/api/axios";
import Mascot from "@/components/Mascot";
import ErrorState from "@/components/ErrorState";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";
import PageHeader from "@/components/layout/PageHeader";
import { useTableSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import PageSkeleton from "@/components/PageSkeleton";

const INACTIVE = ["rejected", "cancelled", "declined"];
const HEAD_SX = { textTransform: "none" as const, letterSpacing: "normal", fontWeight: 600, fontSize: "0.875rem" };

// Doctor self-service leave. A doctor adds/removes their OWN leave days; each day
// blocks new bookings with them (reception sees "on leave"). No admin needed.
export default function MyLeaves() {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const [fromDate, setFromDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  // Leave can only be for today onward (the backend enforces this too).
  const today = dayjs().format("YYYY-MM-DD");

  const { data: leaves = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["my-leaves"],
    queryFn: async () => (await axiosInstance.get("/doctor/leaves")).data.data as any[],
  });

  const { sorted, orderBy, order, onSort } = useTableSort(leaves, {
    date: (l) => (l.leaveDate ? new Date(l.leaveDate) : null),
    reason: (l) => l.leaveReason ?? null,
    status: (l) => l.status ?? null,
  });

  const addLeave = useMutation({
    mutationFn: async () =>
      (await axiosInstance.post("/doctor/leaves", { fromDate, toDate: toDate || undefined, reason: reason || undefined })).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Leave added");
      setReason("");
      setToDate("");
      queryClient.invalidateQueries({ queryKey: ["my-leaves"] });
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, "Failed to add leave")),
  });

  const removeLeave = useMutation({
    mutationFn: async (leaveId: string) => (await axiosInstance.delete(`/doctor/leaves/${leaveId}`)).data,
    onSuccess: () => {
      toast.success("Leave removed");
      queryClient.invalidateQueries({ queryKey: ["my-leaves"] });
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, "Failed to remove leave")),
  });

  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
      <PageHeader
        title="My Leave"
        subtitle="Mark the days you're off. Reception can't book patients with you on those days."
      />

      {/* Add leave */}
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Add leave</Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-end" }}>
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} inputProps={{ min: today }} />
          <TextField
            size="small" type="date" label="To (optional)" InputLabelProps={{ shrink: true }}
            value={toDate} onChange={(e) => setToDate(e.target.value)}
            inputProps={{ min: fromDate || today }}
            helperText="Leave empty for a single day"
            sx={{ position: "relative" }}
            slotProps={{ formHelperText: { sx: { position: "absolute", top: "100%", left: 0, mt: 0.25, whiteSpace: "nowrap" } } }}
          />
          <TextField size="small" label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} sx={{ minWidth: 220, flex: 1 }} />
          <Button
            variant="contained"
            startIcon={addLeave.isPending ? <HeartbeatLoader size={22} /> : <AddRounded />}
            onClick={() => addLeave.mutate()}
            disabled={addLeave.isPending || !fromDate}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Add Leave
          </Button>
        </Box>
      </Paper>

      <Alert severity="info" icon={<EventBusyRounded />} sx={{ mb: 2 }}>
        A leave day immediately closes your appointment slots for that day. Removing the leave re-opens them.
      </Alert>

      <Divider sx={{ mb: 2 }} />

      {isLoading ? (
        <PageSkeleton />
      ) : isError ? (
        <ErrorState title="Couldn't load your leave" message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, border: "1px solid", borderColor: "divider", maxHeight: "calc(100vh - 320px)" }}>
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
                    <Mascot pose="nothing-here-yet" subtitle="No leave marked. Add a day above when you're going to be off." size={110} />
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((leave) => {
                  const inactive = INACTIVE.includes((leave.status || "").toLowerCase());
                  const past = dayjs(leave.leaveDate).isBefore(dayjs(), "day");
                  return (
                    <TableRow key={leave.doctorLeaveId} hover sx={{ "&:last-child td": { border: 0 } }}>
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider", color: "text.primary", fontWeight: 600 }}>
                        {dayjs(leave.leaveDate).format("ddd, DD MMM YYYY")}
                      </TableCell>
                      <TableCell sx={{ color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" }}>{leave.leaveReason || "—"}</TableCell>
                      <TableCell sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                        <Chip label={leave.status} size="small"
                          sx={{ bgcolor: inactive ? "rgba(148,163,184,0.15)" : "rgba(16,185,129,0.15)", color: inactive ? "text.secondary" : "#16a34a", fontWeight: 600 }} />
                      </TableCell>
                      <TableCell align="right" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                        <Tooltip title={past ? "A past leave day can't be removed" : "Remove leave"}>
                          <span>
                            <IconButton size="small"
                              onClick={async () => {
                                const ok = await confirm({ title: "Remove leave", message: "Remove this leave day? Your slots for that day re-open.", confirmText: "Remove", destructive: true });
                                if (ok) removeLeave.mutate(leave.doctorLeaveId);
                              }}
                              disabled={past || removeLeave.isPending}
                              sx={{ color: "text.secondary", "&:hover": { color: SEMANTIC.danger } }}>
                              <DeleteOutlineRounded fontSize="small" />
                            </IconButton>
                          </span>
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
