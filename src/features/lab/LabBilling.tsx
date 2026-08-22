import { useEffect, useMemo, useState } from "react";
import { SEMANTIC } from "@/styles/accents";
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Button, Tabs, Tab, Grid, Pagination,
} from "@mui/material";
import { PointOfSaleRounded, ScienceRounded, BiotechRounded, ReceiptLongRounded, PrintRounded } from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { formatINR, formatDate } from "@/utils/format";
import { paymentStatusColor } from "@/utils/statusColors";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/StatCard";
import Mascot from "@/components/Mascot";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import ErrorState from "@/components/ErrorState";
import { apiErrorText } from "@/utils/apiError";
import PointOfCarePOS from "@/components/billing/PointOfCarePOS";
import LabReceiptDialog from "@/components/billing/LabReceiptDialog";
import { useTableSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";

// Order-centric billing view for the Lab & Radiology panel.
//
// A lab technician is NOT authorised for the reception invoice endpoints, so we
// can't reuse the reception Billing page here. Instead we list the lab &
// radiology ORDERS this panel already owns, surface their payment status, and
// let staff collect outstanding payments via the shared POS (the one endpoint —
// /billing/poc-payment — a LAB_TECH is authorised to call). Accurate amounts for
// outstanding orders come from /billing/unbilled/:patientId, the only
// lab-authorised price source; that same amount feeds the POS gross.

type Kind = "LAB" | "RADIOLOGY";

interface BillableOrder {
  key: string;
  kind: Kind;
  id: string; // labOrderId | radiologyOrderId
  patientId: string;
  patientName: string;
  uhid?: string;
  description: string;
  date: string;
  paymentStatus: string; // PaymentState: UNPAID | PAID | PARTIAL | REFUNDED | BILLED
  billingLockActive: boolean;
  admissionNumber?: string | null;
  // Resolved server-side from the same unbilled-items computation the invoice
  // uses, so this screen can never quote a different figure from the bill.
  amount: number | null;
  billingDescription: string | null;
  taxPercent: number;
}

const ACCENT = SEMANTIC.success;

// The queue endpoint already returns both kinds in one shape, priced and
// labelled — the two normalisers this replaces were doing that per source table
// in the browser.
function normalizeRow(o: any): BillableOrder {
  return {
    key: `${o.kind}-${o.id}`,
    kind: o.kind,
    id: o.id,
    patientId: o.patientId,
    patientName: o.patientName || "—",
    uhid: o.uhid ?? undefined,
    description: o.description,
    date: o.date,
    paymentStatus: o.paymentStatus || "UNPAID",
    billingLockActive: !!o.billingLockActive,
    admissionNumber: o.admissionNumber,
    amount: o.amount ?? null,
    billingDescription: o.billingDescription ?? null,
    taxPercent: Number(o.taxPercent || 0),
  };
}

export default function LabBilling() {
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const [payOrder, setPayOrder] = useState<BillableOrder | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  // One page of the selected tab, filtered/sorted/priced server-side.
  //
  // This screen used to GET every lab order and every radiology order the
  // hospital had ever recorded and do all four tabs in the browser — roughly
  // 1.7 KB per order, so ~48 MB per page load after a year at 80 orders a day.
  // It also made one /billing/unbilled call per patient to price them. The
  // server now returns 20 rows with their amounts already resolved.
  const BUCKETS = ["outstanding", "paid", "inpatient", "all"] as const;
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [tabValue]); // switching tabs starts at page 1

  const queueQ = useQuery({
    queryKey: ["lab-billing", "queue", tabValue, page],
    queryFn: async () =>
      (await axiosInstance.get("/lab/billing-queue", { params: { bucket: BUCKETS[tabValue], page, limit: 20 } })).data.data,
  });

  const orders = useMemo<BillableOrder[]>(() => (queueQ.data?.rows || []).map(normalizeRow), [queueQ.data]);
  const totalPages = queueQ.data?.pagination?.totalPages ?? 1;

  // The summary covers EVERY outstanding order, not this page — a headline
  // "Amount Due" that silently counted only the first 20 rows would be worse
  // than showing none. It is safe to compute in full because the outstanding
  // set is bounded by unpaid work rather than by history.
  const outstandingCount = queueQ.data?.summary?.outstandingCount ?? 0;
  const outstandingTotal = queueQ.data?.summary?.outstandingAmount ?? 0;

  const amountOf = (o: BillableOrder): number | null => o.amount ?? null;

  const { sorted, orderBy, order, onSort } = useTableSort(orders, {
    date: (o: BillableOrder) => (o.date ? new Date(o.date) : null),
    patient: (o: BillableOrder) => o.patientName,
    service: (o: BillableOrder) => o.description,
    status: (o: BillableOrder) => o.paymentStatus,
  });

  const loading = queueQ.isLoading;
  const isError = queueQ.isError;

  const headSx = { fontWeight: 500, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 1, color: "text.primary" } as const;

  const statusChip = (o: BillableOrder) => {
    if (o.admissionNumber) return <Chip label="On IP Bill" color="info" size="small" />;
    const label = o.paymentStatus === "UNPAID" ? "Unpaid" : o.paymentStatus.charAt(0) + o.paymentStatus.slice(1).toLowerCase();
    return <Chip label={label} color={paymentStatusColor(o.paymentStatus) as any} size="small" />;
  };

  if (isError) {
    return (
      <Box>
        <PageHeader title="Billing" subtitle="Collect payments for lab & radiology orders." />
        <ErrorState message={apiErrorText(queueQ.error)} onRetry={() => queueQ.refetch()} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader title="Billing" subtitle="Collect payments for lab & radiology orders." />

      {/* Summary */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Outstanding Orders" value={outstandingCount} icon={<ReceiptLongRounded sx={{ color: SEMANTIC.warning }} />} color={SEMANTIC.warning} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Amount Due" value={formatINR(outstandingTotal)} icon={<PointOfSaleRounded sx={{ color: ACCENT }} />} color={ACCENT} />
        </Grid>
      </Grid>

      <Paper sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tabValue} onChange={(_e, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
          <Tab label={`Outstanding${outstandingCount ? ` (${outstandingCount})` : ""}`} />
          <Tab label="Paid" />
          <Tab label="Inpatient" />
          <Tab label="All Orders" />
        </Tabs>
      </Paper>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        {loading ? (
          <ListSkeleton rows={6} />
        ) : orders.length === 0 ? (
          <Mascot pose="all-caught-up" title="Nothing to bill" subtitle="No lab or radiology orders found." />
        ) : (
          <TableContainer sx={{ maxHeight: "calc(100vh - 360px)" }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <SortableHeadCell label="Date" sortKey="date" orderBy={orderBy} order={order} onSort={onSort} sx={headSx} />
                  <SortableHeadCell label="Patient" sortKey="patient" orderBy={orderBy} order={order} onSort={onSort} sx={headSx} />
                  <SortableHeadCell label="Service" sortKey="service" orderBy={orderBy} order={order} onSort={onSort} sx={headSx} />
                  <TableCell align="right" sx={headSx}>Amount</TableCell>
                  <SortableHeadCell label="Status" sortKey="status" orderBy={orderBy} order={order} onSort={onSort} sx={headSx} />
                  <TableCell align="right" sx={headSx}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 3, border: 0 }}>
                      <Mascot pose="no-matches" subtitle="No orders match this filter." size={110} />
                    </TableCell>
                  </TableRow>
                ) : sorted.map((o: BillableOrder) => {
                  const amt = amountOf(o);
                  return (
                    <TableRow key={o.key} hover>
                      <TableCell>{formatDate(o.date)}</TableCell>
                      <TableCell>
                        <Box sx={{ fontWeight: 600 }}>{o.patientName}</Box>
                        {o.uhid && <Box sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{o.uhid}</Box>}
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={o.kind === "LAB" ? <ScienceRounded /> : <BiotechRounded />}
                          label={o.kind === "LAB" ? "Lab" : "Radiology"}
                          size="small"
                          sx={{ mr: 1, height: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: o.kind === "LAB" ? "rgba(59,130,246,0.12)" : "rgba(245,158,11,0.12)", color: o.kind === "LAB" ? SEMANTIC.infoDark : "#b45309", "& .MuiChip-icon": { fontSize: 15 } }}
                        />
                        {o.description}
                      </TableCell>
                      <TableCell align="right">{amt != null ? formatINR(amt) : "—"}</TableCell>
                      <TableCell>{statusChip(o)}</TableCell>
                      <TableCell align="right">
                        {o.billingLockActive ? (
                          <Button variant="contained" size="small" startIcon={<PointOfSaleRounded />} onClick={() => setPayOrder(o)} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: SEMANTIC.successDark } }}>
                            Collect Payment
                          </Button>
                        ) : o.paymentStatus === "PAID" ? (
                          <Button variant="outlined" size="small" color="success" startIcon={<PrintRounded />} onClick={() => setReceiptId(o.id)}>
                            Receipt
                          </Button>
                        ) : (
                          <Box sx={{ color: "text.disabled", fontSize: "0.8rem" }}>—</Box>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Only the current page is loaded, so the pages have to be walkable.
            Matches the control the lab order queue already uses. */}
        {totalPages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "center", pt: 2 }}>
            <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" shape="rounded" />
          </Box>
        )}
      </Paper>

      {payOrder && (
        <PointOfCarePOS
          open={!!payOrder}
          onClose={() => setPayOrder(null)}
          onSuccess={() => {
            setPayOrder(null);
            queryClient.invalidateQueries({ queryKey: ["lab-billing"] });
          }}
          patientId={payOrder.patientId}
          patientName={payOrder.patientName}
          item={{
            id: payOrder.id,
            type: payOrder.kind,
            description: payOrder.billingDescription || payOrder.description,
            amount: amountOf(payOrder) || 0,
            taxPercent: payOrder.taxPercent,
            date: payOrder.date,
          }}
        />
      )}

      {receiptId && (
        <LabReceiptDialog open={!!receiptId} serviceId={receiptId} onClose={() => setReceiptId(null)} />
      )}
    </Box>
  );
}
