import { useRef } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box,
} from "@mui/material";
import { CloseRounded, PrintRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { formatINR, formatDate } from "@/utils/format";
import BillDocument from "@/components/billing/BillDocument";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import ErrorState from "@/components/ErrorState";
import { apiErrorText } from "@/utils/apiError";

interface Props {
  open: boolean;
  /** The source order id (labOrderId / radiologyOrderId) whose receipt to reprint. */
  serviceId: string;
  onClose: () => void;
}

/**
 * Read-only receipt reprint for a paid lab / radiology order. Uses the
 * lab-authorised /billing/receipt/:serviceId endpoint (the reception invoice
 * endpoints are off-limits to a LAB_TECH) and renders the shared <BillDocument>.
 */
export default function LabReceiptDialog({ open, serviceId, onClose }: Props) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const { data: invoice, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["lab-receipt", serviceId],
    queryFn: async () => (await axiosInstance.get(`/billing/receipt/${serviceId}`)).data.data,
    enabled: open && !!serviceId,
  });

  const totalPaid = invoice?.Payment?.reduce((s: number, p: any) => s + Number(p.paidAmount), 0) || 0;
  const totalRefunded = invoice?.Refund?.reduce((s: number, r: any) => s + Number(r.refundAmount), 0) || 0;
  const balance = invoice ? Number(invoice.netAmount) - (totalPaid - totalRefunded) : 0;
  const fullyPaid = invoice?.paymentStatus?.statusCode === "PAID" || balance <= 0.005;

  const cell: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #eee", fontSize: 13 };

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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        Receipt {invoice?.invoiceNumber || ""}
        <Button onClick={onClose} sx={{ minWidth: 0, p: 1, color: "text.secondary" }}><CloseRounded /></Button>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? <ListSkeleton />
          : isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
          : invoice ? (
            <Box ref={receiptRef}>
              <BillDocument
                hospital={invoice.hospital}
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
                  total: Number(invoice.netAmount || 0), paid: totalPaid, refunded: totalRefunded, balance,
                }}
                paidWatermark={fullyPaid && totalRefunded <= 0}
                afterTotals={invoice.Payment?.length > 0 ? (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, marginBottom: 6 }}>PAYMENTS</div>
                    {invoice.Payment.map((p: any, i: number) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#4b5563", marginTop: 4 }}>
                        <span>{formatDate(p.createdAt)} · {p.paymentMethod?.methodName || "—"}</span>
                        <span>{formatINR(p.paidAmount)}</span>
                      </div>
                    ))}
                  </div>
                ) : undefined}
              >
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
              </BillDocument>
            </Box>
          ) : null}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">Close</Button>
        <Button variant="contained" startIcon={<PrintRounded />} disabled={!invoice} onClick={print} sx={{ bgcolor: "#10B981", "&:hover": { bgcolor: "#059669" } }}>Print</Button>
      </DialogActions>
    </Dialog>
  );
}
