import { useMemo, useState } from "react";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, TextField, InputAdornment, MenuItem,
  IconButton, Tooltip, Menu,
} from "@mui/material";
import {
  AddRounded, SearchRounded, MoreVertRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import ReferralDialog from "@/components/reception/ReferralDialog";
import PageHeader from "@/components/layout/PageHeader";
import { useTableSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";
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

  const { sorted, orderBy, order, onSort } = useTableSort(filtered, {
    patient: (r) => r.patientName,
    type: (r) => (r.referralType === "EXTERNAL" ? "External" : "Internal"),
    destination: (r) => r.destination,
    reason: (r) => r.reason,
    status: (r) => (STATUS_META[r.status]?.label ?? r.status),
    created: (r) => (r.createdAt ? new Date(r.createdAt) : null),
  });

  const changeStatus = async (referralId: string, status: string) => {
    setMenu({ anchor: null, referral: null });
    try {
      await axiosInstance.put(`/reception/referrals/${referralId}/status`, { status });
      toast.success(`Referral marked ${status.toLowerCase()}`);
      refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to update referral"));
    }
  };

  return (
    <Box>
      {/* Header */}
      <PageHeader
        title="Referrals"
        subtitle="Refer patients to another department or an external facility"
        actions={
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => setCreateOpen(true)}
            sx={{ background: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)", fontWeight: 600, textTransform: "none", borderRadius: 2 }}>
            New Referral
          </Button>
        }
      />

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
                <SortableHeadCell label="Patient" sortKey="patient" orderBy={orderBy} order={order} onSort={onSort} />
                <SortableHeadCell label="Type" sortKey="type" orderBy={orderBy} order={order} onSort={onSort} />
                <SortableHeadCell label="Destination" sortKey="destination" orderBy={orderBy} order={order} onSort={onSort} />
                <SortableHeadCell label="Reason" sortKey="reason" orderBy={orderBy} order={order} onSort={onSort} />
                <SortableHeadCell label="Status" sortKey="status" orderBy={orderBy} order={order} onSort={onSort} />
                <SortableHeadCell label="Created" sortKey="created" orderBy={orderBy} order={order} onSort={onSort} />
                <TableCell align="right" sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", py: 2, bgcolor: "background.default" }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={6} columns={7} />
              ) : isError ? (
                <TableRow><TableCell colSpan={7} sx={{ py: 4, border: 0 }}><ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /></TableCell></TableRow>
              ) : sorted.length === 0 ? (
                <TableRow><TableCell colSpan={7} sx={{ py: 4, border: 0 }}><Mascot pose="all-caught-up" title="No referrals" subtitle="No referrals match your filters." /></TableCell></TableRow>
              ) : (
                sorted.map((r) => {
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
        <ReferralDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); refetch(); }} />
      )}
    </Box>
  );
}
