import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Tabs, Tab, TextField, InputAdornment, MenuItem, Table,
  TableHead, TableBody, TableRow, TableCell, TableContainer, Chip, CircularProgress,
  Button, Pagination, Stack,
} from "@mui/material";
import {
  SearchRounded, AddRounded, VisibilityRounded, ReceiptRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import Mascot from "../../components/Mascot";
import GenerateInvoice from "../billing/GenerateInvoice";
import InvoiceViewDialog from "../../components/reception/InvoiceViewDialog";

const ACCENT = "#0891b2";
const inr = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const STATUSES = [
  { code: "", label: "All statuses" },
  { code: "PENDING", label: "Pending" },
  { code: "PARTIAL", label: "Partially paid" },
  { code: "PAID", label: "Paid" },
  { code: "REFUNDED", label: "Refunded" },
  { code: "CANCELLED", label: "Cancelled" },
];

export default function Billing() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 800, mb: 0.5 }}>Billing</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>Browse bills, collect payments, and generate new invoices</Typography>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}
          sx={{ px: 1, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 56 }, "& .Mui-selected": { color: `${ACCENT} !important` }, "& .MuiTabs-indicator": { bgcolor: ACCENT } }}>
          <Tab icon={<ReceiptRounded fontSize="small" />} iconPosition="start" label="Bills" />
          <Tab icon={<AddRounded fontSize="small" />} iconPosition="start" label="New Invoice" />
        </Tabs>
      </Paper>

      {tab === 0 ? <BillsList /> : <GenerateInvoice />}
    </Box>
  );
}

function BillsList() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [viewId, setViewId] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1); }, 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [status, from, to]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["reception-invoices", debounced, status, from, to, page],
    queryFn: async () => (await axiosInstance.get("/reception/billing/invoices", {
      params: { ...(debounced ? { search: debounced } : {}), ...(status ? { status } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), page, limit: 20 },
    })).data,
    placeholderData: keepPreviousData,
  });

  const rows: any[] = data?.data || [];
  const meta = data?.meta;

  return (
    <Box>
      {/* Filters */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: "wrap", gap: 1.5 }}>
        <TextField placeholder="Search invoice #, patient, UHID…" value={search} onChange={(e) => setSearch(e.target.value)} size="small"
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
                {["Invoice #", "Patient", "Date", "Net", "Paid", "Balance", "Status", ""].map((h, i) => (
                  <TableCell key={h || i} align={["Net", "Paid", "Balance"].includes(h) ? "right" : i === 7 ? "right" : "left"}
                    sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", py: 2, bgcolor: "background.default" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><CircularProgress size={28} sx={{ color: ACCENT }} /></TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={8} sx={{ py: 4, border: 0 }}><ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} /></TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} sx={{ py: 4, border: 0 }}><Mascot pose="all-caught-up" title="No bills" subtitle="No invoices match your filters." /></TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.invoiceId} hover sx={{ cursor: "pointer" }} onClick={() => setViewId(r.invoiceId)}>
                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 600, color: "text.primary" }}>{r.invoiceNumber}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>{r.patientName}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{r.uhid}</Typography>
                  </TableCell>
                  <TableCell sx={{ color: "text.secondary" }}>{new Date(r.invoiceDate).toLocaleDateString("en-IN")}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{inr(r.netAmount)}</TableCell>
                  <TableCell align="right" sx={{ color: "text.secondary" }}>{inr(r.paidAmount)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: Number(r.balance) > 0.005 ? "#ef4444" : "#10b981" }}>{inr(r.balance)}</TableCell>
                  <TableCell><Chip label={r.statusLabel} size="small" sx={{ bgcolor: `${r.statusColor}22`, color: r.statusColor, fontWeight: 700 }} /></TableCell>
                  <TableCell align="right"><Button size="small" startIcon={<VisibilityRounded />} onClick={(e) => { e.stopPropagation(); setViewId(r.invoiceId); }} sx={{ textTransform: "none", color: ACCENT }}>View</Button></TableCell>
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
