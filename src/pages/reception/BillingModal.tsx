import { useState, useEffect, useRef } from "react";
import { getApiErrorMessage } from "../../utils/apiError";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Divider, Alert,
  Grid, TextField, MenuItem, Paper, Chip
} from "@mui/material";
import {
  ReceiptRounded, CheckCircleRounded, PrintRounded, PaymentRounded, CloseRounded
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import { ListSkeleton } from "../../components/TableRowsSkeleton";
import ErrorState from "../../components/ErrorState";
import { useToast } from "../../contexts/ToastContext";
import { useHospitalAuth } from "../../contexts/HospitalAuthContext";
import BillReceipt from "../../components/reception/BillReceipt";

interface BillingModalProps {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  patientName: string;
  appointmentDate: string;
}

export default function BillingModal({ open, onClose, appointmentId, patientName, appointmentDate }: BillingModalProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const toast = useToast();
  const { hospital } = useHospitalAuth();
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

  // Hospital identity for the receipt header
  const [hospitalProfile, setHospitalProfile] = useState<any>(null);

  // Discount & Tax
  const [defaultTaxPct, setDefaultTaxPct] = useState(0);
  const [discountInput, setDiscountInput] = useState("");
  const [taxInput, setTaxInput] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // Refund
  const [showRefund, setShowRefund] = useState(false);
  const [refundPaymentId, setRefundPaymentId] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

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
      setLoadError(null);
      // 1. Fetch lookups
      const lookupsRes = await axiosInstance.get("/reception/billing/lookups");
      const hospitalTaxPct = Number(lookupsRes.data?.data?.taxPercentage || 0);
      if (lookupsRes.data.success) {
        setPaymentMethods(lookupsRes.data.data.methods);
        setDefaultTaxPct(hospitalTaxPct);
        setHospitalProfile(lookupsRes.data.data.hospital || null);
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
        const totalRefunded = currentInvoice.Refund?.reduce((sum: number, r: any) => sum + Number(r.refundAmount), 0) || 0;
        const remaining = Number(currentInvoice.netAmount) - (totalPaid - totalRefunded);
        if (remaining > 0) {
          setPaymentAmount(remaining.toString());
        }

        // Prefill the discount/tax fields: existing discount, and either the
        // tax rate already on the invoice or the hospital's configured default.
        const g = Number(currentInvoice.grossAmount || 0);
        const d = Number(currentInvoice.discountAmount || 0);
        const t = Number(currentInvoice.taxAmount || 0);
        setDiscountInput(d > 0 ? String(d) : "");
        const taxable = g - d;
        const currentRate = taxable > 0 && t > 0 ? Math.round((t / taxable) * 10000) / 100 : hospitalTaxPct;
        setTaxInput(currentRate ? String(currentRate) : "");
      }

    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, "Failed to load billing data");
      setLoadError(msg);
      toast.error(msg);
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
        toast.success("Payment recorded successfully");
        // Refresh invoice data
        const getInvoiceRes = await axiosInstance.get(`/reception/billing/appointments/${appointmentId}/invoice`);
        if (getInvoiceRes.data.success) {
          setInvoice(getInvoiceRes.data.data);
          
          const updatedInvoice = getInvoiceRes.data.data;
          const totalPaid = updatedInvoice.Payment?.reduce((sum: number, p: any) => sum + Number(p.paidAmount), 0) || 0;
          const totalRefunded = updatedInvoice.Refund?.reduce((sum: number, r: any) => sum + Number(r.refundAmount), 0) || 0;
          const remaining = Number(updatedInvoice.netAmount) - (totalPaid - totalRefunded);
          if (remaining > 0) {
             setPaymentAmount(remaining.toString());
          } else {
             setPaymentAmount("");
          }
        }
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error(getApiErrorMessage(err, "Payment failed"));
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
        toast.success("Line item added");
        // Refresh invoice
        await fetchBillingData();
        setNewItemDesc("");
        setNewItemQty("1");
        setNewItemPrice("");
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error(getApiErrorMessage(err, "Failed to add line item"));
    } finally {
      setAddingItem(false);
    }
  };

  const handleAdjust = async () => {
    if (!invoice) return;
    try {
      setAdjusting(true);
      const res = await axiosInstance.put(`/reception/billing/invoices/${invoice.invoiceId}/adjust`, {
        discountAmount: Number(discountInput || 0),
        taxPercent: Number(taxInput || 0),
      });
      if (res.data.success) {
        toast.success("Discount & tax applied");
        await fetchBillingData();
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to update invoice"));
    } finally {
      setAdjusting(false);
    }
  };

  const handlePrint = () => {
    if (!receiptRef.current) return;
    const printContents = receiptRef.current.innerHTML;

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

    // Print inside a hidden iframe instead of swapping document.body + reloading.
    // The old approach destroyed the React tree and forced a full page reload
    // (losing all SPA state). We clone the page's stylesheets so the receipt's
    // MUI styling renders identically inside the iframe.
    const headStyles = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]')
    ).map((el) => el.outerHTML).join("");

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }
    doc.open();
    doc.write(`<!doctype html><html><head><title>Receipt</title>${headStyles}${printStyle}</head><body>${printContents}</body></html>`);
    doc.close();

    const win = iframe.contentWindow!;
    const cleanup = () => { if (iframe.parentNode) document.body.removeChild(iframe); };
    win.onafterprint = cleanup;
    // Give cloned styles/fonts a tick to apply before printing.
    setTimeout(() => {
      win.focus();
      win.print();
      setTimeout(cleanup, 1000); // fallback if onafterprint never fires
    }, 250);
  };

  const handleRefund = async () => {
    if (!invoice || !refundPaymentId || !refundAmount || refundReason.trim().length < 3) return;
    try {
      setRefunding(true);
      const res = await axiosInstance.post(`/reception/billing/invoices/${invoice.invoiceId}/refund`, {
        paymentId: refundPaymentId,
        amount: parseFloat(refundAmount),
        reason: refundReason.trim(),
      });
      if (res.data.success) {
        toast.success("Refund processed");
        setShowRefund(false);
        setRefundPaymentId("");
        setRefundAmount("");
        setRefundReason("");
        await fetchBillingData();
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Refund failed"));
    } finally {
      setRefunding(false);
    }
  };

  if (!open) return null;

  const totalPaid = invoice?.Payment?.reduce((sum: number, p: any) => sum + Number(p.paidAmount), 0) || 0;
  const totalRefunded = invoice?.Refund?.reduce((sum: number, r: any) => sum + Number(r.refundAmount), 0) || 0;
  const netPaid = totalPaid - totalRefunded;
  const grossAmount = Number(invoice?.grossAmount || 0);
  const discountAmount = Number(invoice?.discountAmount || 0);
  const taxAmount = Number(invoice?.taxAmount || 0);
  const netAmount = Number(invoice?.netAmount || 0);
  const balance = netAmount - netPaid;
  const isFullyPaid = invoice?.paymentStatus?.statusCode === "PAID" || balance <= 0;

  // How much of each payment is still refundable (paid − refunds against it).
  const refundedByPayment: Record<string, number> = {};
  (invoice?.Refund || []).forEach((r: any) => {
    refundedByPayment[r.paymentId] = (refundedByPayment[r.paymentId] || 0) + Number(r.refundAmount);
  });
  const refundablePayments = (invoice?.Payment || [])
    .map((p: any) => ({ ...p, refundable: Number(p.paidAmount) - (refundedByPayment[p.paymentId] || 0) }))
    .filter((p: any) => p.refundable > 0.005);
  const selectedRefundable = refundablePayments.find((p: any) => p.paymentId === refundPaymentId)?.refundable || 0;

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
          <ListSkeleton />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={fetchBillingData} />
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
                <BillReceipt
                  invoice={invoice}
                  hospitalProfile={hospitalProfile}
                  hospital={hospital}
                  patientName={patientName}
                  appointmentDate={appointmentDate}
                />
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
                      startIcon={paying ? <HeartbeatLoader size={22} /> : <PaymentRounded />}
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

                {/* Refund — available whenever there's collected money left to return. */}
                {refundablePayments.length > 0 && (
                  <Box sx={{ mt: 4, p: 2, bgcolor: "rgba(139,92,246,0.05)", borderRadius: 2, border: "1px dashed rgba(139,92,246,0.3)" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="subtitle2" sx={{ color: "#8b5cf6", fontWeight: 700 }}>
                        Refund
                      </Typography>
                      {!showRefund && (
                        <Button size="small" onClick={() => {
                          setShowRefund(true);
                          const first = refundablePayments[0];
                          if (first) { setRefundPaymentId(first.paymentId); setRefundAmount(first.refundable.toFixed(2)); }
                        }} sx={{ color: "#8b5cf6", textTransform: "none", fontWeight: 600 }}>
                          Process a refund
                        </Button>
                      )}
                    </Box>

                    {showRefund && (
                      <Box sx={{ mt: 2 }}>
                        <TextField
                          select fullWidth size="small"
                          label="Refund against payment"
                          value={refundPaymentId}
                          onChange={(e) => {
                            setRefundPaymentId(e.target.value);
                            const p = refundablePayments.find((x: any) => x.paymentId === e.target.value);
                            if (p) setRefundAmount(p.refundable.toFixed(2));
                          }}
                          sx={{ mb: 2 }}
                        >
                          {refundablePayments.map((p: any) => (
                            <MenuItem key={p.paymentId} value={p.paymentId}>
                              {p.paymentMethod?.methodName || "Payment"} — {Number(p.paidAmount).toFixed(2)} (refundable {p.refundable.toFixed(2)})
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          fullWidth size="small"
                          label="Refund amount (INR)"
                          type="number"
                          value={refundAmount}
                          onChange={(e) => setRefundAmount(e.target.value)}
                          inputProps={{ min: 0, max: selectedRefundable, step: "0.01" }}
                          helperText={`Max refundable: ${selectedRefundable.toFixed(2)} INR`}
                          sx={{ mb: 2 }}
                        />
                        <TextField
                          fullWidth size="small"
                          label="Reason (required)"
                          placeholder="e.g. Service cancelled, overcharge"
                          value={refundReason}
                          onChange={(e) => setRefundReason(e.target.value)}
                          multiline rows={2}
                          sx={{ mb: 2 }}
                        />
                        <Box sx={{ display: "flex", gap: 1 }}>
                          <Button fullWidth variant="outlined" onClick={() => setShowRefund(false)} disabled={refunding}
                            sx={{ color: "text.secondary", borderColor: "divider", fontWeight: 600 }}>
                            Cancel
                          </Button>
                          <Button
                            fullWidth variant="contained"
                            onClick={handleRefund}
                            disabled={refunding || !refundPaymentId || !refundAmount || Number(refundAmount) <= 0 || Number(refundAmount) > selectedRefundable + 0.005 || refundReason.trim().length < 3}
                            sx={{ bgcolor: "#8b5cf6", "&:hover": { bgcolor: "#7c3aed" }, fontWeight: 700 }}
                          >
                            {refunding ? "Processing..." : "Process Refund"}
                          </Button>
                        </Box>
                      </Box>
                    )}
                  </Box>
                )}

                {!isFullyPaid && (
                  <Box sx={{ mt: 4, p: 2, bgcolor: "rgba(16,185,129,0.05)", borderRadius: 2, border: "1px dashed rgba(16,185,129,0.3)" }}>
                    <Typography variant="subtitle2" sx={{ color: "#10b981", fontWeight: 700, mb: 2 }}>
                      Discount & Tax
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          fullWidth size="small"
                          label="Discount (INR)"
                          type="number"
                          value={discountInput}
                          onChange={(e) => setDiscountInput(e.target.value)}
                          inputProps={{ min: 0 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          fullWidth size="small"
                          label="Tax (%)"
                          type="number"
                          value={taxInput}
                          onChange={(e) => setTaxInput(e.target.value)}
                          inputProps={{ min: 0, max: 100 }}
                          helperText={defaultTaxPct ? `Hospital default: ${defaultTaxPct}%` : undefined}
                        />
                      </Grid>
                    </Grid>
                    <Button
                      fullWidth variant="outlined"
                      onClick={handleAdjust}
                      disabled={adjusting}
                      sx={{ mt: 2, color: "#10b981", borderColor: "rgba(16,185,129,0.5)", fontWeight: 600 }}
                    >
                      {adjusting ? "Applying..." : "Apply Discount & Tax"}
                    </Button>
                  </Box>
                )}

                {!isFullyPaid && (
                  <Box sx={{ mt: 4, p: 2, bgcolor: "rgba(59,130,246,0.05)", borderRadius: 2, border: "1px dashed rgba(59,130,246,0.3)" }}>
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
