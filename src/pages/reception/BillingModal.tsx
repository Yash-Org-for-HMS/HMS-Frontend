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
import { useToast } from "../../contexts/ToastContext";

interface BillingModalProps {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  patientName: string;
  appointmentDate: string;
}

export default function BillingModal({ open, onClose, appointmentId, patientName, appointmentDate }: BillingModalProps) {
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const [invoice, setInvoice] = useState<any>(null);
  
  // Lookups
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  
  // Payment Form
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [paying, setPaying] = useState(false);

  // Custom Line Item
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  // For printing
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && appointmentId) {
      fetchBillingData();
    } else {
      // Reset state on close
      setInvoice(null);
      setPaymentAmount("");
      setPaymentMethodId("");
      setTransactionRef("");
    }
  }, [open, appointmentId]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
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
      toast.error(err.response?.data?.message || "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!invoice || !paymentAmount || !paymentMethodId) return;
    
    try {
      setPaying(true);
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
      toast.error(err.response?.data?.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const handleAddLineItem = async () => {
    if (!invoice || !newItemDesc || !newItemPrice || Number(newItemPrice) < 0) return;
    try {
      setAddingItem(true);
      const res = await axiosInstance.post(`/reception/billing/invoices/${invoice.invoiceId}/items`, {
        description: newItemDesc,
        quantity: Number(newItemQty),
        unitPrice: Number(newItemPrice)
      });
      if (res.data.success) {
        // Refresh invoice
        await fetchBillingData();
        setNewItemDesc("");
        setNewItemQty("1");
        setNewItemPrice("");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to add line item");
    } finally {
      setAddingItem(false);
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
            @page { margin: 0.5cm; }
            body { font-family: 'Inter', Arial, sans-serif; padding: 20px; color: #1f2937; background: #fff; }
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 12px 8px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            th { font-weight: 700; color: #4b5563; text-transform: uppercase; font-size: 12px; }
            .text-right { text-align: right; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
            .hospital-name { font-size: 28px; font-weight: 900; color: #1e3a8a; margin: 0; letter-spacing: 1px; }
            .hospital-info { font-size: 14px; color: #6b7280; margin: 5px 0 0 0; }
            .receipt-title { margin-top: 20px; font-size: 16px; font-weight: 800; letter-spacing: 3px; color: #3b82f6; text-transform: uppercase; }
            .grid-info { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px; }
            .totals-box { margin-top: 30px; border-top: 2px solid #1f2937; padding-top: 15px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
            .total-row.bold { font-weight: 800; font-size: 16px; }
            .watermark { position: absolute; top: 30%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 120px; font-weight: 900; color: rgba(16, 185, 129, 0.1); pointer-events: none; }
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
        sx: { bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid", borderColor: "divider", pb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <ReceiptRounded sx={{ color: "#06b6d4" }} />
          <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700 }}>
            Billing & Receipt
          </Typography>
        </Box>
        <Button onClick={onClose} sx={{ minWidth: 0, p: 1, color: "text.secondary" }}>
          <CloseRounded />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ py: 3 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress sx={{ color: "#06b6d4" }} />
          </Box>
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
                <Box className="header" sx={{ textAlign: "center", mb: 4, borderBottom: "2px solid #3b82f6", pb: 3 }}>
                  <Typography className="hospital-name" variant="h4" sx={{ fontWeight: 900, color: "#1e3a8a", letterSpacing: 1 }}>HMS HOSPITAL</Typography>
                  <Typography className="hospital-info" variant="body2" sx={{ color: "#6b7280", mt: 0.5 }}>123 Health Avenue, Medical District</Typography>
                  <Typography className="hospital-info" variant="body2" sx={{ color: "#6b7280" }}>Phone: +1 234 567 8900 | Web: www.hmshospital.com</Typography>
                  <Typography className="receipt-title" variant="subtitle1" sx={{ mt: 3, fontWeight: 800, letterSpacing: 3, color: "#3b82f6" }}>PAYMENT RECEIPT</Typography>
                </Box>

                {/* Info */}
                <Box className="grid-info" sx={{ display: "flex", justifyContent: "space-between", mb: 4 }}>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 0.5 }}><strong style={{ color: "#4b5563" }}>Receipt No:</strong> {invoice.invoiceNumber}</Typography>
                    <Typography variant="body2"><strong style={{ color: "#4b5563" }}>Date:</strong> {new Date(invoice.invoiceDate).toLocaleDateString()}</Typography>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Typography variant="body2" sx={{ mb: 0.5 }}><strong style={{ color: "#4b5563" }}>Patient:</strong> {patientName}</Typography>
                    <Typography variant="body2"><strong style={{ color: "#4b5563" }}>Appt Date:</strong> {new Date(appointmentDate).toLocaleDateString()}</Typography>
                  </Box>
                </Box>

                {/* Items */}
                <Box sx={{ mb: 4 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
                    <thead>
                      <tr>
                        <th style={{ padding: "12px 8px", textAlign: "left", borderBottom: "2px solid #e5e7eb", color: "#4b5563", textTransform: "uppercase", fontSize: "12px" }}>Description</th>
                        <th style={{ padding: "12px 8px", textAlign: "center", borderBottom: "2px solid #e5e7eb", color: "#4b5563", textTransform: "uppercase", fontSize: "12px" }}>Qty</th>
                        <th style={{ padding: "12px 8px", textAlign: "right", borderBottom: "2px solid #e5e7eb", color: "#4b5563", textTransform: "uppercase", fontSize: "12px" }}>Amount (INR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.InvoiceItem?.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td style={{ padding: "12px 8px", borderBottom: "1px solid #f3f4f6", fontSize: "14px" }}>{item.description}</td>
                          <td style={{ padding: "12px 8px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", textAlign: "center" }}>{item.quantity}</td>
                          <td style={{ padding: "12px 8px", borderBottom: "1px solid #f3f4f6", fontSize: "14px", textAlign: "right" }}>{Number(item.totalPrice).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>

                <Box className="totals-box" sx={{ borderTop: "2px solid #1f2937", pt: 2, mb: 4 }}>
                  <Box className="total-row bold" sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 800 }}>Total Amount:</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 800 }}>{netAmount.toFixed(2)} INR</Typography>
                  </Box>
                  <Box className="total-row" sx={{ display: "flex", justifyContent: "space-between", mb: 1, color: "#4b5563" }}>
                    <Typography variant="body2">Amount Paid:</Typography>
                    <Typography variant="body2">{totalPaid.toFixed(2)} INR</Typography>
                  </Box>
                  <Box className="total-row bold" sx={{ display: "flex", justifyContent: "space-between", mt: 1, pt: 1, borderTop: "1px dashed #d1d5db" }}>
                    <Typography variant="body1" sx={{ fontWeight: 800, color: balance > 0 ? "#ef4444" : "#10b981" }}>Balance Due:</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 800, color: balance > 0 ? "#ef4444" : "#10b981" }}>{balance.toFixed(2)} INR</Typography>
                  </Box>
                </Box>

                {/* Payment History */}
                {invoice.Payment?.length > 0 && (
                  <Box sx={{ borderTop: "1px solid #e5e7eb", pt: 3, mb: 3 }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, display: "block", mb: 2, color: "#6b7280", letterSpacing: 1 }}>PAYMENT HISTORY</Typography>
                    {invoice.Payment.map((p: any, idx: number) => (
                      <Box key={idx} sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                        <Typography variant="caption" sx={{ color: "#4b5563" }}>
                          {new Date().toLocaleDateString()} • {p.paymentMethod?.methodName}
                          {p.transactionReference && ` (Ref: ${p.transactionReference})`}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: "#4b5563" }}>
                          {Number(p.paidAmount).toFixed(2)} INR
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}

                {isFullyPaid && (
                  <Typography className="watermark" variant="h1">PAID</Typography>
                )}

                <Typography variant="caption" sx={{ display: "block", textAlign: "center", color: "#9ca3af", mt: 6, fontStyle: "italic" }}>
                  Thank you for your visit. Get well soon!
                </Typography>
              </Paper>
            </Grid>

            {/* RIGHT: Payment Entry Form */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Box sx={{ p: 3, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
                <Typography variant="subtitle1" sx={{ color: "text.primary", fontWeight: 600, mb: 3 }}>
                  Payment Entry
                </Typography>

                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>Invoice Status:</Typography>
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
                
                <Divider sx={{ borderColor: "divider", my: 2 }} />

                {!isFullyPaid ? (
                  <>
                    <TextField
                      fullWidth
                      label="Amount (INR)"
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      sx={{ mb: 3, "& .MuiInputBase-root": { color: "text.primary" }, "& .MuiInputLabel-root": { color: "text.secondary" } }}
                    />
                    <TextField
                      select
                      fullWidth
                      label="Payment Method"
                      value={paymentMethodId}
                      onChange={(e) => setPaymentMethodId(e.target.value)}
                      sx={{ mb: 3, "& .MuiInputBase-root": { color: "text.primary" }, "& .MuiInputLabel-root": { color: "text.secondary" } }}
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
                      sx={{ mb: 4, "& .MuiInputBase-root": { color: "text.primary" }, "& .MuiInputLabel-root": { color: "text.secondary" } }}
                    />
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={handlePayment}
                      disabled={paying || !paymentAmount || !paymentMethodId || Number(paymentAmount) <= 0}
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
                    <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700 }}>Fully Paid</Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
                      No further payments required for this invoice.
                    </Typography>
                  </Box>
                )}

                {!isFullyPaid && (
                  <Box sx={{ mt: 5, p: 2, bgcolor: "rgba(59,130,246,0.05)", borderRadius: 2, border: "1px dashed rgba(59,130,246,0.3)" }}>
                    <Typography variant="subtitle2" sx={{ color: "#3b82f6", fontWeight: 700, mb: 2 }}>
                      + Add Custom Line Item
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth size="small"
                          label="Item Description"
                          placeholder="e.g. Consumables, Reg Fee"
                          value={newItemDesc}
                          onChange={(e) => setNewItemDesc(e.target.value)}
                        />
                      </Grid>
                      <Grid size={{ xs: 4 }}>
                        <TextField
                          fullWidth size="small"
                          label="Qty"
                          type="number"
                          value={newItemQty}
                          onChange={(e) => setNewItemQty(e.target.value)}
                        />
                      </Grid>
                      <Grid size={{ xs: 8 }}>
                        <TextField
                          fullWidth size="small"
                          label="Unit Price (INR)"
                          type="number"
                          value={newItemPrice}
                          onChange={(e) => setNewItemPrice(e.target.value)}
                        />
                      </Grid>
                    </Grid>
                    <Button 
                      fullWidth variant="outlined" 
                      onClick={handleAddLineItem}
                      disabled={addingItem || !newItemDesc || !newItemPrice || Number(newItemPrice) < 0}
                      sx={{ mt: 2, color: "#3b82f6", borderColor: "rgba(59,130,246,0.5)", fontWeight: 600 }}
                    >
                      {addingItem ? "Adding..." : "Add Item"}
                    </Button>
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: "1px solid", borderColor: "divider" }}>
        <Button onClick={onClose} sx={{ color: "text.secondary" }}>Close</Button>
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
