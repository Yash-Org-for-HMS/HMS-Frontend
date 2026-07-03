import { useMemo, useState } from "react";
import { formatINR } from "../../utils/format";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Button, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Chip, TextField, InputAdornment, Tabs, Tab, Tooltip, IconButton,
  Menu, MenuItem,
} from "@mui/material";
import {
  LocalHotelRounded, SearchRounded, SwapHorizRounded, LogoutRounded, MoreVertRounded,
  CancelRounded, SavingsRounded, UndoRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import Mascot from "../../components/Mascot";
import { TableRowsSkeleton } from "../../components/TableRowsSkeleton";
import { useToast } from "../../contexts/ToastContext";
import AdmitDialog from "../../components/ipd/AdmitDialog";
import TransferDialog from "../../components/ipd/TransferDialog";
import DischargeDialog from "../../components/ipd/DischargeDialog";
import DepositDialog from "../../components/ipd/DepositDialog";
import PageHeader from "../../components/layout/PageHeader";
import { useTableSort } from "../../components/table/useTableSort";
import SortableHeadCell from "../../components/table/SortableHeadCell";

const inr = (n: any) => formatINR(n, 0);

const STATUS_META: Record<string, { label: string; color: string }> = {
  ADMITTED: { label: "Admitted", color: "#0891b2" },
  DISCHARGED: { label: "Discharged", color: "#10b981" },
  CANCELLED: { label: "Cancelled", color: "#64748b" },
};
const TABS = ["ADMITTED", "DISCHARGED", ""];

export default function Admissions() {
  const toast = useToast();
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [admitOpen, setAdmitOpen] = useState(false);
  const [transferFor, setTransferFor] = useState<any>(null);
  const [dischargeFor, setDischargeFor] = useState<any>(null);
  const [depositFor, setDepositFor] = useState<{ row: any; mode: "collect" | "refund" } | null>(null);
  const [menu, setMenu] = useState<{ anchor: HTMLElement | null; row: any }>({ anchor: null, row: null });

  const status = TABS[tab];
  const { data: admissions = [], isLoading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["ipd-admissions", status],
    queryFn: async () => (await axiosInstance.get("/ipd/admissions", { params: status ? { status } : {} })).data.data,
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return admissions;
    return admissions.filter((a) => [a.patientName, a.uhid, a.admissionNumber, a.admittingDiagnosis].filter(Boolean).some((v: string) => v.toLowerCase().includes(s)));
  }, [admissions, search]);

  const { sorted, orderBy, order, onSort } = useTableSort(filtered, {
    patient: (a) => a.patientName,
    ipd: (a) => a.admissionNumber,
    diagnosis: (a) => a.admittingDiagnosis,
    bed: (a) => a.bed?.label,
    doctor: (a) => a.doctorName,
    days: (a) => (a.days != null ? Number(a.days) : null),
    deposit: (a) => Number(a.depositBalance || 0),
    status: (a) => (STATUS_META[a.status]?.label ?? a.status),
  });

  const cancel = async (row: any) => {
    setMenu({ anchor: null, row: null });
    try {
      await axiosInstance.post(`/ipd/admissions/${row.admissionId}/cancel`);
      toast.success("Admission cancelled");
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to cancel");
    }
  };

  return (
    <Box>
      <PageHeader
        title="Admissions"
        subtitle="In-patient admissions, transfers, and discharges"
        actions={
          <Button variant="contained" startIcon={<LocalHotelRounded />} onClick={() => setAdmitOpen(true)}
            sx={{ background: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)", fontWeight: 600, textTransform: "none", borderRadius: 2 }}>
            Admit Patient
          </Button>
        }
      />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2, mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ "& .MuiTab-root": { textTransform: "none", fontWeight: 600 }, "& .Mui-selected": { color: "#0891b2 !important" }, "& .MuiTabs-indicator": { bgcolor: "#0891b2" } }}>
          <Tab label="Current" /><Tab label="Discharged" /><Tab label="All" />
        </Tabs>
        <TextField placeholder="Search patient, IPD#, diagnosis…" value={search} onChange={(e) => setSearch(e.target.value)} size="small"
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchRounded sx={{ color: "text.secondary", fontSize: 20 }} /></InputAdornment>) }} sx={{ minWidth: 280 }} />
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <TableContainer sx={{ maxHeight: "calc(100vh - 300px)" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <SortableHeadCell label="Patient" sortKey="patient" orderBy={orderBy} order={order} onSort={onSort} />
                <SortableHeadCell label="IPD #" sortKey="ipd" orderBy={orderBy} order={order} onSort={onSort} />
                <SortableHeadCell label="Diagnosis" sortKey="diagnosis" orderBy={orderBy} order={order} onSort={onSort} />
                <SortableHeadCell label="Bed" sortKey="bed" orderBy={orderBy} order={order} onSort={onSort} />
                <SortableHeadCell label="Doctor" sortKey="doctor" orderBy={orderBy} order={order} onSort={onSort} />
                <SortableHeadCell label="Days" sortKey="days" orderBy={orderBy} order={order} onSort={onSort} />
                <SortableHeadCell label="Deposit" sortKey="deposit" orderBy={orderBy} order={order} onSort={onSort} align="right" />
                <SortableHeadCell label="Status" sortKey="status" orderBy={orderBy} order={order} onSort={onSort} />
                <TableCell align="right" sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", py: 2, bgcolor: "background.default" }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={6} columns={9} />
              ) : isError ? (
                <TableRow><TableCell colSpan={9} sx={{ py: 4, border: 0 }}><ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} /></TableCell></TableRow>
              ) : sorted.length === 0 ? (
                <TableRow><TableCell colSpan={9} sx={{ py: 4, border: 0 }}><Mascot pose="all-caught-up" title="No admissions" subtitle="Nothing here for this filter." /></TableCell></TableRow>
              ) : sorted.map((a) => {
                const sm = STATUS_META[a.status] || { label: a.status, color: "#64748b" };
                return (
                  <TableRow key={a.admissionId} hover>
                    <TableCell sx={{ py: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>{a.patientName}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>{a.uhid}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace", color: "text.secondary" }}>{a.admissionNumber || "—"}</TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Tooltip title={a.admittingDiagnosis || ""}>
                        <Typography variant="body2" sx={{ color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{a.admittingDiagnosis || "—"}</Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell><Typography variant="body2" sx={{ color: "text.primary" }}>{a.bed?.label || "—"}</Typography></TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>{a.doctorName || "—"}</TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>{a.days ?? "—"}</TableCell>
                    <TableCell align="right">
                      {Number(a.depositBalance) > 0
                        ? <Chip label={inr(a.depositBalance)} size="small" sx={{ bgcolor: "rgba(8,145,178,0.12)", color: "#0891b2", fontWeight: 700 }} />
                        : <Typography variant="caption" sx={{ color: "text.disabled" }}>—</Typography>}
                    </TableCell>
                    <TableCell><Chip label={sm.label} size="small" sx={{ bgcolor: `${sm.color}22`, color: sm.color, fontWeight: 700 }} /></TableCell>
                    <TableCell align="right">
                      {a.status === "ADMITTED" && (
                        <>
                          <Tooltip title="Transfer bed"><IconButton size="small" onClick={() => setTransferFor(a)} sx={{ color: "text.secondary", "&:hover": { color: "#0891b2" } }}><SwapHorizRounded fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Discharge"><IconButton size="small" onClick={() => setDischargeFor(a)} sx={{ color: "text.secondary", "&:hover": { color: "#ef4444" } }}><LogoutRounded fontSize="small" /></IconButton></Tooltip>
                        </>
                      )}
                      {(a.status === "ADMITTED" || Number(a.depositBalance) > 0) && (
                        <IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, row: a })} sx={{ color: "text.secondary" }}><MoreVertRounded fontSize="small" /></IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Menu anchorEl={menu.anchor} open={Boolean(menu.anchor)} onClose={() => setMenu({ anchor: null, row: null })}>
        {menu.row?.status === "ADMITTED" && (
          <MenuItem onClick={() => { const r = menu.row; setMenu({ anchor: null, row: null }); setDepositFor({ row: r, mode: "collect" }); }}>
            <SavingsRounded fontSize="small" sx={{ mr: 1, color: "#0891b2" }} /> Collect deposit
          </MenuItem>
        )}
        {Number(menu.row?.depositBalance) > 0 && (
          <MenuItem onClick={() => { const r = menu.row; setMenu({ anchor: null, row: null }); setDepositFor({ row: r, mode: "refund" }); }}>
            <UndoRounded fontSize="small" sx={{ mr: 1, color: "#8b5cf6" }} /> Refund deposit{menu.row?.status !== "ADMITTED" ? ` (${inr(menu.row?.depositBalance)})` : ""}
          </MenuItem>
        )}
        {menu.row?.status === "ADMITTED" && (
          <MenuItem onClick={() => cancel(menu.row)} sx={{ color: "#ef4444" }}><CancelRounded fontSize="small" sx={{ mr: 1 }} /> Cancel admission</MenuItem>
        )}
      </Menu>

      {admitOpen && <AdmitDialog open={admitOpen} onClose={() => setAdmitOpen(false)} onAdmitted={() => { setAdmitOpen(false); refetch(); }} />}
      {transferFor && <TransferDialog open admission={transferFor} onClose={() => setTransferFor(null)} onDone={() => { setTransferFor(null); refetch(); }} />}
      {dischargeFor && <DischargeDialog open admissionId={dischargeFor.admissionId} onClose={() => setDischargeFor(null)} onDone={() => { setDischargeFor(null); refetch(); }} />}
      {depositFor && <DepositDialog open mode={depositFor.mode} admission={depositFor.row} onClose={() => setDepositFor(null)} onDone={() => { setDepositFor(null); refetch(); }} />}
    </Box>
  );
}
