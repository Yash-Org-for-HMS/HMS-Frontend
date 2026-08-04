import React, { useState } from "react";
import { getApiErrorMessage } from "@/utils/apiError";
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, Typography, Box, Alert,
  Divider, TextField, MenuItem, useTheme, alpha 
} from "@mui/material";
import { CheckCircleRounded, PointOfSaleRounded, ReceiptLongRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import HeartbeatLoader from "../HeartbeatLoader";

interface PointOfCarePOSProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patientId: string;
  patientName: string;
  item: {
    id: string; // the specific service ID (labOrderId, radiologyOrderId)
    type: "LAB" | "RADIOLOGY" | "PHARMACY" | "CONSULTATION";
    description: string;
    amount: number;
    taxPercent?: number; // per-line GST rate from the rate card (0 = exempt)
    taxAmount?: number;  // precomputed total tax (pharmacy: per-medicine, mixed rates)
    date: Date | string;
  };
}

export default function PointOfCarePOS({ open, onClose, onSuccess, patientId, patientName, item }: PointOfCarePOSProps) {
  const theme = useTheme();
  
  const [discount, setDiscount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  // Financial Math — GST comes from the item's rate-card taxPercent (0 = exempt), or
  // a precomputed taxAmount for a mixed-rate pharmacy order (per-medicine). Computed
  // on gross; the server re-derives it authoritatively at collection.
  const grossAmount = Number(item?.amount || 0);
  const discountAmount = Number(discount || 0);
  const taxableAmount = grossAmount - discountAmount;
  const taxAmount = item?.taxAmount != null ? Number(item.taxAmount) : grossAmount * (Number(item?.taxPercent || 0) / 100);
  const netAmount = taxableAmount + taxAmount;

  const handleProcessPayment = async () => {
    try {
      setLoading(true);
      setError("");
      
      const payload = {
        patientId: patientId === "Walk-in" ? null : patientId,
        item,
        discountAmount,
        paymentMethod
      };

      const res = await axiosInstance.post("/billing/poc-payment", payload);
      setReceiptData(res.data.data);
      setSuccess(true);
      
      // Delay closing to show success animation
      setTimeout(() => {
        setSuccess(false);
        onSuccess();
      }, 2000);
      
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Payment processing failed. Please try again."));
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    if (!loading && !success) {
      setError("");
      onClose();
    }
  };

  if (success) {
    return (
      <Dialog open={open} maxWidth="xs" fullWidth>
        <DialogContent sx={{ textAlign: "center", py: 6 }}>
          <CheckCircleRounded color="success" sx={{ fontSize: 80, mb: 2 }} />
          <Typography variant="h5" fontWeight="700" color="success.main">Payment Successful!</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            Invoice #{receiptData?.invoice?.invoiceNumber} generated.
          </Typography>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleModalClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <PointOfSaleRounded color="primary" /> 
        Point of Care Payment
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        
        <Box sx={{ mb: 3, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2 }}>
          <Typography variant="subtitle2" color="primary.main">Patient Details</Typography>
          <Typography variant="body1" fontWeight="600">{patientName}</Typography>
          <Typography variant="body2" color="text.secondary">Patient ID: {patientId}</Typography>
        </Box>

        <Typography variant="subtitle1" fontWeight="600" sx={{ mb: 2 }}>Service Billed</Typography>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="body1">{item?.description}</Typography>
          <Typography variant="body1" fontWeight="600">₹{grossAmount.toFixed(2)}</Typography>
        </Box>
        
        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
          <TextField
            label="Discount Amount (₹)"
            type="number"
            size="small"
            fullWidth
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
          />
        </Box>

        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="body2" color="text.secondary">Gross Total:</Typography>
          <Typography variant="body2">₹{grossAmount.toFixed(2)}</Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="body2" color="error.main">Discount:</Typography>
          <Typography variant="body2" color="error.main">-₹{discountAmount.toFixed(2)}</Typography>
        </Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
          <Typography variant="body2" color="text.secondary">GST (CGST + SGST):</Typography>
          <Typography variant="body2">₹{taxAmount.toFixed(2)}</Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Typography variant="h6" fontWeight="700">Net Payable:</Typography>
          <Typography variant="h6" fontWeight="700" color="primary.main">₹{netAmount.toFixed(2)}</Typography>
        </Box>

        <TextField
          select
          label="Payment Method"
          fullWidth
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        >
          <MenuItem value="Cash">Cash</MenuItem>
          <MenuItem value="Credit Card">Credit Card</MenuItem>
          <MenuItem value="UPI">UPI / Mobile App</MenuItem>
          <MenuItem value="Insurance">Insurance</MenuItem>
        </TextField>
        
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleModalClose} disabled={loading}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleProcessPayment} 
          disabled={loading || netAmount < 0}
          startIcon={loading ? <HeartbeatLoader size={22} /> : <ReceiptLongRounded />}
        >
          Confirm & Collect ₹{netAmount.toFixed(2)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
