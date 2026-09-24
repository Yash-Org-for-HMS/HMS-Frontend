import { printHtml } from "@/utils/printHtml";
import type { InvoiceDetail, UnbilledItem, PaymentMethodRef, HospitalBillingProfile } from "@/types";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { paidTotal, refundedTotal } from "@/utils/invoiceMoney";
import RefundSection from "@/components/billing/RefundSection";
import { useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Divider, Alert,
  Grid, TextField, MenuItem, Paper, Chip, Collapse, ButtonBase
} from "@mui/material";
import {
  ReceiptRounded, CheckCircleRounded, PrintRounded, PaymentRounded, CloseRounded,
  ExpandMoreRounded, LocalOfferRounded, AddCircleOutlineRounded, BlockRounded
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import ErrorState from "@/components/ErrorState";
import { useToast } from "@/providers/ToastContext";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import BillReceipt from "@/components/reception/BillReceipt";
import SocChargePicker from "@/components/billing/SocChargePicker";
import { SEMANTIC, BRAND, alpha } from "@/styles/accents";

interface BillingModalProps {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  patientName: string;
  appointmentDate: string;
}

/** Which of the occasional actions is open. Only ever one. */
type SectionKey = "discount" | "charge" | "void";

/**
 * One collapsible action in the right-hand column.
 *
 * These three used to sit open at once, each in a dashed box of its own colour
 * — green, blue, red — stacked down a 370px column. That put five headings and
 * nine inputs on screen permanently for actions a receptionist takes rarely,
 * and left the fields sharing a half-column each with nowhere to breathe. One
 * open at a time gives whichever is in use the full width, and collapses the
 * rest to a single row.
 *
 * Collapse rather than MUI's Accordion because Collapse is what the rest of
 * this codebase already uses; Accordion appears nowhere.
 */
function ActionSection({ icon, label, accent, open, onToggle, children }: {
  icon: ReactNode;
  label: string;
  accent: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        borderRadius: 2,
        border: "1px solid",
        borderColor: open ? alpha(accent, 0.4) : "divider",
        bgcolor: open ? alpha(accent, 0.04) : "transparent",
        overflow: "hidden",
        transition: "border-color .15s, background-color .15s",
      }}
    >
      <ButtonBase
        onClick={onToggle}
        aria-expanded={open}
        sx={{ width: "100%", justifyContent: "flex-start", gap: 1.5, px: 2, py: 1.5, textAlign: "left" }}
      >
        <Box sx={{ display: "flex", color: accent }}>{icon}</Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "text.primary", flexGrow: 1 }}>
          {label}
        </Typography>
        <ExpandMoreRounded
          fontSize="small"
          sx={{ color: "text.secondary", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
        />
      </ButtonBase>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 2, pb: 2, pt: 0.5 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

export default function BillingModal({ open, onClose, appointmentId, patientName, appointmentDate }: BillingModalProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const toast = useToast();
  const navigate = useNavigate();
  const { hospital } = useHospitalAuth();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  // This appointment's invoice only covers the consultation. If the patient has
  // OTHER unbilled charges (lab / pharmacy / radiology), surface them here so the
  // front desk doesn't silently miss them — with a one-click route to the full
  // consolidated billing screen that captures everything they owe.
  const [otherCharges, setOtherCharges] = useState<UnbilledItem[]>([]);
  
  // Lookups
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRef[]>([]);
  
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
  const [hospitalProfile, setHospitalProfile] = useState<HospitalBillingProfile | null>(null);

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

  // Which occasional action is expanded. Closed by default: the common visit is
  // "take the money and print", and nothing else should compete with that.
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);
  const toggleSection = (k: SectionKey) => setOpenSection((cur) => (cur === k ? null : k));

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
      setOpenSection(null);
      setShowVoid(false);
      setVoidReason("");
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
          const items: UnbilledItem[] = unbilledRes.data?.data || [];
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

    /* Page setup only. This used to carry a full receipt stylesheet —
       .hospital-name, .receipt-title, .totals-box, .watermark and the rest —
       written when the receipt was local markup. The receipt has been a
       <BillReceipt>/<BillDocument> composition for a while now, and those use
       inline styles because printing copies innerHTML into a bare iframe where
       class rules would not survive. So every one of those selectors matched
       nothing; they were a description of a receipt that no longer exists. */
    const printCss = `
          @media print {
            @page { margin: 0.5cm; }
            body { font-family: 'Inter', Arial, sans-serif; padding: 20px; color: #1f2937; background: #fff; }
            .no-print { display: none !important; }
          }
      `;

    // Print inside a hidden iframe instead of swapping document.body + reloading.
    // The old approach destroyed the React tree and forced a full page reload
    // (losing all SPA state). printHtml carries the page's own CSS across so the
    // receipt's MUI styling renders identically inside the iframe.
    printHtml(printContents, { title: "Receipt", extraCss: printCss });
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
      maxWidth="lg"
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
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              <Box sx={{ p: 3, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ color: "text.primary", fontWeight: 700 }}>
                    Payment
                  </Typography>
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

                {/* The three numbers a receptionist is asked for at the desk.
                    They were only ever in the receipt on the left, so answering
                    "how much is left?" meant reading a monospace column. */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mb: 2.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="body2" color="text.secondary">Invoice total</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      ₹{netAmount.toFixed(2)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="body2" color="text.secondary">Paid so far</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      ₹{netPaid.toFixed(2)}
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 0.75 }} />
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Balance due</Typography>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 800,
                        fontVariantNumeric: "tabular-nums",
                        color: balance > 0 ? SEMANTIC.danger : SEMANTIC.success,
                      }}
                    >
                      ₹{Math.max(balance, 0).toFixed(2)}
                    </Typography>
                  </Box>
                </Box>

                {!isFullyPaid ? (
                  <>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid size={{ xs: 12, lg: 6 }}>
                        <TextField
                          fullWidth
                          label="Amount (INR)"
                          type="number"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, lg: 6 }}>
                        <TextField
                          select
                          fullWidth
                          label="Payment Method"
                          value={paymentMethodId}
                          onChange={(e) => setPaymentMethodId(e.target.value)}
                        >
                          {paymentMethods.map(m => (
                            <MenuItem key={m.paymentMethodId} value={m.paymentMethodId}>{m.methodName}</MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth
                          label="Transaction reference (optional)"
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                        />
                      </Grid>
                    </Grid>
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
                      {paying ? "Processing..." : `Collect ₹${Number(paymentAmount || 0).toFixed(2)}`}
                    </Button>
                  </>
                ) : (
                  <Box sx={{ textAlign: "center", py: 3 }}>
                    <CheckCircleRounded sx={{ fontSize: 56, color: SEMANTIC.success, mb: 1.5 }} />
                    <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700 }}>Fully Paid</Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                      No further payments required for this invoice.
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Refunding is the same act wherever an invoice is opened, so
                  both this screen and the Billing panel's invoice view mount
                  the one component rather than each keeping its own copy. */}
              <RefundSection
                invoice={invoice}
                paymentMethods={paymentMethods}
                onChanged={fetchBillingData}
              />

              {!isFullyPaid && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <Typography
                    variant="overline"
                    sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 1, lineHeight: 1 }}
                  >
                    Adjust this invoice
                  </Typography>

                  <ActionSection
                    icon={<LocalOfferRounded fontSize="small" />}
                    label="Discount & tax"
                    accent={SEMANTIC.success}
                    open={openSection === "discount"}
                    onToggle={() => toggleSection("discount")}
                  >
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, lg: 6 }}>
                        <TextField
                          fullWidth size="small"
                          label="Discount (INR)"
                          type="number"
                          value={discountInput}
                          onChange={(e) => setDiscountInput(e.target.value)}
                          inputProps={{ min: 0 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, lg: 6 }}>
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
                      sx={{ mt: 2, color: SEMANTIC.success, borderColor: alpha(SEMANTIC.success, 0.5), fontWeight: 600 }}
                    >
                      {adjusting ? "Applying..." : "Apply discount & tax"}
                    </Button>
                  </ActionSection>

                  <ActionSection
                    icon={<AddCircleOutlineRounded fontSize="small" />}
                    label="Add a charge"
                    accent={SEMANTIC.info}
                    open={openSection === "charge"}
                    onToggle={() => toggleSection("charge")}
                  >
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1.5 }}>
                      Pick a rate-card charge (priced automatically), or type a custom line below.
                    </Typography>
                    <Button
                      fullWidth size="small" variant="outlined"
                      onClick={() => setSocPickerOpen(true)} disabled={addingItem}
                      sx={{ mb: 2, textTransform: "none", color: BRAND.action, borderColor: alpha(BRAND.action, 0.4), fontWeight: 600 }}
                    >
                      Pick from Schedule of Charges
                    </Button>
                    <Divider sx={{ mb: 2 }}><Typography variant="caption" color="text.secondary">or</Typography></Divider>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth size="small"
                          label="Item description"
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
                          label="Unit price (INR)"
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
                      sx={{ mt: 2, color: SEMANTIC.info, borderColor: alpha(SEMANTIC.info, 0.5), fontWeight: 600 }}
                    >
                      {addingItem ? "Adding..." : "Add item"}
                    </Button>
                  </ActionSection>

                  {/* Last, and the only destructive one here. */}
                  {!invoice?.admissionId && invoice?.invoiceStatus !== "CANCELLED" && (
                    <ActionSection
                      icon={<BlockRounded fontSize="small" />}
                      label="Void invoice"
                      accent={SEMANTIC.danger}
                      open={openSection === "void"}
                      onToggle={() => toggleSection("void")}
                    >
                      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1.5 }}>
                        Cancels this invoice and frees its charges to be re-billed. Not available once any payment is collected (refund first).
                      </Typography>
                      {!showVoid ? (
                        <Button fullWidth variant="outlined" onClick={() => setShowVoid(true)}
                          sx={{ color: SEMANTIC.danger, borderColor: alpha(SEMANTIC.danger, 0.5), fontWeight: 600 }}>
                          Void invoice
                        </Button>
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
                              sx={{ bgcolor: SEMANTIC.danger, "&:hover": { bgcolor: SEMANTIC.dangerDark }, fontWeight: 700 }}>
                              {voiding ? "Voiding..." : "Confirm void"}
                            </Button>
                          </Box>
                        </>
                      )}
                    </ActionSection>
                  )}
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
