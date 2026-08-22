import { useRef, useState } from "react";
import { printHtml } from "@/utils/printHtml";
import { paidTotal, refundedTotal, balanceOf, isSettled, balanceFromRefunds } from "@/utils/invoiceMoney";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { formatINR, formatDate } from "@/utils/format";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, TextField, MenuItem, Grid,
} from "@mui/material";
import { CloseRounded, PrintRounded, PaymentRounded, CheckCircleRounded, BlockRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import type { InvoiceDetail, BillingLookups, InvoiceItem, Payment } from "@/types";
import BillDocument from "@/components/billing/BillDocument";
import RefundSection from "@/components/billing/RefundSection";
import HeartbeatLoader from "../HeartbeatLoader";
import { ListSkeleton } from "../TableRowsSkeleton";
import ErrorState from "../ErrorState";
import { useToast } from "@/providers/ToastContext";
import { SEMANTIC, BRAND } from "@/styles/accents";


interface Props {
  open: boolean;
  invoiceId: string;
  onClose: () => void;
  onChanged?: () => void;
  /** Hide the "Collect Payment" form — used by the read-only admin oversight view. */
  readOnly?: boolean;
}

export default function InvoiceViewDialog({ open, invoiceId, onClose, onChanged, readOnly = false }: Props) {
  const toast = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [amount, setAmount] = useState("");
  const [methodId, setMethodId] = useState("");
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const { data: lookups } = useQuery<BillingLookups>({
    queryKey: ["billing-lookups"],
    queryFn: async () => (await axiosInstance.get("/reception/billing/lookups")).data.data,
    enabled: open,
  });
  const { data: invoice, isLoading, isError, error, refetch } = useQuery<InvoiceDetail>({
    queryKey: ["invoice-detail", invoiceId],
    queryFn: async () => (await axiosInstance.get(`/reception/billing/invoices/${invoiceId}/detail`)).data.data,
    enabled: open && !!invoiceId,
  });

  const totalPaid = paidTotal(invoice);
  const totalRefunded = refundedTotal(invoice);
  const balance = invoice ? balanceOf(invoice) : 0;
  // How much of that balance is money handed back rather than money never
  // collected. Non-zero means this bill WAS settled and was then refunded.
  const reopenedByRefund = invoice ? balanceFromRefunds(invoice) : 0;
  const wholeBalanceIsRefund = reopenedByRefund > 0.005 && reopenedByRefund >= balance - 0.005;
  const fullyPaid = invoice?.paymentStatus?.statusCode === "PAID" || isSettled(invoice);

  const hp = invoice?.hospital;

  const pay = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0 || !methodId) return;
    setPaying(true);
    try {
      await axiosInstance.post(`/reception/billing/invoices/${invoiceId}/payment`, { amount: amt, paymentMethodId: methodId });
      toast.success("Payment recorded");
      setAmount("");
      await refetch();
      onChanged?.();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Payment failed"));
    } finally {
      setPaying(false);
    }
  };

  // A voidable invoice: OPD (not IPD), not already cancelled, and nothing net
  // collected on it. Voiding frees its charges to be re-billed correctly.
  const isCancelled = invoice?.invoiceStatus === "CANCELLED" || invoice?.paymentStatus?.statusCode === "CANCELLED";
  const canVoid = !readOnly && !!invoice && !invoice.admissionId && !isCancelled && (totalPaid - totalRefunded) <= 0.005;

  const voidInvoice = async () => {
    if (!window.confirm("Void this invoice? Its charges will return to unbilled so they can be re-invoiced. This can't be undone.")) return;
    setVoiding(true);
    try {
      await axiosInstance.post(`/reception/billing/invoices/${invoiceId}/cancel`);
      toast.success("Invoice voided");
      onChanged?.();
      onClose();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Could not void invoice"));
    } finally {
      setVoiding(false);
    }
  };

  const print = () => {
    if (!receiptRef.current) return;
    printHtml(receiptRef.current.innerHTML, {
      title: invoice?.invoiceNumber || "Receipt",
      extraCss: "@media print{@page{margin:1cm}body{font-family:Inter,Arial,sans-serif;color:#1f2937}}",
    });
  };

  const cell: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #eee", fontSize: 13 };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        Invoice {invoice?.invoiceNumber || ""}
        <Button onClick={onClose} sx={{ minWidth: 0, p: 1, color: "text.secondary" }}><CloseRounded /></Button>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? <ListSkeleton />
          : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
          : invoice ? (
            <>
              <Box ref={receiptRef}>
                <BillDocument
                  hospital={hp}
                  title="Payment Receipt"
                  metaLeft={[
                    { label: "Receipt", value: invoice.invoiceNumber },
                    { label: "Date", value: formatDate(invoice.invoiceDate) },
                  ]}
                  metaRight={[
                    { label: "Patient", value: invoice.patient ? `${invoice.patient.firstName} ${invoice.patient.lastName}` : "—" },
                    { label: "UHID", value: invoice.patient?.uhidNumber || "—" },
                  ]}
                  totals={{
                    subtotal: Number(invoice.grossAmount || 0),
                    discount: Number(invoice.discountAmount || 0),
                    tax: Number(invoice.taxAmount || 0), taxLabel: "Tax (CGST+SGST)",
                    cgst: Number(invoice.cgstAmount || 0), sgst: Number(invoice.sgstAmount || 0),
                    total: Number(invoice.netAmount || 0), paid: totalPaid, refunded: totalRefunded, balance,
                    balanceNote: reopenedByRefund > 0.005
                      ? (wholeBalanceIsRefund
                          ? "This bill was paid and then refunded — the balance is the refund, not an unpaid amount."
                          : `Includes ${formatINR(reopenedByRefund)} returned by refund.`)
                      : undefined,
                  }}
                  afterTotals={invoice.Payment?.length > 0 ? (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, marginBottom: 6 }}>PAYMENTS</div>
                      {invoice.Payment.map((p: Payment, i: number) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#4b5563", marginTop: 4 }}>
                          <span>{formatDate(p.createdAt)} · {p.paymentMethod?.methodName || "—"}</span>
                          <span>{formatINR(p.paidAmount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : undefined}
                >
                  {(() => {
                    const showHsn = invoice.InvoiceItem?.some((it: InvoiceItem) => it.hsnCode);
                    return (
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
                    <thead><tr>
                      <th style={{ ...cell, textAlign: "left", fontWeight: 700 }}>Description</th>
                      {showHsn && <th style={{ ...cell, textAlign: "left", fontWeight: 700 }}>HSN/SAC</th>}
                      <th style={{ ...cell, textAlign: "center", fontWeight: 700 }}>Qty</th>
                      <th style={{ ...cell, textAlign: "right", fontWeight: 700 }}>Amount</th>
                    </tr></thead>
                    <tbody>
                      {invoice.InvoiceItem?.map((it: InvoiceItem, i: number) => (
                        <tr key={i}>
                          <td style={cell}>{it.description}</td>
                          {showHsn && <td style={cell}>{it.hsnCode || "—"}</td>}
                          <td style={{ ...cell, textAlign: "center" }}>{it.quantity}</td>
                          <td style={{ ...cell, textAlign: "right" }}>{formatINR(it.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                    );
                  })()}
                </BillDocument>
              </Box>

              {/* Record payment (only if balance outstanding, and not in read-only oversight mode) */}
              {fullyPaid ? (
                <Box sx={{ mt: 3, display: "flex", alignItems: "center", justifyContent: "center", gap: 1, color: SEMANTIC.success }}>
                  <CheckCircleRounded /> <Typography sx={{ fontWeight: 700 }}>Fully paid</Typography>
                </Box>
              ) : readOnly ? (
                <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: "rgba(239,68,68,0.06)", border: "1px dashed rgba(239,68,68,0.3)", textAlign: "center" }}>
                  <Typography variant="body2" sx={{ color: SEMANTIC.danger, fontWeight: 700 }}>Balance due: {formatINR(balance)}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Collect payment from the Billing panel</Typography>
                </Box>
              ) : (
                <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: "rgba(16,185,129,0.06)", border: "1px dashed rgba(16,185,129,0.3)" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: SEMANTIC.success, mb: wholeBalanceIsRefund ? 1 : 1.5 }}>
                    {wholeBalanceIsRefund ? "Collect Payment again" : "Collect Payment"}
                  </Typography>
                  {/* Without this the box is identical to a never-paid bill, so
                      collect → refund → collect → refund runs indefinitely with
                      nothing on screen saying a round trip already happened. */}
                  {wholeBalanceIsRefund && (
                    <Typography variant="caption" sx={{ display: "block", mb: 1.5, color: SEMANTIC.warning, fontWeight: 600 }}>
                      {formatINR(totalRefunded)} was already refunded on this bill. Taking payment again starts a new
                      payment, which can then be refunded again — only do this if the patient is genuinely paying once more.
                    </Typography>
                  )}
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 5 }}>
                      <TextField fullWidth size="small" type="number" label="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(balance.toFixed(2))}
                        inputProps={{ min: 0, max: balance, step: "0.01" }}
                        error={Number(amount) > balance + 0.005}
                        helperText={Number(amount) > balance + 0.005 ? `Max ₹${balance.toFixed(2)}` : " "} />
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <TextField select fullWidth size="small" label="Method" value={methodId} onChange={(e) => setMethodId(e.target.value)}>
                        {(lookups?.methods || []).map((m) => <MenuItem key={m.paymentMethodId} value={m.paymentMethodId}>{m.methodName}</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                      <Button fullWidth variant="contained" disabled={paying || !amount || Number(amount) <= 0 || Number(amount) > balance + 0.005 || !methodId} onClick={pay}
                        startIcon={paying ? <HeartbeatLoader size={22} /> : <PaymentRounded />}
                        sx={{ height: 40, bgcolor: SEMANTIC.success, "&:hover": { bgcolor: SEMANTIC.successDark } }}>Pay</Button>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Button size="small" onClick={() => setAmount(balance.toFixed(2))} sx={{ textTransform: "none", color: wholeBalanceIsRefund ? "text.secondary" : SEMANTIC.success, p: 0, minWidth: 0 }}>
                        {wholeBalanceIsRefund ? "Charge again" : "Pay full balance"} ({formatINR(balance)})
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* Refunding belongs to the INVOICE, not to the appointment that
                  created it — this dialog is the only way most invoices are ever
                  opened (IPD bills and hand-generated OPD invoices have no
                  appointment at all). */}
              <RefundSection
                invoice={invoice}
                readOnly={readOnly}
                paymentMethods={lookups?.methods ?? []}
                onChanged={async () => { await refetch(); onChanged?.(); }}
              />
            </>
          ) : null}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">Close</Button>
        {canVoid && (
          <Button variant="outlined" color="error" startIcon={<BlockRounded />} disabled={voiding} onClick={voidInvoice}
            sx={{ mr: "auto" }}>{voiding ? "Voiding…" : "Void invoice"}</Button>
        )}
        {invoice?.admissionId && (
          <Button variant="outlined" startIcon={<PrintRounded />} disabled={!invoice}
            onClick={() => window.open(`/reception/billing/invoices/${invoiceId}/ip-bill/print`, "_blank")}
            sx={{ borderColor: BRAND.action, color: BRAND.actionDark }}>Print IP Bill</Button>
        )}
        <Button variant="contained" startIcon={<PrintRounded />} disabled={!invoice} onClick={print}>{invoice?.admissionId ? "Receipt" : "Print"}</Button>
      </DialogActions>
    </Dialog>
  );
}
