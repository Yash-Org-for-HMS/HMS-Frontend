import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Tooltip, IconButton, Alert,
} from "@mui/material";
import { AddRounded, EditRounded, DomainRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { SEMANTIC, NEUTRAL } from "@/styles/accents";
import PageHeader from "@/components/layout/PageHeader";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";

interface BranchUsage { staff: number; admitted: number; appointments: number; invoices: number }
interface BranchRow {
  branchId: string; branchCode: string; branchName: string; status: string;
  city?: string | null; state?: string | null; usage: BranchUsage;
}
interface BranchesData {
  branches: BranchRow[];
  quota: { used: number; limit: number | null; planName: string | null };
}

const blank = { branchName: "", city: "", state: "" };

export default function Branches() {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; editing: BranchRow | null }>({ open: false, editing: null });
  const [form, setForm] = useState(blank);

  const { data, isLoading, isError, error, refetch } = useQuery<BranchesData>({
    queryKey: ["hospital-branches"],
    queryFn: async () => (await axiosInstance.get("/hospital/branches")).data.data,
  });

  const branches = data?.branches ?? [];
  const quota = data?.quota;
  const atLimit = quota?.limit != null && quota.used >= quota.limit;

  const save = useMutation({
    mutationFn: async () => {
      const body = { branchName: form.branchName.trim(), city: form.city.trim() || undefined, state: form.state.trim() || undefined };
      if (dialog.editing) return axiosInstance.put(`/hospital/branches/${dialog.editing.branchId}`, body);
      return axiosInstance.post("/hospital/branches", body);
    },
    onSuccess: () => {
      toast.success(dialog.editing ? "Branch updated" : "Branch opened");
      setDialog({ open: false, editing: null });
      qc.invalidateQueries({ queryKey: ["hospital-branches"] });
      // The switcher in the layout reads its own list.
      qc.invalidateQueries({ queryKey: ["my-branches"] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Couldn't save the branch")),
  });

  const setStatus = useMutation({
    mutationFn: async ({ branchId, status }: { branchId: string; status: string }) =>
      axiosInstance.put(`/hospital/branches/${branchId}/status`, { status }),
    onSuccess: (_d, v) => {
      toast.success(v.status === "active" ? "Branch reopened" : "Branch closed");
      qc.invalidateQueries({ queryKey: ["hospital-branches"] });
      qc.invalidateQueries({ queryKey: ["my-branches"] });
    },
    // The server refuses to close a branch with patients still on it, or the
    // last open one; those messages say exactly what to do, so show them.
    onError: (e) => toast.error(getApiErrorMessage(e, "Couldn't change the branch")),
  });

  const openCreate = () => { setForm(blank); setDialog({ open: true, editing: null }); };
  const openEdit = (b: BranchRow) => {
    setForm({ branchName: b.branchName, city: b.city ?? "", state: b.state ?? "" });
    setDialog({ open: true, editing: b });
  };

  const toggle = async (b: BranchRow) => {
    const closing = b.status === "active";
    const ok = await confirm({
      title: closing ? `Close ${b.branchName}?` : `Reopen ${b.branchName}?`,
      message: closing
        ? "Staff will no longer be able to select this branch, and it will stop appearing in the branch switcher. Its records are kept and it can be reopened at any time."
        : "Staff assigned to this branch will be able to select it again.",
      confirmText: closing ? "Close branch" : "Reopen",
      destructive: closing,
    });
    if (ok) setStatus.mutate({ branchId: b.branchId, status: closing ? "inactive" : "active" });
  };

  return (
    <Box>
      <PageHeader
        title="Branches"
        subtitle="The locations this hospital operates. Staff and records are scoped to the branch they belong to."
        actions={
          <Tooltip title={atLimit ? `Your ${quota?.planName} plan allows ${quota?.limit} branches. Contact your provider to add more.` : ""}>
            <span>
              <Button variant="contained" startIcon={<AddRounded />} onClick={openCreate} disabled={atLimit}>
                Open a branch
              </Button>
            </span>
          </Tooltip>
        }
      />

      {quota?.limit != null && (
        <Alert severity={atLimit ? "warning" : "info"} sx={{ mb: 3, borderRadius: 2 }}>
          Using <strong>{quota.used} of {quota.limit}</strong> branches on the {quota.planName} plan.
          {atLimit && " You'll need a larger plan to open another."}
        </Alert>
      )}

      {isLoading ? (
        <DetailSkeleton />
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : branches.length === 0 ? (
        <Mascot pose="nothing-here-yet" title="No branches" subtitle="Open one to get started." />
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Branch</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Where</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>In use</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {branches.map((b) => (
                <TableRow key={b.branchId} hover>
                  <TableCell sx={{ fontWeight: 500 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <DomainRounded fontSize="small" sx={{ color: NEUTRAL.muted }} />
                      {b.branchName}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{b.branchCode}</TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>
                    {[b.city, b.state].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  {/* What the branch is carrying, so the decision to close one
                      can be made from this row rather than by guesswork. */}
                  <TableCell sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
                    {b.usage.staff} staff · {b.usage.appointments} appts · {b.usage.invoices} bills
                    {b.usage.admitted > 0 && (
                      <Chip
                        label={`${b.usage.admitted} admitted`}
                        size="small"
                        sx={{ ml: 1, height: 20, bgcolor: "rgba(245,158,11,0.14)", color: SEMANTIC.warning, fontWeight: 600 }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={b.status === "active" ? "Open" : "Closed"}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        bgcolor: b.status === "active" ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.14)",
                        color: b.status === "active" ? SEMANTIC.successLight : NEUTRAL.muted,
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Rename or move">
                      <IconButton size="small" onClick={() => openEdit(b)}>
                        <EditRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Button size="small" onClick={() => toggle(b)} sx={{ textTransform: "none", ml: 1 }}>
                      {b.status === "active" ? "Close" : "Reopen"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, editing: null })} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog.editing ? `Edit ${dialog.editing.branchName}` : "Open a branch"}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            {dialog.editing
              ? "The branch code stays as it is — records already reference it."
              : "A branch code is assigned automatically. You can move staff to the new branch from Staff & Users."}
          </Typography>
          <TextField
            autoFocus fullWidth label="Branch name" required sx={{ mb: 2 }}
            value={form.branchName} onChange={(e) => setForm({ ...form, branchName: e.target.value })}
            placeholder="e.g. Sector 21 Clinic"
          />
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField fullWidth label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <TextField fullWidth label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog({ open: false, editing: null })} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => save.mutate()}
            disabled={!form.branchName.trim() || save.isPending}
            sx={{ textTransform: "none" }}
          >
            {dialog.editing ? "Save" : "Open branch"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
