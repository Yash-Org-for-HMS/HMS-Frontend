import { useEffect, useState } from "react";
import type { AdmissionRow } from "./ipd.types";
import { SEMANTIC, NEUTRAL, BRAND, alpha } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { formatINR } from "@/utils/format";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  Box, Typography, Button, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Chip, TextField, InputAdornment, Tabs, Tab, Tooltip, IconButton,
  Menu, MenuItem, Pagination,
} from "@mui/material";
import {
  LocalHotelRounded, SearchRounded, SwapHorizRounded, LogoutRounded, MoreVertRounded,
  CancelRounded, SavingsRounded, UndoRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import AdmitDialog from "@/components/ipd/AdmitDialog";
import TransferDialog from "@/components/ipd/TransferDialog";
import DischargeDialog from "@/components/ipd/DischargeDialog";
import DepositDialog from "@/components/ipd/DepositDialog";
import PageHeader from "@/components/layout/PageHeader";
import { useTableSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";

const inr = (n: number | string) => formatINR(n, 0);

const STATUS_META: Record<string, { label: string; color: string }> = {
  ADMITTED: { label: "Admitted", color: BRAND.action },
  DISCHARGED: { label: "Discharged", color: SEMANTIC.success },
  CANCELLED: { label: "Cancelled", color: NEUTRAL.muted },
};
/**
 * The tabs, as the query each one runs.
 *
 * "To return" is not a status but the closed admissions the hospital still
 * holds money for. Its filter is server-side (see listAdmissions) because the
 * balance is summed from deposit entries rather than stored — narrowing the
 * page in the browser would drop rows and report the wrong total.
 */
const TABS: { label: string; params: Record<string, string> }[] = [
  { label: "Current", params: { status: "ADMITTED" } },
  { label: "Discharged", params: { status: "DISCHARGED" } },
  { label: "All", params: {} },
  { label: "To return", params: { pendingDeposit: "true" } },
];

/**
 * The advance still held against an admission.
 *
 * On a live admission it is a running balance; once closed it is the patient's
 * money the hospital still has. Shows the same three states the reconciliation
 * check reports — running · held for a stated reason · unexplained — so the
 * check and the ward cannot drift apart.
 */
function DepositChip({ admission }: {
  admission: { depositBalance: number | string; status: string; advanceHoldReason?: string | null };
}) {
  const amount = inr(admission.depositBalance);
  const closed = admission.status === "DISCHARGED" || admission.status === "CANCELLED";
  if (!closed) {
    return <Chip label={amount} size="small" sx={{ bgcolor: alpha(BRAND.action, 0.12), color: BRAND.action, fontWeight: 700 }} />;
  }

  const reason = (admission.advanceHoldReason || "").trim();
  const tone = reason ? SEMANTIC.warning : SEMANTIC.danger;
  return (
    <Tooltip title={reason
      ? `Held after discharge — ${reason}`
      : "Held after discharge with no reason recorded. Refund it to the patient, or record why it stays."}>
      <Chip
        label={`${amount} held`}
        size="small"
        sx={{ bgcolor: alpha(tone, 0.14), color: tone, fontWeight: 700, border: `1px solid ${alpha(tone, 0.35)}` }}
      />
    </Tooltip>
  );
}

// `readOnly` renders a pure oversight view (hospital-admin Operations): the
// "Admit Patient" button and every per-row action (medicines, labs, radiology,
// surgery, transfer, discharge, collect/refund deposit, cancel) are hidden, so
// the admin can watch the ward census without acting on any admission. Defaults
// keep the IPD/reception panel fully interactive.
export default function Admissions({ readOnly = false }: { readOnly?: boolean } = {}) {
  const toast = useToast();
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [admitOpen, setAdmitOpen] = useState(false);
  // Each dialog is opened for one admission row, so they all hold the same shape.
  const [transferFor, setTransferFor] = useState<AdmissionRow | null>(null);
  const [dischargeFor, setDischargeFor] = useState<AdmissionRow | null>(null);
  const [depositFor, setDepositFor] = useState<{ row: AdmissionRow; mode: "collect" | "refund" } | null>(null);
  const [menu, setMenu] = useState<{ anchor: HTMLElement | null; row: AdmissionRow | null }>({ anchor: null, row: null });

  const tabParams = TABS[tab].params;
  const tabKey = TABS[tab].label;
  const isReturnTab = Boolean(tabParams.pendingDeposit);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  // Search + tab drive a fresh first page (server-side search & paging).
  useEffect(() => { setPage(1); }, [debouncedSearch, tabKey]);

  const { data: resp, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ipd-admissions", tabKey, debouncedSearch, page],
    queryFn: async () =>
      (await axiosInstance.get("/ipd/admissions", {
        params: { ...tabParams, search: debouncedSearch || undefined, page, limit: 20 },
      })).data,
    placeholderData: keepPreviousData,
  });

  // How much is waiting to go back, and to how many people — read once for the
  // tab's badge so the number is visible without opening it.
  const { data: owedResp } = useQuery({
    queryKey: ["ipd-admissions-to-return"],
    queryFn: async () =>
      (await axiosInstance.get("/ipd/admissions", { params: { pendingDeposit: "true", limit: 100 } })).data,
    refetchOnWindowFocus: true,
  });
  // Only the two fields the badge and summary read, so the split between
  // "no reason recorded" and "deliberately held" stays type-checked.
  const owedRows: { depositBalance: number | string; advanceHoldReason?: string | null }[] = owedResp?.data || [];
  const owedTotal = owedRows.reduce((t, a) => t + Number(a.depositBalance || 0), 0);
  const admissions: AdmissionRow[] = resp?.data || [];
  const meta = resp?.meta as { total: number; totalPages: number } | undefined;

  // Client-side sort of the current page (server owns filtering + paging).
  const { sorted, orderBy, order, onSort } = useTableSort(admissions, {
    patient: (a) => a.patientName,
    ipd: (a) => a.admissionNumber,
    diagnosis: (a) => a.admittingDiagnosis,
    bed: (a) => a.bed?.label,
    doctor: (a) => a.doctorName,
    days: (a) => (a.days != null ? Number(a.days) : null),
    deposit: (a) => Number(a.depositBalance || 0),
    status: (a) => (STATUS_META[a.status]?.label ?? a.status),
  });

  const cancel = async (row: AdmissionRow) => {
    setMenu({ anchor: null, row: null });
    try {
      await axiosInstance.post(`/ipd/admissions/${row.admissionId}/cancel`);
      toast.success("Admission cancelled");
      refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to cancel"));
    }
  };

  return (
    <Box>
      <PageHeader
        title="Admissions"
        subtitle="In-patient admissions, transfers, and discharges"
        actions={
          readOnly ? undefined : (
          <Button variant="contained" startIcon={<LocalHotelRounded />} onClick={() => setAdmitOpen(true)}
            sx={{ fontWeight: 600, textTransform: "none", borderRadius: 2 }}>
            Admit Patient
          </Button>
          )
        }
      />

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2, mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ "& .MuiTab-root": { textTransform: "none", fontWeight: 600 }, "& .Mui-selected": { color: "#7c3aed !important" }, "& .MuiTabs-indicator": { bgcolor: BRAND.action } }}>
          {TABS.map((t) => (
            <Tab
              key={t.label}
              label={
                // The count rides on the tab so money waiting to go back is
                // visible without opening it — the whole failure this fixes was
                // that nobody had a reason to look.
                t.params.pendingDeposit && owedRows.length ? (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    {t.label}
                    <Chip label={owedRows.length} size="small" sx={{ height: 18, fontSize: "0.7rem", fontWeight: 700, bgcolor: alpha(SEMANTIC.warning, 0.16), color: SEMANTIC.warning }} />
                  </Box>
                ) : t.label
              }
            />
          ))}
        </Tabs>
        <TextField placeholder="Search patient, IPD#, diagnosis…" value={search} onChange={(e) => setSearch(e.target.value)} size="small"
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchRounded sx={{ color: "text.secondary", fontSize: 20 }} /></InputAdornment>) }} sx={{ minWidth: 340 }} />
      </Box>

      {/* What the tab is for, and what it adds up to. Split by whether a reason
          was given at discharge, because only one of the two is an oversight. */}
      {isReturnTab && owedRows.length > 0 && (
        <Paper elevation={0} sx={{
          borderRadius: 3, border: "1px solid", borderColor: alpha(SEMANTIC.warning, 0.35),
          bgcolor: alpha(SEMANTIC.warning, 0.07), px: 2.5, py: 1.75, mb: 2,
          display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap",
        }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: SEMANTIC.warning, lineHeight: 1.2 }}>{inr(owedTotal)}</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              still held across {owedRows.length} closed admission{owedRows.length === 1 ? "" : "s"}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 2.5, flexWrap: "wrap" }}>
            {(() => {
              const unexplained = owedRows.filter((a) => !(a.advanceHoldReason || "").trim());
              const held = owedRows.length - unexplained.length;
              return (
                <>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    <b style={{ color: SEMANTIC.danger }}>{unexplained.length}</b> with no reason recorded
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    <b>{held}</b> deliberately held
                  </Typography>
                </>
              );
            })()}
          </Box>
          <Typography variant="caption" sx={{ color: "text.secondary", ml: "auto" }}>
            Use the ↩ action on a row to return it to the patient.
          </Typography>
        </Paper>
      )}

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
                <TableRow><TableCell colSpan={9} sx={{ py: 4, border: 0 }}><ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /></TableCell></TableRow>
              ) : sorted.length === 0 ? (
                <TableRow><TableCell colSpan={9} sx={{ py: 4, border: 0 }}><Mascot pose="all-caught-up" title="No admissions" subtitle="Nothing here for this filter." /></TableCell></TableRow>
              ) : sorted.map((a) => {
                const sm = STATUS_META[a.status] || { label: a.status, color: NEUTRAL.muted };
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
                        ? <DepositChip admission={a} />
                        : <Typography variant="caption" sx={{ color: "text.disabled" }}>—</Typography>}
                    </TableCell>
                    <TableCell><Chip label={sm.label} size="small" sx={{ bgcolor: `${sm.color}22`, color: sm.color, fontWeight: 700 }} /></TableCell>
                    <TableCell align="right">
                      {!readOnly && a.status === "ADMITTED" && (
                        <>
                          <Tooltip title="Transfer bed"><IconButton size="small" onClick={() => setTransferFor(a)} sx={{ color: "text.secondary", "&:hover": { color: BRAND.action } }}><SwapHorizRounded fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Discharge"><IconButton size="small" onClick={() => setDischargeFor(a)} sx={{ color: "text.secondary", "&:hover": { color: SEMANTIC.danger } }}><LogoutRounded fontSize="small" /></IconButton></Tooltip>
                        </>
                      )}
                      {!readOnly && Number(a.depositBalance) > 0 && (
                        <Tooltip title={`Refund deposit (${inr(a.depositBalance)})`}>
                          <IconButton size="small" onClick={() => setDepositFor({ row: a, mode: "refund" })} sx={{ color: "#8b5cf6", "&:hover": { color: "#7c3aed" } }}><UndoRounded fontSize="small" /></IconButton>
                        </Tooltip>
                      )}
                      {!readOnly && a.status === "ADMITTED" && (
                        <IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, row: a })} sx={{ color: "text.secondary" }}><MoreVertRounded fontSize="small" /></IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        {meta && meta.totalPages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 2, py: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>{meta.total} admission{meta.total === 1 ? "" : "s"}</Typography>
            <Pagination count={meta.totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" shape="rounded" size="small" />
          </Box>
        )}
      </Paper>

      <Menu anchorEl={menu.anchor} open={Boolean(menu.anchor)} onClose={() => setMenu({ anchor: null, row: null })}>
        {menu.row?.status === "ADMITTED" && (
          <MenuItem onClick={() => { const r = menu.row; if (!r) return; setMenu({ anchor: null, row: null }); setDepositFor({ row: r, mode: "collect" }); }}>
            <SavingsRounded fontSize="small" sx={{ mr: 1, color: BRAND.action }} /> Collect deposit
          </MenuItem>
        )}
        {menu.row?.status === "ADMITTED" && (
          <MenuItem onClick={() => { if (menu.row) cancel(menu.row); }} sx={{ color: SEMANTIC.danger }}><CancelRounded fontSize="small" sx={{ mr: 1 }} /> Cancel admission</MenuItem>
        )}
      </Menu>

      {admitOpen && <AdmitDialog open={admitOpen} onClose={() => setAdmitOpen(false)} onAdmitted={() => { setAdmitOpen(false); refetch(); }} />}
      {transferFor && <TransferDialog open admission={transferFor} onClose={() => setTransferFor(null)} onDone={() => { setTransferFor(null); refetch(); }} />}
      {dischargeFor && <DischargeDialog open admissionId={dischargeFor.admissionId} onClose={() => setDischargeFor(null)} onDone={() => { setDischargeFor(null); refetch(); }} />}
      {depositFor && <DepositDialog open mode={depositFor.mode} admission={depositFor.row} onClose={() => setDepositFor(null)} onDone={() => { setDepositFor(null); refetch(); }} />}
    </Box>
  );
}
