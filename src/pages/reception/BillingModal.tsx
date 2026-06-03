import { useState, useEffect, useRef } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Divider, CircularProgress, Alert,
  Grid, TextField, MenuItem, Paper, Chip
} from "@mui/material";
import {
  ReceiptRounded, CheckCircleRounded, PrintRounded, PaymentRounded, CloseRounded
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

interface BillingModalProps {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  patientName: string;
  appointmentDate: string;
}

export default function BillingModal({ open, onClose, appointmentId, patientName, appointmentDate }: BillingModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<any>(null);
  
  // Lookups
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  
  // Payment Form
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [paying, setPaying] = useState(false);

  // For printing
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && appointmentId) {
      fetchBillingData();
    } else {
      // Reset state on close
      setInvoice(null);
      setError(null);
      setPaymentAmount("");
      setPaymentMethodId("");
      setTransactionRef("");
    }
  }, [open, appointmentId]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 1. Fetch lookups
      const lookupsRes = await axiosInstance.get("/reception/billing/lookups");
      if (lookupsRes.data.success) {
        setPaymentMethods(lookupsRes.data.data.methods);
      }

      // 2. Fetch or Generate Invoice
      let currentInvoice = null;
      const getInvoiceRes = await axiosInstance.get(`/reception/billing/appointments/${appointmentId}/invoice`);
      
      if (getInvoiceRes.data.success && getInvoiceRes.data.data) {
        currentInvoice = getInvoiceRes.data.data;
      } else {
        // Generate new if none exists
        const generateRes = await axiosInstance.post(`/reception/billing/appointments/${appointmentId}/generate-invoice`);
        if (generateRes.data.success) {
          currentInvoice = generateRes.data.data;
        }
      }
      
      setInvoice(currentInvoice);
      
      // Pre-fill payment amount with remaining balance
      if (currentInvoice) {
        const totalPaid = currentInvoice.Payment?.reduce((sum: number, p: any) => sum + Number(p.paidAmount), 0) || 0;
        const remaining = Number(currentInvoice.netAmount) - totalPaid;
        if (remaining > 0) {
          setPaymentAmount(remaining.toString());
        }
      }

    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!invoice || !paymentAmount || !paymentMethodId) return;
    
    try {
      setPaying(true);
      setError(null);
      
      const res = await axiosInstance.post(`/reception/billing/invoices/${invoice.invoiceId}/payment`, {
        amount: parseFloat(paymentAmount),
        paymentMethodId,
        transactionReference: transactionRef
      });
      
      if (res.data.success) {
        // Refresh invoice data
        const getInvoiceRes = await axiosInstance.get(`/reception/billing/appointments/${appointmentId}/invoice`);
        if (getInvoiceRes.data.success) {
          setInvoice(getInvoiceRes.data.data);
          
          const updatedInvoice = getInvoiceRes.data.data;
          const totalPaid = updatedInvoice.Payment?.reduce((sum: number, p: any) => sum + Number(p.paidAmount), 0) || 0;
          const remaining = Number(updatedInvoice.netAmount) - totalPaid;
          if (remaining > 0) {
             setPaymentAmount(remaining.toString());
          } else {
             setPaymentAmount("");
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const handlePrint = () => {
    if (receiptRef.current) {
      const printContents = receiptRef.current.innerHTML;
      const originalContents = document.body.innerHTML;
      
      // Basic print styling
      const printStyle = `
        <style>
          @media print {
            body { font-family: Arial, sans-serif; padding: 20px; color: #000; background: #fff; }
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .text-right { text-align: right; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          }
        </style>
      `;

      document.body.innerHTML = printStyle + printContents;
      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload(); // Reload to restore React state cleanly after DOM manipulation
    }
  };

  if (!open) return null;

  const totalPaid = invoice?.Payment?.reduce((sum: number, p: any) => sum + Number(p.paidAmount), 0) || 0;
  const netAmount = Number(invoice?.netAmount || 0);
  const balance = netAmount - totalPaid;
  const isFullyPaid = invoice?.paymentStatus?.statusCode === "PAID" || balance <= 0;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { bgcolor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", pb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <ReceiptRounded sx={{ color: "#06b6d4" }} />
          <Typography variant="h6" sx={{ color: "#f1f5f9", fontWeight: 700 }}>
            Billing & Receipt
          </Typography>
        </Box>
        <Button onClick={onClose} sx={{ minWidth: 0, p: 1, color: "#64748b" }}>
          <CloseRounded />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ py: 3 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress sx={{ color: "#06b6d4" }} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ bgcolor: "rgba(239,68,68,0.1)", color: "#fca5a5" }}>{error}</Alert>
        ) : invoice ? (
          <Grid container spacing={4}>
            {/* LEFT: Receipt Preview */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Paper 
                ref={receiptRef}
                elevation={0} 
                sx={{ 
                  p: 4, 
                  bgcolor: "#fff", 
                  color: "#000",
                  borderRadius: 2,
                  fontFamily: "monospace",
                  position: "relative"
                }}
              >
                {/* Print Header */}
                <Box className="header" sx={{ textAlign: "center", mb: 3, borderBottom: "2px dashed #ccc", pb: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: "#000" }}>HMS HOSPITAL</Typography>
                  <Typography variant="body2" sx={{ color: "#555" }}>123 Health Avenue, Medical District</Typography>
                  <Typography variant="body2" sx={{ color: "#555" }}>Phone: +1 234 567 8900</Typography>
                  <Typography variant="h6" sx={{ mt: 2, fontWeight: 700, letterSpacing: 2 }}>PAYMENT RECEIPT</Typography>
                </Box>

                {/* Info */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="body2"><strong>Receipt No:</strong> {invoice.invoiceNumber}</Typography>
                    <Typography variant="body2"><strong>Date:</strong> {new Date(invoice.invoiceDate).toLocaleDateString()}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }} sx={{ textAlign: "right" }}>
                    <Typography variant="body2"><strong>Patient:</strong> {patientName}</Typography>
                    <Typography variant="body2"><strong>Appt Date:</strong> {new Date(appointmentDate).toLocaleDateString()}</Typography>
                  </Grid>
                </Grid>

                {/* Items */}
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: "flex", borderBottom: "1px solid #000", pb: 1, mb: 1 }}>
                    <Typography variant="body2" sx={{ flex: 1, fontWeight: 700 }}>Description</Typography>
                    <Typography variant="body2" sx={{ width: 60, textAlign: "center", fontWeight: 700 }}>Qty</Typography>
                    <Typography variant="body2" sx={{ width: 100, textAlign: "right", fontWeight: 700 }}>Amount</Typography>
                  </Box>
                  {invoice.InvoiceItem?.map((item: any, idx: number) => (
                    <Box key={idx} sx={{ display: "flex", mb: 1 }}>
                      <Typography variant="body2" sx={{ flex: 1 }}>{item.description}</Typography>
                      <Typography variant="body2" sx={{ width: 60, textAlign: "center" }}>{item.quantity}</Typography>
                      <Typography variant="body2" sx={{ width: 100, textAlign: "right" }}>{Number(item.totalPrice).toFixed(2)}</Typography>
                    </Box>
                  ))}
                </Box>

                <Box sx={{ borderTop: "1px solid #000", pt: 1, mb: 3 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>Total Amount:</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>{netAmount.toFixed(2)} INR</Typography>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                    <Typography variant="body2">Amount Paid:</Typography>
                    <Typography variant="body2">{totalPaid.toFixed(2)} INR</Typography>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Balance Due:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{balance.toFixed(2)} INR</Typography>
                  </Box>
                </Box>

                {/* Payment History */}
                {invoice.Payment?.length > 0 && (
                  <Box sx={{ borderTop: "1px dashed #ccc", pt: 2, mb: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 1 }}>PAYMENT HISTORY:</Typography>
                    {invoice.Payment.map((p: any, idx: number) => (
                      <Typography key={idx} variant="caption" sx={{ display: "block", color: "#555" }}>
                        {new Date().toLocaleDateString()} - {p.paymentMethod?.methodName} - {Number(p.paidAmount).toFixed(2)} INR
                        {p.transactionReference && ` (Ref: ${p.transactionReference})`}
                      </Typography>
                    ))}
                  </Box>
                )}

                {isFullyPaid && (
                  <Box sx={{ position: "absolute", top: 100, right: 30, opacity: 0.2, transform: "rotate(-30deg)", pointerEvents: "none" }}>
                    <CheckCircleRounded sx={{ fontSize: 120, color: "#10b981" }} />
                    <Typography variant="h3" sx={{ color: "#10b981", fontWeight: 900, textAlign: "center", mt: -2 }}>PAID</Typography>
                  </Box>
                )}

                <Typography variant="caption" sx={{ display: "block", textAlign: "center", color: "#888", mt: 4 }}>
                  Thank you for your visit. Get well soon!
                </Typography>
              </Paper>
            </Grid>

            {/* RIGHT: Payment Entry Form */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Box sx={{ p: 3, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 3, border: "1px solid rgba(255,255,255,0.05)", height: "100%" }}>
                <Typography variant="subtitle1" sx={{ color: "#f1f5f9", fontWeight: 600, mb: 3 }}>
                  Payment Entry
                </Typography>

                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="body2" sx={{ color: "#94a3b8" }}>Invoice Status:</Typography>
                  <Chip 
                    label={invoice.paymentStatus?.statusLabel || "UNKNOWN"} 
                    size="small"
                    sx={{ 
                      bgcolor: `${invoice.paymentStatus?.colorHex}20`, 
                      color: invoice.paymentStatus?.colorHex,
                      fontWeight: 700 
                    }} 
                  />
                </Box>
                
                <Divider sx={{ borderColor: "rgba(255,255,255,0.05)", my: 2 }} />

                {!isFullyPaid ? (
                  <>
                    <TextField
                      fullWidth
                      label="Amount (INR)"
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      sx={{ mb: 3, "& .MuiInputBase-root": { color: "#f1f5f9" }, "& .MuiInputLabel-root": { color: "#94a3b8" } }}
                    />
                    <TextField
                      select
                      fullWidth
                      label="Payment Method"
                      value={paymentMethodId}
                      onChange={(e) => setPaymentMethodId(e.target.value)}
                      sx={{ mb: 3, "& .MuiInputBase-root": { color: "#f1f5f9" }, "& .MuiInputLabel-root": { color: "#94a3b8" } }}
                    >
                      {paymentMethods.map(m => (
                        <MenuItem key={m.paymentMethodId} value={m.paymentMethodId}>{m.methodName}</MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      fullWidth
                      label="Transaction Ref (Optional)"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      sx={{ mb: 4, "& .MuiInputBase-root": { color: "#f1f5f9" }, "& .MuiInputLabel-root": { color: "#94a3b8" } }}
                    />
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={handlePayment}
                      disabled={paying || !paymentAmount || !paymentMethodId}
                      startIcon={paying ? <CircularProgress size={20} /> : <PaymentRounded />}
                      sx={{ 
                        py: 1.5, 
                        bgcolor: "#10b981", 
                        "&:hover": { bgcolor: "#059669" }, 
                        fontWeight: 700,
                        fontSize: "1rem"
                      }}
                    >
                      {paying ? "Processing..." : `Collect ${paymentAmount || 0} INR`}
                    </Button>
                  </>
                ) : (
                  <Box sx={{ textAlign: "center", py: 5 }}>
                    <CheckCircleRounded sx={{ fontSize: 60, color: "#10b981", mb: 2 }} />
                    <Typography variant="h6" sx={{ color: "#f1f5f9", fontWeight: 700 }}>Fully Paid</Typography>
                    <Typography variant="body2" sx={{ color: "#94a3b8", mt: 1 }}>
                      No further payments required for this invoice.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <Button onClick={onClose} sx={{ color: "#94a3b8" }}>Close</Button>
        <Button 
          variant="contained" 
          startIcon={<PrintRounded />}
          disabled={!invoice}
          onClick={handlePrint}
          sx={{ bgcolor: "#3b82f6", "&:hover": { bgcolor: "#2563eb" }, fontWeight: 600 }}
        >
          Print Receipt
        </Button>
      </DialogActions>
    </Dialog>
  );
}
