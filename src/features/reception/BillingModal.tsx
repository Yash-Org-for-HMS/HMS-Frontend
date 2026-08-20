import { useState, useEffect, useRef } from "react";
import { paidTotal, refundedTotal } from "@/utils/invoiceMoney";
import RefundSection from "@/components/billing/RefundSection";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Divider, Alert,
  Grid, TextField, MenuItem, Paper, Chip
} from "@mui/material";
import {
  ReceiptRounded, CheckCircleRounded, PrintRounded, PaymentRounded, CloseRounded
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import ErrorState from "@/components/ErrorState";
import { useToast } from "@/providers/ToastContext";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import BillReceipt from "@/components/reception/BillReceipt";
import SocChargePicker from "@/components/billing/SocChargePicker";
import { SEMANTIC, BRAND } from "@/styles/accents";

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
  const navigate = useNavigate();
  const { hospital } = useHospitalAuth();
  const [invoice, setInvoice] = useState<any>(null);
  // This appointment's invoice only covers the consultation. If the patient has
  // OTHER unbilled charges (lab / pharmacy / radiology), surface them here so the
  // front desk doesn't silently miss them — with a one-click route to the full
  // consolidated billing screen that captures everything they owe.
  const [otherCharges, setOtherCharges] = useState<any[]>([]);
  
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
  const [socPickerOpen, setSocPickerOpen] = useState(false);

  // Hospital identity for the receipt header
  const [hospitalProfile, setHospitalProfile] = useState<any>(null);

  // Discount & Tax
  const [defaultTaxPct, setDefaultTaxPct] = useState(0);
  const [discountInput, setDiscountInput] = useState("");
  const [discountReasonInput, setDiscountReasonInput] = useState("");
  const [taxInput, setTaxInput] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // Void / cancel invoice
  const [showVoid, setShowVoid] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  // Refund

  // For printing
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && appointmentId) {
      fetchBillingData();
    } else {
      // Reset state on close
      setInvoice(null);
      setOtherCharges([]);
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

      // Surface the patient's OTHER unbilled charges (lab / pharmacy / radiology)
      // that this consultation invoice does NOT include. Consultation-type items
      // are excluded — those are what this modal already bills. Best-effort: a
      // failure here must never block the core billing flow.
      if (currentInvoice?.patientId) {
        try {
          const unbilledRes = await axiosInstance.get(`/billing/unbilled/${currentInvoice.patientId}`);
          const items: any[] = unbilledRes.data?.data || [];
          setOtherCharges(items.filter((it) => it.type !== "CONSULTATION"));
        } catch { /* non-blocking */ }
      }

      // Pre-fill payment amount with remaining balance
      if (currentInvoice) {
        const totalPaid = paidTotal(currentInvoice);
        const totalRefunded = refundedTotal(currentInvoice);
        const remaining = Number(currentInvoice.netAmount) - (totalPaid - totalRefunded);
        if (remaining > 0) {
          setPaymentAmount(remaining.toString());
        }

        // Prefill the discount/tax fields: existing discount, and the tax rate
        // already on the invoice if any. Consultations are GST-exempt, so a fresh
        // consult invoice defaults to 0% (the field stays editable for the rare
        // taxable case) rather than the hospital's flat rate.
        const g = Number(currentInvoice.grossAmount || 0);
        const d = Number(currentInvoice.discountAmount || 0);
        const t = Number(currentInvoice.taxAmount || 0);
        setDiscountInput(d > 0 ? String(d) : "");
        const taxable = g - d;
        const currentRate = taxable > 0 && t > 0 ? Math.round((t / taxable) * 10000) / 100 : 0;
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
          const totalPaid = paidTotal(updatedInvoice);
          const totalRefunded = refundedTotal(updatedInvoice);
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

  // Add a charge picked from the Schedule of Charges — the server prices it from
  // the rate card (we send only the id), so no amount is trusted from the client.
  const handleAddSocCharge = async (chargeItemId: string) => {
    if (!invoice) return;
    try {
      setAddingItem(true);
      const res = await axiosInstance.post(`/reception/billing/invoices/${invoice.invoiceId}/items`, { chargeItemId });
      if (res.data.success) {
        toast.success("Charge added");
        await fetchBillingData();
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to add charge"));
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
        discountReason: discountReasonInput.trim() || undefined,
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

  const handleVoid = async () => {
    if (!invoice) return;
    try {
      setVoiding(true);
      const res = await axiosInstance.post(`/reception/billing/invoices/${invoice.invoiceId}/cancel`, { reason: voidReason.trim() });
      if (res.data.success) {
        toast.success("Invoice voided");
        setShowVoid(false);
        setVoidReason("");
        await fetchBillingData();
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to void invoice"));
    } finally {
      setVoiding(false);
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


  if (!open) return null;

  const totalPaid = paidTotal(invoice);
  const totalRefunded = refundedTotal(invoice);
  const netPaid = totalPaid - totalRefunded;
  const netAmount = Number(invoice?.netAmount || 0);
  const balance = netAmount - netPaid;
  const isFullyPaid = invoice?.paymentStatus?.statusCode === "PAID" || balance <= 0;


  return (
    <>
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
          <>
            {otherCharges.length > 0 && (
              <Alert
                severity="warning"
                icon={<ReceiptRounded fontSize="inherit" />}
                sx={{ mb: 3, alignItems: "center", borderRadius: 2 }}
                action={
                  <Button
                    color="inherit"
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      onClose();
                      navigate(`/reception/billing?patientId=${invoice.patientId}`);
                    }}
                    sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
                  >
                    Bill all charges
                  </Button>
                }
              >
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  This patient has {otherCharges.length} other unbilled{" "}
                  {otherCharges.length === 1 ? "charge" : "charges"} (
                  {`₹${otherCharges.reduce((s, c) => s + Number(c.amount || 0), 0).toFixed(2)}`}) not on this invoice.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {[...new Set(otherCharges.map((c) => c.type))].join(", ")} — this consultation bill won't collect
                  them. Use “Bill all charges” to invoice everything together.
                </Typography>
              </Alert>
            )}
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
                        bgcolor: SEMANTIC.success, 
                        "&:hover": { bgcolor: SEMANTIC.successDark }, 
                        fontWeight: 700,
                        fontSize: "1rem"
                      }}
                    >
                      {paying ? "Processing..." : `Collect ${paymentAmount || 0} INR`}
                    </Button>
                  </>
                ) : (
                  <Box sx={{ textAlign: "center", py: 5 }}>
                    <CheckCircleRounded sx={{ fontSize: 60, color: SEMANTIC.success, mb: 2 }} />
                    <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700 }}>Fully Paid</Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
                      No further payments required for this invoice.
                    </Typography>
                  </Box>
                )}

                {/* Refunding is the same act wherever an invoice is opened, so
                    both this screen and the Billing panel's invoice view mount
                    the one component rather than each keeping its own copy. */}
                <RefundSection
                  invoice={invoice}
                  paymentMethods={paymentMethods}
                  onChanged={fetchBillingData}
                />

                {!isFullyPaid && (
                  <Box sx={{ mt: 4, p: 2, bgcolor: "rgba(16,185,129,0.05)", borderRadius: 2, border: "1px dashed rgba(16,185,129,0.3)" }}>
                    <Typography variant="subtitle2" sx={{ color: SEMANTIC.success, fontWeight: 700, mb: 2 }}>
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
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth size="small"
                          label="Reason for discount (optional)"
                          placeholder="e.g. Camp concession, staff waiver, goodwill"
                          value={discountReasonInput}
                          onChange={(e) => setDiscountReasonInput(e.target.value)}
                        />
                      </Grid>
                    </Grid>
                    <Button
                      fullWidth variant="outlined"
                      onClick={handleAdjust}
                      disabled={adjusting}
                      sx={{ mt: 2, color: SEMANTIC.success, borderColor: "rgba(16,185,129,0.5)", fontWeight: 600 }}
                    >
                      {adjusting ? "Applying..." : "Apply Discount & Tax"}
                    </Button>
                  </Box>
                )}

                {!isFullyPaid && !invoice?.admissionId && invoice?.invoiceStatus !== "CANCELLED" && (
                  <Box sx={{ mt: 4, p: 2, bgcolor: "rgba(239,68,68,0.05)", borderRadius: 2, border: "1px dashed rgba(239,68,68,0.3)" }}>
                    <Typography variant="subtitle2" sx={{ color: SEMANTIC.danger, fontWeight: 700, mb: showVoid ? 2 : 1 }}>
                      Void invoice
                    </Typography>
                    {!showVoid ? (
                      <>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1.5 }}>
                          Cancels this invoice and frees its charges to be re-billed. Not available once any payment is collected (refund first).
                        </Typography>
                        <Button fullWidth variant="outlined" onClick={() => setShowVoid(true)}
                          sx={{ color: SEMANTIC.danger, borderColor: "rgba(239,68,68,0.5)", fontWeight: 600 }}>
                          Void invoice
                        </Button>
                      </>
                    ) : (
                      <>
                        <TextField
                          fullWidth size="small"
                          label="Reason (required)"
                          placeholder="e.g. Billed in error, duplicate invoice"
                          value={voidReason}
                          onChange={(e) => setVoidReason(e.target.value)}
                          multiline rows={2}
                          sx={{ mb: 2 }}
                        />
                        <Box sx={{ display: "flex", gap: 1 }}>
                          <Button fullWidth variant="outlined" onClick={() => { setShowVoid(false); setVoidReason(""); }} disabled={voiding}
                            sx={{ color: "text.secondary", borderColor: "divider", fontWeight: 600 }}>
                            Cancel
                          </Button>
                          <Button fullWidth variant="contained" onClick={handleVoid}
                            disabled={voiding || voidReason.trim().length < 3}
                            sx={{ bgcolor: SEMANTIC.danger, "&:hover": { bgcolor: "#dc2626" }, fontWeight: 700 }}>
                            {voiding ? "Voiding..." : "Confirm Void"}
                          </Button>
                        </Box>
                      </>
                    )}
                  </Box>
                )}

                {!isFullyPaid && (
                  <Box sx={{ mt: 4, p: 2, bgcolor: "rgba(59,130,246,0.05)", borderRadius: 2, border: "1px dashed rgba(59,130,246,0.3)" }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, gap: 1, flexWrap: "wrap" }}>
                      <Typography variant="subtitle2" sx={{ color: SEMANTIC.info, fontWeight: 700 }}>
                        + Add Charge
                      </Typography>
                      <Button size="small" variant="outlined" onClick={() => setSocPickerOpen(true)} disabled={addingItem}
                        sx={{ textTransform: "none", color: BRAND.action, borderColor: "rgba(8,145,178,0.4)" }}>
                        Pick from Schedule of Charges
                      </Button>
                    </Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1.5 }}>
                      Pick a rate-card charge (priced automatically), or type a custom line below.
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
                inputProps={{ min: 1, max: 100000 }}
              />
                      </Grid>
                      <Grid size={{ xs: 8 }}>
                        <TextField
                          fullWidth size="small"
                          label="Unit Price (INR)"
                          type="number"
                          value={newItemPrice}
                          onChange={(e) => setNewItemPrice(e.target.value)}
                inputProps={{ min: 0, max: 10000000 }}
              />
                      </Grid>
                    </Grid>
                    <Button 
                      fullWidth variant="outlined" 
                      onClick={handleAddLineItem}
                      disabled={addingItem || !newItemDesc || !newItemPrice || Number(newItemPrice) < 0}
                      sx={{ mt: 2, color: SEMANTIC.info, borderColor: "rgba(59,130,246,0.5)", fontWeight: 600 }}
                    >
                      {addingItem ? "Adding..." : "Add Item"}
                    </Button>
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
          </>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: "1px solid", borderColor: "divider" }}>
        <Button onClick={onClose} sx={{ color: "text.secondary" }}>Close</Button>
        <Button 
          variant="contained" 
          startIcon={<PrintRounded />}
          disabled={!invoice}
          onClick={handlePrint}
          sx={{ bgcolor: SEMANTIC.info, "&:hover": { bgcolor: SEMANTIC.infoDark }, fontWeight: 600 }}
        >
          Print Receipt
        </Button>
      </DialogActions>
    </Dialog>
    <SocChargePicker
      open={socPickerOpen}
      onClose={() => setSocPickerOpen(false)}
      onPick={(c) => handleAddSocCharge(c.chargeItemId)}
      accent={BRAND.action}
    />
    </>
  );
}
