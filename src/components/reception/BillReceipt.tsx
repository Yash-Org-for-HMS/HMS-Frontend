import { Box, Typography } from "@mui/material";

interface Props {
  invoice: any;
  hospitalProfile: any;
  hospital: any;
  patientName: string;
  appointmentDate: string;
}

/**
 * The printable payment-receipt body (header, meta, itemized table, totals,
 * payment/refund history, PAID watermark). Extracted from BillingModal — it's
 * purely presentational and derives its totals from `invoice`, so the modal now
 * just wraps it in the ref'd Paper it prints from. Behavior/markup unchanged.
 */
export default function BillReceipt({ invoice, hospitalProfile, hospital, patientName, appointmentDate }: Props) {
  const totalPaid = invoice?.Payment?.reduce((sum: number, p: any) => sum + Number(p.paidAmount), 0) || 0;
  const totalRefunded = invoice?.Refund?.reduce((sum: number, r: any) => sum + Number(r.refundAmount), 0) || 0;
  const netPaid = totalPaid - totalRefunded;
  const grossAmount = Number(invoice?.grossAmount || 0);
  const discountAmount = Number(invoice?.discountAmount || 0);
  const taxAmount = Number(invoice?.taxAmount || 0);
  const netAmount = Number(invoice?.netAmount || 0);
  const balance = netAmount - netPaid;
  const isFullyPaid = invoice?.paymentStatus?.statusCode === "PAID" || balance <= 0;

  return (
    <>
      {/* Print Header */}
      {(() => {
        const addressLine = [hospitalProfile?.addressLine1, hospitalProfile?.addressLine2, hospitalProfile?.postalCode].filter(Boolean).join(", ");
        const contactLine = [
          hospitalProfile?.officialPhone ? `Phone: ${hospitalProfile.officialPhone}` : null,
          hospitalProfile?.officialEmail ? hospitalProfile.officialEmail : null,
        ].filter(Boolean).join(" | ");
        return (
          <Box className="header" sx={{ textAlign: "center", mb: 4, borderBottom: "2px solid #3b82f6", pb: 3 }}>
            <Typography className="hospital-name" variant="h4" sx={{ fontWeight: 900, color: "#1e3a8a", letterSpacing: 1 }}>
              {hospitalProfile?.hospitalName || hospital?.name || "Hospital"}
            </Typography>
            {addressLine && (
              <Typography className="hospital-info" variant="body2" sx={{ color: "#6b7280", mt: 0.5 }}>{addressLine}</Typography>
            )}
            {contactLine && (
              <Typography className="hospital-info" variant="body2" sx={{ color: "#6b7280" }}>{contactLine}</Typography>
            )}
            <Typography className="receipt-title" variant="subtitle1" sx={{ mt: 3, fontWeight: 800, letterSpacing: 3, color: "#3b82f6" }}>PAYMENT RECEIPT</Typography>
          </Box>
        );
      })()}

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
        <Box className="total-row" sx={{ display: "flex", justifyContent: "space-between", mb: 1, color: "#4b5563" }}>
          <Typography variant="body2">Subtotal:</Typography>
          <Typography variant="body2">{grossAmount.toFixed(2)} INR</Typography>
        </Box>
        {discountAmount > 0 && (
          <Box className="total-row" sx={{ display: "flex", justifyContent: "space-between", mb: 1, color: "#059669" }}>
            <Typography variant="body2">Discount:</Typography>
            <Typography variant="body2">- {discountAmount.toFixed(2)} INR</Typography>
          </Box>
        )}
        {taxAmount > 0 && (
          <Box className="total-row" sx={{ display: "flex", justifyContent: "space-between", mb: 1, color: "#4b5563" }}>
            <Typography variant="body2">Tax (CGST + SGST):</Typography>
            <Typography variant="body2">+ {taxAmount.toFixed(2)} INR</Typography>
          </Box>
        )}
        <Box className="total-row bold" sx={{ display: "flex", justifyContent: "space-between", mt: 1, mb: 1, pt: 1, borderTop: "1px dashed #d1d5db" }}>
          <Typography variant="body1" sx={{ fontWeight: 800 }}>Total Amount:</Typography>
          <Typography variant="body1" sx={{ fontWeight: 800 }}>{netAmount.toFixed(2)} INR</Typography>
        </Box>
        <Box className="total-row" sx={{ display: "flex", justifyContent: "space-between", mb: 1, color: "#4b5563" }}>
          <Typography variant="body2">Amount Paid:</Typography>
          <Typography variant="body2">{totalPaid.toFixed(2)} INR</Typography>
        </Box>
        {totalRefunded > 0 && (
          <Box className="total-row" sx={{ display: "flex", justifyContent: "space-between", mb: 1, color: "#8b5cf6" }}>
            <Typography variant="body2">Refunded:</Typography>
            <Typography variant="body2">- {totalRefunded.toFixed(2)} INR</Typography>
          </Box>
        )}
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

      {/* Refund History */}
      {invoice.Refund?.length > 0 && (
        <Box sx={{ borderTop: "1px solid #e5e7eb", pt: 3, mb: 3 }}>
          <Typography variant="caption" sx={{ fontWeight: 800, display: "block", mb: 2, color: "#6b7280", letterSpacing: 1 }}>REFUNDS</Typography>
          {invoice.Refund.map((r: any, idx: number) => (
            <Box key={idx} sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="caption" sx={{ color: "#4b5563" }}>
                {r.processedAt ? new Date(r.processedAt).toLocaleDateString() : "—"} • {r.refundReason || "Refund"}
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "#8b5cf6" }}>
                - {Number(r.refundAmount).toFixed(2)} INR
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {isFullyPaid && totalRefunded <= 0 && (
        <Typography className="watermark" variant="h1">PAID</Typography>
      )}

      <Typography variant="caption" sx={{ display: "block", textAlign: "center", color: "#9ca3af", mt: 6, fontStyle: "italic" }}>
        Thank you for your visit. Get well soon!
      </Typography>
    </>
  );
}
