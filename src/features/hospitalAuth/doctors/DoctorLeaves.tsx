import { useState } from "react";
import LeaveBookedNotice, { type LeaveBooking } from "@/components/doctor/LeaveBookedNotice";
import { FORM_PAGE_WIDTH } from "@/components/layout/pageWidth";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Box, Typography, Paper, Button, TextField, Divider, Pagination } from "@mui/material";
import { AddRounded } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";
import PageHeader from "@/components/layout/PageHeader";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import PageSkeleton from "@/components/PageSkeleton";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import LeaveScopeFields from "./LeaveScopeFields";
import LeaveTable, { type LeaveRow, type PagedLeaves } from "./LeaveTable";
import { EMPTY_LEAVE_SCOPE, leaveScopeBody, type LeaveScope } from "./leaveScope";

export default function DoctorLeaves() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const [fromDate, setFromDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [booked, setBooked] = useState<LeaveBooking[]>([]);
  const [scope, setScope] = useState<LeaveScope>(EMPTY_LEAVE_SCOPE);
  // Leave can be for one of the doctor's branches (all branches when they have no list).
  const { availableBranches } = useHospitalAuth();
  const { data: doctorBranchIds = [] } = useQuery<string[]>({
    queryKey: ["doctor-branches", id],
    queryFn: async () => (await axiosInstance.get(`/hospital/doctors/${id}/branches`)).data.data ?? [],
    enabled: !!id,
  });
  const leaveBranches = doctorBranchIds.length ? availableBranches.filter((b) => doctorBranchIds.includes(b.branchId)) : availableBranches;
  const branchName = (b: string) => availableBranches.find((x) => x.branchId === b)?.branchName;
  // Leave can only be for today onward (the backend enforces this too).
  const today = dayjs().format("YYYY-MM-DD");

  const { data: doctorData } = useQuery({
    queryKey: ["doctor", id],
    queryFn: async () => (await axiosInstance.get(`/hospital/doctors/${id}`)).data.data,
    enabled: !!id,
  });
  const doctorName = doctorData ? `Dr. ${doctorData.user?.firstName ?? ""} ${doctorData.user?.lastName ?? ""}`.trim() : "";

  // Upcoming (today on) comes back in full; only the past history is paged.
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["doctor-leaves", id, page],
    queryFn: async () => (await axiosInstance.get(`/hospital/doctors/${id}/leaves`, { params: { page, limit: 20 } })).data as PagedLeaves,
    enabled: !!id,
    placeholderData: keepPreviousData,
  });
  const upcoming = data?.upcoming ?? [];
  const past = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 0;

  const addLeave = useMutation({
    mutationFn: async () =>
      (await axiosInstance.post(`/hospital/doctors/${id}/leaves`, {
        fromDate,
        toDate: toDate || undefined,
        reason: reason || undefined,
        ...leaveScopeBody(scope),
      })).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Leave added");
      setBooked(res?.data?.booked ?? []);
      setReason("");
      setToDate("");
      setScope(EMPTY_LEAVE_SCOPE);
      queryClient.invalidateQueries({ queryKey: ["doctor-leaves", id] });
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, "Failed to add leave")),
  });

  const removeLeave = useMutation({
    mutationFn: async (leaveId: string) => (await axiosInstance.delete(`/hospital/doctors/${id}/leaves/${leaveId}`)).data,
    onSuccess: () => {
      toast.success("Leave removed");
      queryClient.invalidateQueries({ queryKey: ["doctor-leaves", id] });
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, "Failed to remove leave")),
  });
  const removeWithConfirm = async (leave: LeaveRow) => {
    const ok = await confirm({ title: "Remove leave", message: "Remove this leave?", confirmText: "Remove", destructive: true });
    if (ok) removeLeave.mutate(leave.doctorLeaveId);
  };

  return (
    <Box sx={{ maxWidth: FORM_PAGE_WIDTH, mx: "auto", width: "100%" }}>
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
            inputProps={{ min: today }}
          />
          <TextField
            size="small" type="date" label="To (optional)" InputLabelProps={{ shrink: true }}
            value={toDate} onChange={(e) => setToDate(e.target.value)}
            inputProps={{ min: fromDate || today }}
            helperText="Leave empty for a single day"
            sx={{ position: "relative" }}
            slotProps={{ formHelperText: { sx: { position: "absolute", top: "100%", left: 0, mt: 0.25, whiteSpace: "nowrap" } } }}
          />
          <TextField
            size="small" label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)}
            sx={{ minWidth: 220, flex: 1 }}
          />
          {/* Clear of the date field's hint, which hangs below it. */}
          <Box sx={{ flexBasis: "100%", mt: 1.5 }}>
            <LeaveScopeFields value={scope} onChange={setScope} branches={leaveBranches} />
          </Box>
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

      <Box sx={{ mb: 2 }}><LeaveBookedNotice booked={booked} onClose={() => setBooked([])} /></Box>

      <Divider sx={{ mb: 2 }} />

      {isLoading ? (
        <PageSkeleton />
      ) : isError ? (
        <ErrorState title="Couldn't load leaves" message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : (
        <>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Upcoming</Typography>
          <LeaveTable rows={upcoming} sortable branchName={branchName} onRemove={removeWithConfirm} removing={removeLeave.isPending}
            emptyText="No upcoming leave for this doctor." maxHeight="calc(100vh - 300px)" />
          {(past.length > 0 || page > 1) && (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 3, mb: 1 }}>Past</Typography>
              <LeaveTable rows={past} branchName={branchName} onRemove={removeWithConfirm} removing={removeLeave.isPending} emptyText="No past leave." />
              {totalPages > 1 && (<Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}><Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" shape="rounded" /></Box>)}
            </>
          )}
        </>
      )}
    </Box>
  );
}
