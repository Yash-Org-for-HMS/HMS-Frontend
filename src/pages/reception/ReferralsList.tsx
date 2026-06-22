import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, TextField, InputAdornment, MenuItem, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, ToggleButton,
  ToggleButtonGroup, IconButton, Tooltip, Menu,
} from "@mui/material";
import {
  AddRounded, SearchRounded, MoreVertRounded, CallSplitRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import Mascot from "../../components/Mascot";
import { useToast } from "../../contexts/ToastContext";
import dayjs from "dayjs";

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "#f59e0b" },
  ACCEPTED: { label: "Accepted", color: "#3b82f6" },
  COMPLETED: { label: "Completed", color: "#10b981" },
  CANCELLED: { label: "Cancelled", color: "#ef4444" },
};

// Allowed next states from each status (terminal states have none).
const NEXT_STATES: Record<string, string[]> = {
  PENDING: ["ACCEPTED", "COMPLETED", "CANCELLED"],
  ACCEPTED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export default function ReferralsList() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [menu, setMenu] = useState<{ anchor: HTMLElement | null; referral: any }>({ anchor: null, referral: null });

  const { data: referrals = [], isLoading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["referrals", statusFilter, typeFilter],
    queryFn: async () => (await axiosInstance.get("/reception/referrals", {
      params: { ...(statusFilter ? { status: statusFilter } : {}), ...(typeFilter ? { type: typeFilter } : {}) },
    })).data.data,
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return referrals;
    return referrals.filter((r) =>
      [r.patientName, r.uhid, r.destination, r.reason].filter(Boolean).some((v: string) => v.toLowerCase().includes(s))
    );
  }, [referrals, search]);

  const changeStatus = async (referralId: string, status: string) => {
    setMenu({ anchor: null, referral: null });
    try {
      await axiosInstance.put(`/reception/referrals/${referralId}/status`, { status });
      toast.success(`Referral marked ${status.toLowerCase()}`);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update referral");
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 800, mb: 0.5 }}>Referrals</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>Refer patients to another department or an external facility</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRounded />} onClick={() => setCreateOpen(true)}
          sx={{ background: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)", fontWeight: 600, textTransform: "none", borderRadius: 2 }}>
          New Referral
        </Button>
      </Box>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField
          placeholder="Search patient, destination, reason…" value={search} onChange={(e) => setSearch(e.target.value)} size="small"
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchRounded sx={{ color: "text.secondary", fontSize: 20 }} /></InputAdornment>) }}
          sx={{ minWidth: 280 }}
        />
        <TextField select size="small" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="">All statuses</MenuItem>
          {Object.keys(STATUS_META).map((s) => <MenuItem key={s} value={s}>{STATUS_META[s].label}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="">All types</MenuItem>
          <MenuItem value="INTERNAL">Internal</MenuItem>
          <MenuItem value="EXTERNAL">External</MenuItem>
        </TextField>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <TableContainer sx={{ maxHeight: "calc(100vh - 280px)" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {["Patient", "Type", "Destination", "Reason", "Status", "Created", ""].map((h, i) => (
                  <TableCell key={h || i} align={i === 6 ? "right" : "left"} sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", py: 2, bgcolor: "background.default" }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4 }}><CircularProgress size={28} sx={{ color: "#06b6d4" }} /></TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={7} sx={{ py: 4, border: 0 }}><ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} sx={{ py: 4, border: 0 }}><Mascot pose="all-caught-up" title="No referrals" subtitle="No referrals match your filters." /></TableCell></TableRow>
              ) : (
                filtered.map((r) => {
                  const sm = STATUS_META[r.status] || { label: r.status, color: "#64748b" };
                  const nexts = NEXT_STATES[r.status] || [];
                  return (
                    <TableRow key={r.referralId} sx={{ "&:hover": { bgcolor: "background.default" } }}>
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>{r.patientName}</Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>{r.uhid}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={r.referralType === "EXTERNAL" ? "External" : "Internal"} size="small"
                          sx={{ bgcolor: r.referralType === "EXTERNAL" ? "rgba(139,92,246,0.12)" : "rgba(8,145,178,0.12)", color: r.referralType === "EXTERNAL" ? "#8b5cf6" : "#0891b2", fontWeight: 700 }} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: "text.primary" }}>{r.destination}</Typography>
                        {r.fromDepartmentName && <Typography variant="caption" sx={{ color: "text.secondary" }}>from {r.fromDepartmentName}</Typography>}
                        {r.referralType === "EXTERNAL" && r.externalContact && <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{r.externalContact}</Typography>}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280 }}>
                        <Tooltip title={r.reason || ""}>
                          <Typography variant="body2" sx={{ color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>{r.reason}</Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip label={sm.label} size="small" sx={{ bgcolor: `${sm.color}22`, color: sm.color, border: `1px solid ${sm.color}55`, fontWeight: 600 }} />
                      </TableCell>
                      <TableCell><Typography variant="caption" sx={{ color: "text.secondary" }}>{dayjs(r.createdAt).format("DD MMM YYYY")}</Typography></TableCell>
                      <TableCell align="right">
                        {nexts.length > 0 && (
                          <IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, referral: r })} sx={{ color: "text.secondary" }}>
                            <MoreVertRounded fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Status menu */}
      <Menu anchorEl={menu.anchor} open={Boolean(menu.anchor)} onClose={() => setMenu({ anchor: null, referral: null })}>
        {(NEXT_STATES[menu.referral?.status] || []).map((s) => (
          <MenuItem key={s} onClick={() => changeStatus(menu.referral.referralId, s)}>
            Mark {STATUS_META[s].label}
          </MenuItem>
        ))}
      </Menu>

      {createOpen && (
        <ReferralCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); refetch(); }} />
      )}
    </Box>
  );
}

function ReferralCreateDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    patientId: "", referralType: "INTERNAL", fromDepartmentId: "", toDepartmentId: "",
    externalFacility: "", externalContact: "", reason: "", notes: "",
  });

  const { data: dropdowns = { departments: [], patients: [] } } = useQuery({
    queryKey: ["appointment-dropdowns"],
    queryFn: async () => (await axiosInstance.get("/reception/appointments/dropdowns")).data.data,
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const isExternal = form.referralType === "EXTERNAL";
  const canSubmit = form.patientId && form.reason.trim().length > 0 &&
    (isExternal ? form.externalFacility.trim().length > 0 : !!form.toDepartmentId);

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await axiosInstance.post("/reception/referrals", {
        patientId: form.patientId,
        referralType: form.referralType,
        fromDepartmentId: form.fromDepartmentId || undefined,
        toDepartmentId: isExternal ? undefined : form.toDepartmentId,
        externalFacility: isExternal ? form.externalFacility : undefined,
        externalContact: isExternal ? form.externalContact : undefined,
        reason: form.reason,
        notes: form.notes || undefined,
      });
      toast.success("Referral created");
      onCreated();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create referral");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <CallSplitRounded sx={{ color: "#06b6d4" }} /> New Referral
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2.5} sx={{ pt: 0.5 }}>
          <Grid size={{ xs: 12 }}>
            <TextField select fullWidth required label="Patient" value={form.patientId} onChange={(e) => set("patientId", e.target.value)}>
              <MenuItem value="" disabled>Select a patient</MenuItem>
              {(dropdowns?.patients || []).map((p: any) => (
                <MenuItem key={p.patientId} value={p.patientId}>{p.firstName} {p.lastName} — {p.uhidNumber}</MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <ToggleButtonGroup exclusive size="small" value={form.referralType} onChange={(_, v) => v && set("referralType", v)}
              sx={{ "& .MuiToggleButton-root.Mui-selected": { bgcolor: "#0891b2", color: "#fff", "&:hover": { bgcolor: "#0e7490" } } }}>
              <ToggleButton value="INTERNAL" sx={{ textTransform: "none", px: 2 }}>Internal (department)</ToggleButton>
              <ToggleButton value="EXTERNAL" sx={{ textTransform: "none", px: 2 }}>External (facility)</ToggleButton>
            </ToggleButtonGroup>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select fullWidth label="From department (optional)" value={form.fromDepartmentId} onChange={(e) => set("fromDepartmentId", e.target.value)}>
              <MenuItem value="">—</MenuItem>
              {(dropdowns?.departments || []).map((d: any) => (
                <MenuItem key={d.departmentId} value={d.departmentId}>{d.departmentName}</MenuItem>
              ))}
            </TextField>
          </Grid>

          {isExternal ? (
            <>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth required label="External facility" value={form.externalFacility} onChange={(e) => set("externalFacility", e.target.value)} placeholder="e.g. City Diagnostics" />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="Facility contact (optional)" value={form.externalContact} onChange={(e) => set("externalContact", e.target.value)} placeholder="Phone / address" />
              </Grid>
            </>
          ) : (
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select fullWidth required label="To department" value={form.toDepartmentId} onChange={(e) => set("toDepartmentId", e.target.value)}>
                <MenuItem value="" disabled>Select a department</MenuItem>
                {(dropdowns?.departments || []).map((d: any) => (
                  <MenuItem key={d.departmentId} value={d.departmentId}>{d.departmentName}</MenuItem>
                ))}
              </TextField>
            </Grid>
          )}

          <Grid size={{ xs: 12 }}>
            <TextField fullWidth required label="Reason" value={form.reason} onChange={(e) => set("reason", e.target.value)} multiline rows={2} placeholder="Why is the patient being referred?" />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth label="Notes (optional)" value={form.notes} onChange={(e) => set("notes", e.target.value)} multiline rows={2} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving || !canSubmit}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <AddRounded />}
          sx={{ bgcolor: "#0891b2", "&:hover": { bgcolor: "#0e7490" } }}>
          Create Referral
        </Button>
      </DialogActions>
    </Dialog>
  );
}
