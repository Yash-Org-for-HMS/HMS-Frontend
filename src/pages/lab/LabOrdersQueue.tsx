import { useState, useEffect } from "react";
import { Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow, Chip, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, Tabs, Tab } from "@mui/material";
import { VisibilityRounded, BloodtypeRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useNavigate } from "react-router-dom";
import PointOfCarePOS from "../../components/billing/PointOfCarePOS";
import { useSocket } from "../../hooks/useSocket";
import { useQuery } from "@tanstack/react-query";

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

  const navigate = useNavigate();

  // Listen for real-time queue updates
  useSocket({
    QUEUE_UPDATED: () => fetchOrders(),
    connect: () => fetchOrders(), // Refetch on socket reconnect
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "success";
      case "SAMPLE_COLLECTED": return "info";
      case "IN_PROGRESS": return "warning";
      case "PENDING": return "default";
      default: return "default";
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
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to collect sample. Please verify the barcode.");
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

  const filteredOrders = orders.filter((order: any) => {
    const today = isToday(order.createdAt);
    const completed = order.status === "COMPLETED";
    
    if (tabValue === 0) return today && !completed; // Today's Pending
    if (tabValue === 1) return !today && !completed; // Past Pending
    if (tabValue === 2) return completed; // Completed
    return true; // All
  });

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Lab Orders Queue</Typography>
      
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
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}><CircularProgress /></Box>
        ) : orders.length === 0 ? (
          <Typography sx={{ p: 2, textAlign: "center", color: "text.secondary" }}>No lab orders found.</Typography>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Barcode</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Doctor</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3, color: "text.secondary" }}>
                    No orders match the selected filter.
                  </TableCell>
                </TableRow>
              ) : filteredOrders.map((order: any) => (
                <TableRow key={order.labOrderId} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{order.sampleBarcode}</TableCell>
                  <TableCell>{order.patient?.firstName} {order.patient?.lastName}</TableCell>
                  <TableCell>{order.doctor?.user?.firstName} {order.doctor?.user?.lastName}</TableCell>
                  <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Chip label={order.status || "PENDING"} color={getStatusColor(order.status) as any} size="small" />
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
            {collecting ? <CircularProgress size={24} color="inherit" /> : "Confirm Collection"}
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
    </Box>
  );
}
