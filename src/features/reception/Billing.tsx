import { ACCENTS } from "../../styles/accents";
import { formatINR, formatDate } from "../../utils/format";
import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Tabs, Tab, TextField, InputAdornment, MenuItem, Table,
  TableHead, TableBody, TableRow, TableCell, TableContainer,
  Button, Pagination, Stack, IconButton, Tooltip,
} from "@mui/material";
import {
  SearchRounded, AddRounded, VisibilityRounded, ReceiptRounded, LocalHotelRounded, PrintRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import Mascot from "../../components/Mascot";
import StatusChip from "../../components/StatusChip";
import { TableRowsSkeleton } from "../../components/TableRowsSkeleton";
import GenerateInvoice from "../billing/GenerateInvoice";
import InvoiceViewDialog from "../../components/reception/InvoiceViewDialog";
import PageHeader from "../../components/layout/PageHeader";
import { useSearchParams } from "react-router-dom";
import { apiErrorText } from "../../utils/apiError";

const ACCENT = ACCENTS.reception;
const STATUSES = [
  { code: "", label: "All statuses" },
  { code: "PENDING", label: "Pending" },
  { code: "PARTIAL", label: "Partially paid" },
  { code: "PAID", label: "Paid" },
  { code: "REFUNDED", label: "Refunded" },
  { code: "CANCELLED", label: "Cancelled" },
];

// OPD (appointment-billed) and IPD (admission-billed) bills are structurally
// different — different origin, different columns worth showing, different
// print action — so they're kept in separate tabs/sections rather than one
// mixed list. "New Invoice" (manual charge consolidation) is an OPD-side
// concept: IPD bills are always auto-generated at discharge, never by hand.
export default function Billing() {
  const [params] = useSearchParams();
  const billPatientId = params.get("patientId") || undefined;
  const [tab, setTab] = useState(billPatientId ? 2 : 0);
  return (
    <Box>
      <PageHeader title="Billing" subtitle="Browse bills, collect payments, and generate new invoices" />

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}
          sx={{ px: 1, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 56 }, "& .Mui-selected": { color: `${ACCENT} !important` }, "& .MuiTabs-indicator": { bgcolor: ACCENT } }}>
          <Tab icon={<ReceiptRounded fontSize="small" />} iconPosition="start" label="OPD Billing" />
          <Tab icon={<LocalHotelRounded fontSize="small" />} iconPosition="start" label="IPD Billing" />
          <Tab icon={<AddRounded fontSize="small" />} iconPosition="start" label="New Invoice" />
        </Tabs>
      </Paper>

      {tab === 0 ? <BillsList type="OPD" /> : tab === 1 ? <BillsList type="IPD" /> : <GenerateInvoice patientId={billPatientId} />}
    </Box>
  );
}

function BillsList({ type }: { type: "OPD" | "IPD" }) {
  const isIpd = type === "IPD";
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [viewId, setViewId] = useState<string | null>(null);

  // Switching tabs starts each list fresh rather than carrying over filters
  // from the other bill type.
  useEffect(() => { setSearch(""); setDebounced(""); setStatus(""); setFrom(""); setTo(""); setPage(1); }, [type]);
  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1); }, 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [status, from, to]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["reception-invoices", type, debounced, status, from, to, page],
    queryFn: async () => (await axiosInstance.get("/reception/billing/invoices", {
      params: { type, ...(debounced ? { search: debounced } : {}), ...(status ? { status } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), page, limit: 20 },
    })).data,
    placeholderData: keepPreviousData,
  });

  const rows: any[] = data?.data || [];
  const meta = data?.meta;
  const columnCount = isIpd ? 9 : 8;

  return (
    <Box>
      {/* Filters */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: "wrap", gap: 1.5 }}>
        <TextField placeholder={`Search invoice #, patient, UHID…`} value={search} onChange={(e) => setSearch(e.target.value)} size="small"
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchRounded sx={{ color: "text.secondary", fontSize: 20 }} /></InputAdornment>) }} sx={{ minWidth: 280 }} />
        <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 160 }}>
          {STATUSES.map((s) => <MenuItem key={s.code} value={s.code}>{s.label}</MenuItem>)}
        </TextField>
        <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 150 }} />
        <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 150 }} />
      </Stack>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <TableContainer sx={{ maxHeight: "calc(100vh - 340px)" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {(isIpd ? ["Invoice #", "Patient", "IPD #", "Date", "Net", "Paid", "Balance Due", "Status", ""] : ["Invoice #", "Patient", "Date", "Net", "Paid", "Balance Due", "Status", ""]).map((h, i, arr) => (
                  <TableCell key={h || i} align={["Net", "Paid", "Balance Due"].includes(h) ? "right" : i === arr.length - 1 ? "right" : "left"}
                    sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", py: 2, bgcolor: "background.default" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={6} columns={columnCount} />
              ) : isError ? (
                <TableRow><TableCell colSpan={columnCount} sx={{ py: 4, border: 0 }}><ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={columnCount} sx={{ py: 4, border: 0 }}>
                  <Mascot pose="all-caught-up" title={isIpd ? "No IPD bills" : "No OPD bills"} subtitle="No invoices match your filters." />
                </TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.invoiceId} hover sx={{ cursor: "pointer" }} onClick={() => setViewId(r.invoiceId)}>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 600, color: "text.primary" }}>{r.invoiceNumber}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>{r.patientName}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{r.uhid}</Typography>
                  </TableCell>
                  {isIpd && <TableCell sx={{ fontFamily: "monospace", color: "text.secondary" }}>{r.admissionNumber || "—"}</TableCell>}
                  <TableCell sx={{ color: "text.secondary" }}>{formatDate(r.invoiceDate)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{formatINR(r.netAmount)}</TableCell>
                  <TableCell align="right" sx={{ color: "text.secondary" }}>{formatINR(r.paidAmount)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: Number(r.balance) > 0.005 ? "#ef4444" : "#10b981" }}>{formatINR(r.balance)}</TableCell>
                  <TableCell><StatusChip label={r.statusLabel} color={r.statusColor} /></TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    {isIpd && (
                      <Tooltip title="Print IP Bill">
                        <IconButton size="small" onClick={() => window.open(`/reception/billing/invoices/${r.invoiceId}/ip-bill/print`, "_blank")} sx={{ color: "text.secondary" }}>
                          <PrintRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Button size="small" startIcon={<VisibilityRounded />} onClick={() => setViewId(r.invoiceId)} sx={{ textTransform: "none", color: ACCENT }}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {meta && meta.totalPages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2, borderTop: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {meta.total} bill{meta.total === 1 ? "" : "s"}{isFetching ? " · updating…" : ""}
            </Typography>
            <Pagination count={meta.totalPages} page={page} onChange={(_, p) => setPage(p)} size="small" color="primary" />
          </Box>
        )}
      </Paper>

      {viewId && <InvoiceViewDialog open invoiceId={viewId} onClose={() => setViewId(null)} onChanged={() => refetch()} />}
    </Box>
  );
}
