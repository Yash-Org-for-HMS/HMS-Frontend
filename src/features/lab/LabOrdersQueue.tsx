import { useState, useEffect } from "react";
import { formatDate } from "@/utils/format";
import { BRAND } from "@/styles/accents";
import { getApiErrorMessage } from "@/utils/apiError";
import { orderStatusColor } from "@/utils/statusColors";
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, Tabs, Tab, Pagination } from "@mui/material";
import { VisibilityRounded, BloodtypeRounded, AddRounded, CancelRounded, VerifiedRounded } from "@mui/icons-material";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { axiosInstance } from "@/api/axios";
import Mascot from "@/components/Mascot";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { useNavigate } from "react-router-dom";
import PointOfCarePOS from "@/components/billing/PointOfCarePOS";
import WalkInOrderDialog from "@/components/lab/WalkInOrderDialog";
import { useSocket } from "@/hooks/useSocket";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import PageHeader from "@/components/layout/PageHeader";
import { isUrgent, priorityMeta, urgentRowSx } from "./orderPriority";
import { useTableSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";
import { QUEUE_POLL_MS } from "@/constants/intervals";

// Tab index → server bucket (matches the queue's Today / Past / Completed / All tabs).
const BUCKETS = ["today_pending", "past_pending", "completed", "all"];

export default function LabOrdersQueue() {
  const [tabValue, setTabValue] = useState(0);
  const [page, setPage] = useState(1);

  // Switching tabs resets to the first page.
  useEffect(() => { setPage(1); }, [tabValue]);

  const { data, isLoading: loading, refetch: fetchOrders } = useQuery({
    queryKey: ["lab-orders-queue", tabValue, page],
    queryFn: async () => {
      const res = await axiosInstance.get(`/lab/orders`, { params: { bucket: BUCKETS[tabValue], page, limit: 20, t: Date.now() } });
      return res.data;
    },
    refetchInterval: QUEUE_POLL_MS,
    placeholderData: keepPreviousData,
  });
  const orders: any[] = data?.data ?? [];
  const totalPages: number = data?.pagination?.totalPages ?? 1;

  const [collectOrder, setCollectOrder] = useState<any>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPOS, setShowPOS] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);

  const navigate = useNavigate();

  // Real payable amount for this order (server-priced). The list endpoint omits
  // per-test prices, so /billing/unbilled is the correct source for the POS.
  const { data: unbilledItems = [] } = useQuery({
    queryKey: ["unbilled", collectOrder?.patientId],
    enabled: !!collectOrder?.patientId,
    queryFn: async () => (await axiosInstance.get(`/billing/unbilled/${collectOrder!.patientId}`)).data.data || [],
  });
  const posItem = unbilledItems.find((it: any) => it.id === collectOrder?.labOrderId);

  // Listen for real-time queue updates
  useSocket({
    QUEUE_UPDATED: () => fetchOrders(),
    connect: () => fetchOrders(), // Refetch on socket reconnect
  });


  const toast = useToast();

  const handleCancel = async (order: any) => {
    if (!window.confirm(`Cancel this lab order for ${order.patient?.firstName || "this patient"}? It will no longer be billable.`)) return;
    try {
      await axiosInstance.post(`/lab/orders/${order.labOrderId}/cancel`);
      toast.success("Lab order cancelled");
      fetchOrders();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Could not cancel this order"));
    }
  };

  const handleCollectClick = (order: any) => {
    setCollectOrder(order);
    setBarcodeInput("");
    setErrorMsg("");
  };

  const handleConfirmCollect = async () => {
    if (!barcodeInput) {
      setErrorMsg("Please enter or scan the barcode.");
      return;
    }
    
    try {
      setCollecting(true);
      setErrorMsg("");
      await axiosInstance.put(`/lab/orders/${collectOrder.labOrderId}/collect`, {
        barcode: barcodeInput
      });
      setCollectOrder(null);
      fetchOrders();
    } catch (err: unknown) {
      setErrorMsg(getApiErrorMessage(err, "Failed to collect sample. Please verify the barcode."));
    } finally {
      setCollecting(false);
    }
  };

  // Bucketing (today/past × completion) is now done server-side per the active
  // tab; `orders` is already the current page of the selected bucket. The table
  // still sorts the current page client-side.
  const { sorted, orderBy, order, onSort } = useTableSort(orders, {
    barcode: (o: any) => o.sampleBarcode,
    patient: (o: any) => `${o.patient?.firstName ?? ""} ${o.patient?.lastName ?? ""}`.trim(),
    doctor: (o: any) => `${o.doctor?.user?.firstName ?? ""} ${o.doctor?.user?.lastName ?? ""}`.trim(),
    date: (o: any) => (o.createdAt ? new Date(o.createdAt) : null),
    status: (o: any) => o.status ?? "PENDING",
  });

  return (
    <Box>
      <PageHeader
        title="Lab Orders Queue"
        actions={
          <Button variant="contained" startIcon={<AddRounded />} onClick={() => setWalkInOpen(true)}>
            New Walk-in Order
          </Button>
        }
      />

      <Paper sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} variant="scrollable" scrollButtons="auto">
          <Tab label="Today's Queue" />
          <Tab label="Past Pending" />
          <Tab label="Completed" />
          <Tab label="All Orders" />
        </Tabs>
      </Paper>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        {loading ? (
          <ListSkeleton rows={6} />
        ) : orders.length === 0 ? (
          <Mascot pose="all-caught-up" title="No lab orders" subtitle="No lab orders found." />
        ) : (
          <TableContainer sx={{ maxHeight: "calc(100vh - 300px)" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <SortableHeadCell label="Barcode" sortKey="barcode" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 500, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 1, color: "text.primary" }} />
                <SortableHeadCell label="Patient" sortKey="patient" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 500, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 1, color: "text.primary" }} />
                <SortableHeadCell label="Doctor" sortKey="doctor" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 500, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 1, color: "text.primary" }} />
                <SortableHeadCell label="Date" sortKey="date" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 500, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 1, color: "text.primary" }} />
                <SortableHeadCell label="Status" sortKey="status" orderBy={orderBy} order={order} onSort={onSort} sx={{ fontWeight: 500, fontSize: "0.875rem", textTransform: "none", letterSpacing: "normal", py: 1, color: "text.primary" }} />
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 3, border: 0 }}>
                    <Mascot pose="no-matches" subtitle="No orders match the selected filter." size={110} />
                  </TableCell>
                </TableRow>
              ) : sorted.map((order: any) => (
                <TableRow key={order.labOrderId} hover sx={urgentRowSx(order.priorityId)}>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {order.sampleBarcode}
                    {/* The colour is never the only signal — a red edge alone is
                        invisible to anyone who cannot separate it from the row. */}
                    {isUrgent(order.priorityId) && (
                      <Chip
                        label={priorityMeta(order.priorityId)?.label}
                        size="small"
                        sx={{
                          ml: 1, height: 20, fontSize: "0.7rem", fontWeight: 800,
                          bgcolor: priorityMeta(order.priorityId)!.color!,
                          color: "#fff",
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {order.patient?.firstName} {order.patient?.lastName}
                    {order.admissionNumber && (
                      <Chip label={`IPD · ${order.admissionNumber}`} size="small" sx={{ ml: 1, height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: "rgba(8,145,178,0.12)", color: BRAND.actionDark }} />
                    )}
                  </TableCell>
                  <TableCell>{order.doctor?.user?.firstName} {order.doctor?.user?.lastName}</TableCell>
                  <TableCell>{formatDate(order.createdAt)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                      <Chip label={order.status || "PENDING"} color={orderStatusColor(order.status) as any} size="small" />
                      {order.status === "COMPLETED" && (
                        order.verified ? (
                          <Chip icon={<VerifiedRounded sx={{ fontSize: "14px !important" }} />} label="Verified" size="small" color="success" variant="outlined" sx={{ height: 22, fontWeight: 700 }} />
                        ) : (
                          <Chip label="To verify" size="small" color="warning" variant="outlined" sx={{ height: 22, fontWeight: 700 }} />
                        )
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    {order.status === "PENDING" && !order.admissionId && order.paymentStatus !== "PAID" && order.paymentStatus !== "BILLED" && (
                      <Button
                        variant="text"
                        size="small"
                        color="error"
                        startIcon={<CancelRounded />}
                        onClick={() => handleCancel(order)}
                        sx={{ mr: 1 }}
                      >
                        Cancel
                      </Button>
                    )}
                    {order.status === "PENDING" ? (
                      <Button
                        variant="contained"
                        size="small"
                        color="primary"
                        startIcon={<BloodtypeRounded />}
                        onClick={() => handleCollectClick(order)}
                      >
                        Collect Sample
                      </Button>
                    ) : order.status === "COMPLETED" && !order.verified ? (
                      // Results in, but nobody has signed off — make verification the
                      // obvious next action instead of a plain "View".
                      <Button
                        variant="contained"
                        size="small"
                        color="success"
                        startIcon={<VerifiedRounded />}
                        onClick={() => navigate(`/lab/orders/${order.labOrderId}`)}
                      >
                        Verify
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<VisibilityRounded />}
                        onClick={() => navigate(`/lab/orders/${order.labOrderId}`)}
                      >
                        {order.status === "COMPLETED" ? "View" : "Enter Results"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        )}
      </Paper>

      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" shape="rounded" />
        </Box>
      )}

      {/* Collect Sample Dialog */}
      <Dialog open={!!collectOrder} onClose={() => setCollectOrder(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Sample Collection</DialogTitle>
        <DialogContent dividers>
          {collectOrder?.billingLockActive && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Billing Lock Active: The invoice for this order has not been paid. You cannot collect the sample until payment is received.
            </Alert>
          )}
          {collectOrder?.admissionNumber && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Inpatient order ({collectOrder.admissionNumber}) — covered on the IP bill, settled at discharge. No pre-payment needed.
            </Alert>
          )}
          {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}
          <Typography variant="body1" sx={{ mb: 2 }}>
            Please scan or enter the barcode for the sample collected from <strong>{collectOrder?.patient?.firstName} {collectOrder?.patient?.lastName}</strong>.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Sample Barcode"
            variant="outlined"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            disabled={collecting || collectOrder?.billingLockActive}
            placeholder="e.g. BARCODE123"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          {collectOrder?.billingLockActive && (
            <Button color="success" variant="outlined" onClick={() => setShowPOS(true)}>Collect Payment</Button>
          )}
          <Button onClick={() => setCollectOrder(null)} color="inherit" disabled={collecting}>Cancel</Button>
          <Button onClick={handleConfirmCollect} variant="contained" disabled={collecting || collectOrder?.billingLockActive}>
            {collecting ? <HeartbeatLoader size={22} /> : "Confirm Collection"}
          </Button>
        </DialogActions>
      </Dialog>

      {showPOS && collectOrder && (
        <PointOfCarePOS
          open={showPOS}
          onClose={() => setShowPOS(false)}
          onSuccess={() => {
            setShowPOS(false);
            fetchOrders();
            setCollectOrder({...collectOrder, paymentStatus: 'PAID', billingLockActive: false});
          }}
          patientId={collectOrder.patientId}
          patientName={`${collectOrder.patient?.firstName || ''} ${collectOrder.patient?.lastName || ''}`}
          item={{
            id: collectOrder.labOrderId,
            type: "LAB",
            description: posItem?.description || `Lab Tests: ${collectOrder.reports?.map((r: any) => r.labTest?.testName).filter(Boolean).join(', ') || 'Pending Tests'}`,
            amount: Number(posItem?.amount ?? 0),
            taxPercent: Number(posItem?.taxPercent ?? 0),
            date: collectOrder.createdAt
          }}
        />
      )}

      <WalkInOrderDialog kind="lab" open={walkInOpen} onClose={() => setWalkInOpen(false)} onCreated={() => fetchOrders()} />
    </Box>
  );
}
