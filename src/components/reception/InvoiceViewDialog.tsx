import { useRef, useState } from "react";
import { formatINR } from "../../utils/format";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Divider,
  Chip, TextField, MenuItem, Grid,
} from "@mui/material";
import { CloseRounded, PrintRounded, PaymentRounded, CheckCircleRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import HeartbeatLoader from "../HeartbeatLoader";
import { ListSkeleton } from "../TableRowsSkeleton";
import ErrorState from "../ErrorState";
import { useToast } from "../../contexts/ToastContext";


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

  const { data: lookups } = useQuery({
    queryKey: ["billing-lookups"],
    queryFn: async () => (await axiosInstance.get("/reception/billing/lookups")).data.data,
    enabled: open,
  });
  const { data: invoice, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["invoice-detail", invoiceId],
    queryFn: async () => (await axiosInstance.get(`/reception/billing/invoices/${invoiceId}/detail`)).data.data,
    enabled: open && !!invoiceId,
  });

  const totalPaid = invoice?.Payment?.reduce((s: number, p: any) => s + Number(p.paidAmount), 0) || 0;
  const totalRefunded = invoice?.Refund?.reduce((s: number, r: any) => s + Number(r.refundAmount), 0) || 0;
  const balance = invoice ? Number(invoice.netAmount) - (totalPaid - totalRefunded) : 0;
  const fullyPaid = invoice?.paymentStatus?.statusCode === "PAID" || balance <= 0.005;

  const hp = invoice?.hospital;
  const addressLine = [hp?.addressLine1, hp?.addressLine2, hp?.postalCode].filter(Boolean).join(", ");

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
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const print = () => {
    if (!receiptRef.current) return;
    const headStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map((el) => el.outerHTML).join("");
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open();
    doc.write(`<!doctype html><html><head><title>${invoice?.invoiceNumber || "Receipt"}</title>${headStyles}<style>@media print{@page{margin:1cm}body{font-family:Inter,Arial,sans-serif;color:#1f2937}}</style></head><body>${receiptRef.current.innerHTML}</body></html>`);
    doc.close();
    const win = iframe.contentWindow!;
    const cleanup = () => { if (iframe.parentNode) document.body.removeChild(iframe); };
    win.onafterprint = cleanup;
    setTimeout(() => { win.focus(); win.print(); setTimeout(cleanup, 1000); }, 300);
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
          : isError ? <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
          : invoice ? (
            <>
              <Box ref={receiptRef}>
                <Box sx={{ textAlign: "center", borderBottom: "2px solid #0891b2", pb: 1.5, mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: "#0e7490" }}>{hp?.hospitalName || "Hospital"}</Typography>
                  {addressLine && <Typography variant="caption" sx={{ color: "#6b7280", display: "block" }}>{addressLine}</Typography>}
                  <Typography variant="caption" sx={{ color: "#3b82f6", fontWeight: 700, letterSpacing: 2 }}>PAYMENT RECEIPT</Typography>
                </Box>

                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2, fontSize: 13 }}>
                  <Box>
                    <div><strong>Receipt:</strong> {invoice.invoiceNumber}</div>
                    <div><strong>Date:</strong> {new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}</div>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <div><strong>Patient:</strong> {invoice.patient ? `${invoice.patient.firstName} ${invoice.patient.lastName}` : "—"}</div>
                    <div><strong>UHID:</strong> {invoice.patient?.uhidNumber || "—"}</div>
                  </Box>
                </Box>

                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
                  <thead><tr>
                    <th style={{ ...cell, textAlign: "left", fontWeight: 700 }}>Description</th>
                    <th style={{ ...cell, textAlign: "center", fontWeight: 700 }}>Qty</th>
                    <th style={{ ...cell, textAlign: "right", fontWeight: 700 }}>Amount</th>
                  </tr></thead>
                  <tbody>
                    {invoice.InvoiceItem?.map((it: any, i: number) => (
                      <tr key={i}>
                        <td style={cell}>{it.description}</td>
                        <td style={{ ...cell, textAlign: "center" }}>{it.quantity}</td>
                        <td style={{ ...cell, textAlign: "right" }}>{formatINR(it.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <Box sx={{ borderTop: "2px solid #1f2937", pt: 1 }}>
                  <Row label="Subtotal" value={formatINR(invoice.grossAmount)} />
                  {Number(invoice.discountAmount) > 0 && <Row label="Discount" value={`- ${formatINR(invoice.discountAmount)}`} color="#059669" />}
                  {Number(invoice.taxAmount) > 0 && <Row label="Tax (CGST+SGST)" value={`+ ${formatINR(invoice.taxAmount)}`} />}
                  <Row label="Total" value={formatINR(invoice.netAmount)} bold />
                  <Row label="Paid" value={formatINR(totalPaid)} />
                  {totalRefunded > 0 && <Row label="Refunded" value={`- ${formatINR(totalRefunded)}`} color="#8b5cf6" />}
                  <Row label="Balance" value={formatINR(balance)} bold color={balance > 0.005 ? "#ef4444" : "#10b981"} />
                </Box>

                {invoice.Payment?.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "#6b7280", letterSpacing: 1 }}>PAYMENTS</Typography>
                    {invoice.Payment.map((p: any, i: number) => (
                      <Box key={i} sx={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#4b5563", mt: 0.5 }}>
                        <span>{new Date(p.createdAt).toLocaleDateString("en-IN")} · {p.paymentMethod?.methodName || "—"}</span>
                        <span>{formatINR(p.paidAmount)}</span>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              {/* Record payment (only if balance outstanding, and not in read-only oversight mode) */}
              {fullyPaid ? (
                <Box sx={{ mt: 3, display: "flex", alignItems: "center", justifyContent: "center", gap: 1, color: "#10b981" }}>
                  <CheckCircleRounded /> <Typography sx={{ fontWeight: 700 }}>Fully paid</Typography>
                </Box>
              ) : readOnly ? (
                <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: "rgba(239,68,68,0.06)", border: "1px dashed rgba(239,68,68,0.3)", textAlign: "center" }}>
                  <Typography variant="body2" sx={{ color: "#ef4444", fontWeight: 700 }}>Balance due: {formatINR(balance)}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Collect payment from the Billing panel</Typography>
                </Box>
              ) : (
                <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: "rgba(16,185,129,0.06)", border: "1px dashed rgba(16,185,129,0.3)" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#10b981", mb: 1.5 }}>Collect Payment</Typography>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 5 }}>
                      <TextField fullWidth size="small" type="number" label="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(balance.toFixed(2))}
                        inputProps={{ min: 0, max: balance, step: "0.01" }}
                        error={Number(amount) > balance + 0.005}
                        helperText={Number(amount) > balance + 0.005 ? `Max ₹${balance.toFixed(2)}` : " "} />
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <TextField select fullWidth size="small" label="Method" value={methodId} onChange={(e) => setMethodId(e.target.value)}>
                        {(lookups?.methods || []).map((m: any) => <MenuItem key={m.paymentMethodId} value={m.paymentMethodId}>{m.methodName}</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                      <Button fullWidth variant="contained" disabled={paying || !amount || Number(amount) <= 0 || Number(amount) > balance + 0.005 || !methodId} onClick={pay}
                        startIcon={paying ? <HeartbeatLoader size={22} /> : <PaymentRounded />}
                        sx={{ height: 40, bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" } }}>Pay</Button>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Button size="small" onClick={() => setAmount(balance.toFixed(2))} sx={{ textTransform: "none", color: "#10b981", p: 0, minWidth: 0 }}>Pay full balance ({formatINR(balance)})</Button>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </>
          ) : null}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">Close</Button>
        <Button variant="contained" startIcon={<PrintRounded />} disabled={!invoice} onClick={print} sx={{ bgcolor: "#0891b2", "&:hover": { bgcolor: "#0e7490" } }}>Print</Button>
      </DialogActions>
    </Dialog>
  );
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", my: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: bold ? 800 : 400, color: color || "text.secondary" }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: bold ? 800 : 600, color: color || "text.primary" }}>{value}</Typography>
    </Box>
  );
}
