import { useState, useEffect } from "react";
import { Box, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow, Chip, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert } from "@mui/material";
import { VisibilityRounded, BloodtypeRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import { useNavigate } from "react-router-dom";

export default function LabOrdersQueue() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [collectOrder, setCollectOrder] = useState<any>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/lab/orders");
      setOrders(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch lab orders", err);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Lab Orders Queue</Typography>
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
              {orders.map((order) => (
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
          {collectOrder?.paymentStatus !== "PAID" && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Billing Lock Active: The invoice for this order has not been paid. You cannot collect the sample until payment is received at reception.
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
            disabled={collecting || collectOrder?.paymentStatus !== "PAID"}
            placeholder="e.g. BARCODE123"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          {collectOrder?.paymentStatus !== "PAID" && (
            <Button color="success" variant="outlined" onClick={async () => {
              await axiosInstance.put(`/lab/orders/${collectOrder.labOrderId}/toggle-payment`);
              fetchOrders();
              setCollectOrder({...collectOrder, paymentStatus: 'PAID'});
            }}>Mock Payment</Button>
          )}
          <Button onClick={() => setCollectOrder(null)} color="inherit" disabled={collecting}>Cancel</Button>
          <Button onClick={handleConfirmCollect} variant="contained" disabled={collecting || collectOrder?.paymentStatus !== "PAID"}>
            {collecting ? <CircularProgress size={24} color="inherit" /> : "Confirm Collection"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
