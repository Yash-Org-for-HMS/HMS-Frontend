import { useState, useEffect, useMemo } from "react";
import { getApiErrorMessage } from "@/utils/apiError";
import { orderStatusColor } from "@/utils/statusColors";
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, Tabs, Tab } from "@mui/material";
import { VisibilityRounded, BloodtypeRounded, AddRounded } from "@mui/icons-material";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { axiosInstance } from "@/api/axios";
import Mascot from "@/components/Mascot";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { useNavigate } from "react-router-dom";
import PointOfCarePOS from "@/components/billing/PointOfCarePOS";
import WalkInOrderDialog from "@/components/lab/WalkInOrderDialog";
import { useSocket } from "@/hooks/useSocket";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/layout/PageHeader";
import { useTableSort } from "@/components/table/useTableSort";
import SortableHeadCell from "@/components/table/SortableHeadCell";

export default function LabOrdersQueue() {
  const { data: orders = [], isLoading: loading, refetch: fetchOrders } = useQuery({
    queryKey: ["lab-orders-queue"],
    queryFn: async () => {
      const res = await axiosInstance.get(`/lab/orders?t=${Date.now()}`);
      return res.data.data || [];
    },
    refetchInterval: 30000,
  });

  const [collectOrder, setCollectOrder] = useState<any>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPOS, setShowPOS] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [walkInOpen, setWalkInOpen] = useState(false);

  const navigate = useNavigate();

  // Listen for real-time queue updates
  useSocket({
    QUEUE_UPDATED: () => fetchOrders(),
    connect: () => fetchOrders(), // Refetch on socket reconnect
  });


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

  const isToday = (dateString: string) => {
    const today = new Date();
    const date = new Date(dateString);
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // Memoized so useTableSort's own memo (keyed on this array's identity) isn't
  // defeated by a fresh array on every render — without this, sorting silently
  // re-ran on every unrelated re-render regardless of whether orders/tabValue changed.
  const filteredOrders = useMemo(() => orders.filter((order: any) => {
    const today = isToday(order.createdAt);
    const completed = order.status === "COMPLETED";

    if (tabValue === 0) return today && !completed; // Today's Pending
    if (tabValue === 1) return !today && !completed; // Past Pending
    if (tabValue === 2) return completed; // Completed
    return true; // All
  }), [orders, tabValue]);

  const { sorted, orderBy, order, onSort } = useTableSort(filteredOrders, {
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
                <TableRow key={order.labOrderId} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{order.sampleBarcode}</TableCell>
                  <TableCell>
                    {order.patient?.firstName} {order.patient?.lastName}
                    {order.admissionNumber && (
                      <Chip label={`IPD · ${order.admissionNumber}`} size="small" sx={{ ml: 1, height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: "rgba(8,145,178,0.12)", color: "#0891b2" }} />
                    )}
                  </TableCell>
                  <TableCell>{order.doctor?.user?.firstName} {order.doctor?.user?.lastName}</TableCell>
                  <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Chip label={order.status || "PENDING"} color={orderStatusColor(order.status) as any} size="small" />
                  </TableCell>
                  <TableCell align="right">
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
            <Button color="success" variant="outlined" onClick={() => setShowPOS(true)}>Collect Payment (Cash)</Button>
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
            description: `Lab Tests: ${collectOrder.reports?.map((r: any) => r.labTest?.testName).filter(Boolean).join(', ') || 'Pending Tests'}`,
            amount: collectOrder.reports?.reduce((sum: number, r: any) => sum + Number(r.labTest?.price || 0), 0) || 300,
            date: collectOrder.createdAt
          }}
        />
      )}

      <WalkInOrderDialog kind="lab" open={walkInOpen} onClose={() => setWalkInOpen(false)} onCreated={() => fetchOrders()} />
    </Box>
  );
}
