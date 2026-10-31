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
  /**
   * Fired the moment the payment is recorded, before the success animation.
   * onSuccess runs behind a 2s delay so the receipt can be read, and callers
   * were refreshing their data there - so a till showed a just-paid sale as
   * unpaid for as long as the animation lasted.
   */
  onPaid?: () => void;
  patientId: string;
  patientName: string;
  /** Shown to identify the patient - never the internal patient id. */
  uhid?: string | null;
  item: {
    id: string; // the specific service ID (labOrderId, radiologyOrderId)
    type: "LAB" | "RADIOLOGY" | "PHARMACY" | "CONSULTATION";
    description: string;
    amount: number;
    taxPercent?: number; // per-line GST rate from the rate card (0 = exempt)
    taxAmount?: number;  // precomputed total tax (pharmacy: per-medicine, mixed rates)
    date: Date | string;
    /** Lab/radiology tests priced at billing: typed here before collecting (price null = not typed yet). */
    typedPrices?: TypedPrice[] | null;
  };
}

export type TypedPrice = { chargeItemId: string; itemName: string; price: number | null };

export default function PointOfCarePOS({ open, onClose, onSuccess, onPaid, patientId, patientName, uhid, item }: PointOfCarePOSProps) {
  const theme = useTheme();
  
  const [discount, setDiscount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  // Price at billing: what the counter types per test (blank = keep the saved price).
  const [typed, setTyped] = useState<Record<string, string>>({});
  const openTests = item?.typedPrices ?? [];
  const typedValue = (t: TypedPrice) => typed[t.chargeItemId] ?? (t.price != null ? String(t.price) : "");
  const missingPrice = openTests.some((t) => !(Number(typedValue(t)) > 0));

  // Financial Math - GST comes from the item's rate-card taxPercent (0 = exempt), or
  // a precomputed taxAmount for a mixed-rate pharmacy order (per-medicine). Charged
  // after discount, in proportion; the server re-derives it authoritatively at collection.
  // The server's amount already holds any price typed before; swap that part for what is typed now.
  const grossAmount = Number(item?.amount || 0)
    - openTests.reduce((s, t) => s + Number(t.price ?? 0), 0)
    + openTests.reduce((s, t) => s + (Number(typedValue(t)) || 0), 0);
  const discountAmount = Number(discount || 0);
  const discountTooHigh = discountAmount < 0 || discountAmount > grossAmount;
  const taxableAmount = grossAmount - discountAmount;
  const grossTax = item?.taxAmount != null ? Number(item.taxAmount) : grossAmount * (Number(item?.taxPercent || 0) / 100);
  const taxAmount = grossAmount > 0 && !discountTooHigh ? grossTax * (taxableAmount / grossAmount) : grossTax;
  // Never shown below zero: a discount over the bill is refused, not netted off.
  const netAmount = Math.max(0, taxableAmount + taxAmount);

  const handleProcessPayment = async () => {
    try {
      setLoading(true);
      setError("");

      // Price at billing: save the typed prices first; the payment then bills at them.
      if (openTests.length && (openTests.some((t) => t.price == null) || Object.keys(typed).length)) {
        await axiosInstance.post("/billing/order-prices", {
          kind: item.type, id: item.id,
          prices: openTests.map((t) => ({ chargeItemId: t.chargeItemId, price: Number(typedValue(t)) })),
        });
      }

      const payload = {
        patientId: patientId === "Walk-in" ? null : patientId,
        item,
        discountAmount,
        paymentMethod
      };

      const res = await axiosInstance.post("/billing/poc-payment", payload);
      setReceiptData(res.data.data);
      setSuccess(true);
      onPaid?.();
      
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
          {uhid && <Typography variant="body2" color="text.secondary">UHID: {uhid}</Typography>}
        </Box>

        <Typography variant="subtitle1" fontWeight="600" sx={{ mb: 2 }}>Service Billed</Typography>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="body1">{item?.description}</Typography>
          <Typography variant="body1" fontWeight="600">₹{grossAmount.toFixed(2)}</Typography>
        </Box>
        
        {openTests.length > 0 && (
          <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.warning.main, 0.08) }}>
            <Typography variant="subtitle2" color="warning.dark" sx={{ mb: 1.5 }}>Priced at billing - type the price</Typography>
            {openTests.map((t) => (
              <TextField key={t.chargeItemId} label={`${t.itemName} (₹)`} type="number" size="small" fullWidth sx={{ mb: 1.5 }}
                value={typedValue(t)} onChange={(e) => setTyped((p) => ({ ...p, [t.chargeItemId]: e.target.value }))}
                error={!(Number(typedValue(t)) > 0)} inputProps={{ min: 0.01, step: "0.01" }} />
            ))}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
          <TextField
            label="Discount Amount (₹)"
            type="number"
            size="small"
            fullWidth
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            error={discountTooHigh}
            helperText={discountTooHigh ? "Discount cannot exceed the bill total" : undefined}
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
          disabled={loading || netAmount < 0 || discountTooHigh || missingPrice}
          startIcon={loading ? <HeartbeatLoader size={22} /> : <ReceiptLongRounded />}
        >
          Confirm & Collect ₹{netAmount.toFixed(2)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
