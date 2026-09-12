import { SEMANTIC, BRAND, NEUTRAL } from "@/styles/accents";
import { usePrintWindow } from "@/utils/usePrintWindow";
import { formatINR, formatDate } from "@/utils/format";
import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Tabs, Tab, TextField, InputAdornment, MenuItem, Table,
  TableHead, TableBody, TableRow, TableCell, TableContainer,
  Button, Pagination, Stack, IconButton, Tooltip, Chip,
} from "@mui/material";
import {
  SearchRounded, AddRounded, VisibilityRounded, ReceiptRounded, LocalHotelRounded, PrintRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import StatusChip from "@/components/StatusChip";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import GenerateInvoice from "./GenerateInvoice";
import InvoiceViewDialog from "@/components/billing/InvoiceViewDialog";
import PageHeader from "@/components/layout/PageHeader";
import { useSearchParams } from "react-router-dom";
import { apiErrorText } from "@/utils/apiError";
import type { InvoiceListRow } from "@/types";

const ACCENT = BRAND.action;
const STATUSES = [
  { code: "", label: "All statuses" },
  { code: "PENDING", label: "Pending" },
  { code: "PARTIAL", label: "Partially paid" },
  { code: "PAID", label: "Paid" },
  { code: "REFUNDED", label: "Refunded" },
  { code: "CANCELLED", label: "Cancelled" },
];

/**
 * Statuses whose zero balance says nothing about payment: a cancelled bill was
 * voided and a draft was never issued, so neither owes anything and neither was
 * settled. Their balance is shown neutral rather than in the "paid" green.
 */
const NOT_A_LIVE_BILL = new Set(["CANCELLED", "DRAFT"]);

function balanceColor(r: { balance: number | string; invoiceStatus?: string }): string {
  if (NOT_A_LIVE_BILL.has(String(r.invoiceStatus ?? "").toUpperCase())) return NEUTRAL.muted;
  return Number(r.balance) > 0.005 ? SEMANTIC.danger : SEMANTIC.success;
}

// OPD (appointment-billed) and IPD (admission-billed) bills are structurally
// different — different origin, different columns worth showing, different
// print action — so they're kept in separate tabs/sections rather than one
// mixed list. "New Invoice" (manual charge consolidation) is an OPD-side
// concept: IPD bills are always auto-generated at discharge, never by hand.
// `readOnly` renders a pure oversight view (hospital-admin Operations): the
// "New Invoice" tab is dropped and the invoice viewer opens read-only (no
// Collect Payment form), so the admin can browse bills without creating charges
// or taking money. Defaults keep the reception panel fully interactive.
/**
 * One billing screen, mounted by several panels. It lives in features/billing
 * rather than under any one panel because four routes render it:
 *
 *   /reception/billing      full - list, collect, void, new invoice
 *   /hospital/billing       read-only oversight across the hospital
 *   /pharmacy/billing       read-only history, pharmacy's share
 *   /lab/billing-history    read-only history, lab's share
 *
 * So a change here is a change to all four. The panel-specific billing work -
 * a lab tech collecting on an order, a pharmacist ringing up a sale - is NOT
 * here and should not move here: see features/lab/LabBilling and
 * features/pharmacy/DispensaryPOS, which are their own pages because they are
 * their own jobs.
 *
 * `basePath` decides which mount it talks to. Reception and hospital admin read
 * `/reception/billing` and see every bill; pharmacy and lab read their own
 * mount, which the server restricts to invoices carrying their department's
 * lines. The restriction is NOT a parameter this screen sends - it belongs to
 * the route - so a panel cannot widen its own view by asking differently.
 *
 * `department` is only a label. When it is set the list shows that department's
 * SHARE of each bill as the prominent figure, because an invoice belongs to
 * more than one department and a pharmacist totalling the invoice column would
 * be totalling the hospital's revenue, not their own.
 */
export default function Billing({
  readOnly = false,
  basePath = "/reception/billing",
  department,
}: {
  readOnly?: boolean;
  basePath?: string;
  department?: string;
} = {}) {
  const [params] = useSearchParams();
  const billPatientId = params.get("patientId") || undefined;
  const [tab, setTab] = useState(billPatientId && !readOnly ? 2 : 0);
  return (
    <Box>
      <PageHeader
        title={department ? `${department} billing history` : "Billing"}
        subtitle={
          department
            ? `Bills carrying ${department.toLowerCase()} charges. Amounts shown are this department's share of each bill.`
            : readOnly ? "Browse bills across the hospital" : "Browse bills, collect payments, and generate new invoices"
        }
      />

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}
          sx={{ px: 1, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 56 }, "& .Mui-selected": { color: `${ACCENT} !important` }, "& .MuiTabs-indicator": { bgcolor: ACCENT } }}>
          <Tab icon={<ReceiptRounded fontSize="small" />} iconPosition="start" label="OPD Billing" />
          <Tab icon={<LocalHotelRounded fontSize="small" />} iconPosition="start" label="IPD Billing" />
          {!readOnly && <Tab icon={<AddRounded fontSize="small" />} iconPosition="start" label="New Invoice" />}
        </Tabs>
      </Paper>

      {tab === 0 ? <BillsList type="OPD" readOnly={readOnly} basePath={basePath} department={department} />
        : tab === 1 ? <BillsList type="IPD" readOnly={readOnly} basePath={basePath} department={department} />
          : <GenerateInvoice patientId={billPatientId} />}
    </Box>
  );
}

function BillsList({ type, readOnly = false, basePath = "/reception/billing", department }: {
  type: "OPD" | "IPD"; readOnly?: boolean; basePath?: string; department?: string;
}) {
  const openPrint = usePrintWindow();
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
    // basePath is part of the key: the same filters against a different mount
    // are a different list, and sharing a cache entry would show one panel
    // another's bills for a moment after navigating.
    queryKey: ["invoices", basePath, type, debounced, status, from, to, page],
    queryFn: async () => (await axiosInstance.get(`${basePath}/invoices`, {
      params: { type, ...(debounced ? { search: debounced } : {}), ...(status ? { status } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), page, limit: 20 },
    })).data,
    placeholderData: keepPreviousData,
  });

  const rows: InvoiceListRow[] = data?.data || [];
  const meta = data?.meta;
  // The department view trades the printable-IP-bill action for a share column;
  // reception keeps both.
  const columnCount = (isIpd ? 9 : 8) + (department ? 1 : 0);

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
                {[
                  "Invoice #", "Patient", ...(isIpd ? ["IPD #"] : []), "Date",
                  // Named for the department, so nobody reads it as the bill.
                  ...(department ? [`${department} share`] : []),
                  department ? "Bill total" : "Net", "Paid", "Balance Due", "Status", "",
                ].map((h, i, arr) => (
                  <TableCell key={h || i} align={["Net", "Bill total", "Paid", "Balance Due"].includes(h) || h.endsWith("share") ? "right" : i === arr.length - 1 ? "right" : "left"}
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
                  {department && (
                    <TableCell align="right" sx={{ fontWeight: 800, color: "text.primary" }}>
                      {formatINR(r.categoryAmount ?? 0)}
                      {/* An invoice-level discount belongs to no department, so
                          the share and the bill deliberately do not reconcile.
                          Saying so beats letting somebody find it themselves. */}
                      {Number(r.invoiceDiscount ?? 0) > 0.005 && (
                        <Tooltip title={`This bill carries a ${formatINR(r.invoiceDiscount)} discount applied to the whole invoice rather than to any one department, so the shares add up to the bill's gross, not its total.`}>
                          <Typography component="span" variant="caption" sx={{ color: SEMANTIC.warning, ml: 0.5, fontWeight: 700 }}>*</Typography>
                        </Tooltip>
                      )}
                    </TableCell>
                  )}
                  <TableCell align="right" sx={{ fontWeight: department ? 400 : 600, color: department ? "text.secondary" : "text.primary" }}>{formatINR(r.netAmount)}</TableCell>
                  <TableCell align="right" sx={{ color: "text.secondary" }}>{formatINR(r.paidAmount)}</TableCell>
                  {/* Green here means "settled by payment". A cancelled or draft
                      invoice also carries a zero balance, but because it was
                      never a live bill — painting that green read as "paid" on
                      money nobody ever collected, so it stays neutral. */}
                  <TableCell align="right" sx={{ fontWeight: 700, color: balanceColor(r) }}>{formatINR(r.balance)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                      <StatusChip label={r.statusLabel} color={r.statusColor} />
                      {/* A refund awaiting an administrator returns no money, so the
                          status stays "Paid" — correctly. That leaves the request
                          itself invisible, which is its own way of misleading the
                          desk, so it gets its own marker rather than bending the
                          status to carry two meanings. */}
                      {Number(r.refundPending) > 0.005 && (
                        <Tooltip title={`${formatINR(r.refundPending)} refund raised — no money is returned until an administrator approves it`}>
                          <Chip
                            size="small"
                            label="Refund pending"
                            sx={{
                              height: 20, fontSize: "0.66rem", fontWeight: 700,
                              bgcolor: `${SEMANTIC.warning}22`, color: SEMANTIC.warning,
                              border: `1px solid ${SEMANTIC.warning}55`,
                            }}
                          />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    {/* Printing the IP bill lives on a reception route and reads
                        reception's endpoints, so it is offered only where the
                        caller can actually reach both. A department panel gets
                        the viewer instead, which works from its own mount. */}
                    {isIpd && !department && (
                      <Tooltip title="Print IP Bill">
                        <IconButton size="small" onClick={() => openPrint(`/reception/billing/invoices/${r.invoiceId}/ip-bill/print`)} sx={{ color: "text.secondary" }}>
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

      {viewId && <InvoiceViewDialog open invoiceId={viewId} onClose={() => setViewId(null)} onChanged={() => refetch()} readOnly={readOnly} basePath={basePath} />}
    </Box>
  );
}
