import { useMemo, useState } from "react";
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Button, Tabs, Tab, Grid,
} from "@mui/material";
import { PointOfSaleRounded, ScienceRounded, BiotechRounded, ReceiptLongRounded, PrintRounded } from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { formatINR } from "@/utils/format";
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
}

interface UnbilledInfo { amount: number; description: string }

const ACCENT = "#10B981";

function normalizeLab(o: any): BillableOrder {
  return {
    key: `LAB-${o.labOrderId}`,
    kind: "LAB",
    id: o.labOrderId,
    patientId: o.patientId,
    patientName: `${o.patient?.firstName || ""} ${o.patient?.lastName || ""}`.trim() || "—",
    uhid: o.patient?.uhidNumber,
    description: o.sampleBarcode ? `Lab Order · ${o.sampleBarcode}` : "Lab Order",
    date: o.createdAt,
    paymentStatus: o.paymentStatus || "UNPAID",
    billingLockActive: !!o.billingLockActive,
    admissionNumber: o.admissionNumber,
  };
}

function normalizeRad(o: any): BillableOrder {
  return {
    key: `RAD-${o.radiologyOrderId}`,
    kind: "RADIOLOGY",
    id: o.radiologyOrderId,
    patientId: o.patientId,
    patientName: `${o.patient?.firstName || ""} ${o.patient?.lastName || ""}`.trim() || "—",
    uhid: o.patient?.uhidNumber,
    description: `Radiology · ${o.scanType || "Scan"}`,
    date: o.orderDate,
    paymentStatus: o.paymentStatus || "UNPAID",
    billingLockActive: !!o.billingLockActive,
    admissionNumber: o.admissionNumber,
  };
}

export default function LabBilling() {
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const [payOrder, setPayOrder] = useState<BillableOrder | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const labQ = useQuery({
    queryKey: ["lab-billing", "lab-orders"],
    queryFn: async () => (await axiosInstance.get("/lab/orders")).data.data || [],
  });
  const radQ = useQuery({
    queryKey: ["lab-billing", "radiology-orders"],
    queryFn: async () => (await axiosInstance.get("/lab/radiology-orders")).data.data || [],
  });

  const orders = useMemo<BillableOrder[]>(() => {
    const lab = (labQ.data || []).map(normalizeLab);
    const rad = (radQ.data || []).map(normalizeRad);
    return [...lab, ...rad].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [labQ.data, radQ.data]);

  // Outstanding = outpatient orders with an active billing lock (unpaid, pre-paid
  // strategy). Inpatient orders settle on the IP bill, so they're never collected here.
  const outstanding = useMemo(() => orders.filter((o) => o.billingLockActive), [orders]);

  // Accurate amounts (and richer descriptions) for outstanding orders, one call
  // per distinct patient. Bounded by the number of patients with unpaid orders
  // and cached by react-query.
  const patientIds = useMemo(
    () => Array.from(new Set(outstanding.map((o) => o.patientId))).sort(),
    [outstanding],
  );
  const unbilledQ = useQuery({
    queryKey: ["lab-billing", "unbilled", patientIds],
    enabled: patientIds.length > 0,
    queryFn: async () => {
      const map: Record<string, UnbilledInfo> = {};
      await Promise.all(
        patientIds.map(async (pid) => {
          const items = (await axiosInstance.get(`/billing/unbilled/${pid}`)).data.data || [];
          for (const it of items) {
            if (it?.id) map[it.id] = { amount: Number(it.amount || 0), description: it.description || "" };
          }
        }),
      );
      return map;
    },
  });
  const unbilled = unbilledQ.data || {};

  const amountOf = (o: BillableOrder): number | null => {
    const u = unbilled[o.id];
    return u ? u.amount : null;
  };

  const outstandingTotal = useMemo(
    () => outstanding.reduce((s, o) => s + (amountOf(o) || 0), 0),
    [outstanding, unbilled], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const filtered = useMemo(() => {
    if (tabValue === 0) return orders.filter((o) => o.billingLockActive); // Outstanding
    if (tabValue === 1) return orders.filter((o) => o.paymentStatus === "PAID"); // Paid
    if (tabValue === 2) return orders.filter((o) => !!o.admissionNumber); // Inpatient (on IP bill)
    return orders; // All
  }, [orders, tabValue]);

  const { sorted, orderBy, order, onSort } = useTableSort(filtered, {
    date: (o: BillableOrder) => (o.date ? new Date(o.date) : null),
    patient: (o: BillableOrder) => o.patientName,
    service: (o: BillableOrder) => o.description,
    status: (o: BillableOrder) => o.paymentStatus,
  });

  const loading = labQ.isLoading || radQ.isLoading;
  const isError = labQ.isError || radQ.isError;

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
        <ErrorState message={apiErrorText(labQ.error || radQ.error)} onRetry={() => { labQ.refetch(); radQ.refetch(); }} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader title="Billing" subtitle="Collect payments for lab & radiology orders." />

      {/* Summary */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Outstanding Orders" value={outstanding.length} icon={<ReceiptLongRounded sx={{ fontSize: 32, color: "#f59e0b" }} />} color="#f59e0b" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Amount Due" value={formatINR(outstandingTotal)} icon={<PointOfSaleRounded sx={{ fontSize: 32, color: ACCENT }} />} color={ACCENT} />
        </Grid>
      </Grid>

      <Paper sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tabValue} onChange={(_e, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
          <Tab label={`Outstanding${outstanding.length ? ` (${outstanding.length})` : ""}`} />
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
                      <TableCell>{new Date(o.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Box sx={{ fontWeight: 600 }}>{o.patientName}</Box>
                        {o.uhid && <Box sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{o.uhid}</Box>}
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={o.kind === "LAB" ? <ScienceRounded /> : <BiotechRounded />}
                          label={o.kind === "LAB" ? "Lab" : "Radiology"}
                          size="small"
                          sx={{ mr: 1, height: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: o.kind === "LAB" ? "rgba(59,130,246,0.12)" : "rgba(245,158,11,0.12)", color: o.kind === "LAB" ? "#2563eb" : "#b45309", "& .MuiChip-icon": { fontSize: 15 } }}
                        />
                        {o.description}
                      </TableCell>
                      <TableCell align="right">{amt != null ? formatINR(amt) : "—"}</TableCell>
                      <TableCell>{statusChip(o)}</TableCell>
                      <TableCell align="right">
                        {o.billingLockActive ? (
                          <Button variant="contained" size="small" startIcon={<PointOfSaleRounded />} onClick={() => setPayOrder(o)} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: "#059669" } }}>
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
            description: unbilled[payOrder.id]?.description || payOrder.description,
            amount: amountOf(payOrder) || 0,
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
