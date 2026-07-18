import type { CSSProperties } from "react";
import { formatINR } from "@/utils/format";
import BillDocument from "@/components/billing/BillDocument";

interface Props {
  invoice: any;
  hospitalProfile: any;
  hospital: any;
  patientName: string;
  appointmentDate: string;
}

const thBase: CSSProperties = { padding: "10px 8px", borderBottom: "2px solid #e5e7eb", color: "#4b5563", textTransform: "uppercase", fontSize: 12, fontWeight: 700 };
const tdBase: CSSProperties = { padding: "10px 8px", borderBottom: "1px solid #f3f4f6", fontSize: 13 };

/**
 * OPD payment receipt — now a thin composition of the shared <BillDocument> so
 * it matches the IPD bill and invoice views. Only the line-item table is local.
 */
export default function BillReceipt({ invoice, hospitalProfile, hospital, patientName, appointmentDate }: Props) {
  const totalPaid = invoice?.Payment?.reduce((s: number, p: any) => s + Number(p.paidAmount), 0) || 0;
  const totalRefunded = invoice?.Refund?.reduce((s: number, r: any) => s + Number(r.refundAmount), 0) || 0;
  const netPaid = totalPaid - totalRefunded;
  const netAmount = Number(invoice?.netAmount || 0);
  const balance = netAmount - netPaid;
  const isFullyPaid = invoice?.paymentStatus?.statusCode === "PAID" || balance <= 0;

  const afterTotals = (
    <>
      {invoice.Payment?.length > 0 && (
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#6b7280", letterSpacing: 1, marginBottom: 8 }}>PAYMENT HISTORY</div>
          {invoice.Payment.map((p: any, idx: number) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, color: "#4b5563" }}>
              <span>{new Date().toLocaleDateString()} • {p.paymentMethod?.methodName}{p.transactionReference ? ` (Ref: ${p.transactionReference})` : ""}</span>
              <span style={{ fontWeight: 700 }}>{formatINR(p.paidAmount)}</span>
            </div>
          ))}
        </div>
      )}
      {invoice.Refund?.length > 0 && (
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#6b7280", letterSpacing: 1, marginBottom: 8 }}>REFUNDS</div>
          {invoice.Refund.map((r: any, idx: number) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, color: "#4b5563" }}>
              <span>{r.processedAt ? new Date(r.processedAt).toLocaleDateString() : "—"} • {r.refundReason || "Refund"}</span>
              <span style={{ fontWeight: 700, color: "#8b5cf6" }}>- {formatINR(r.refundAmount)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <BillDocument
      hospital={{
        hospitalName: hospitalProfile?.hospitalName || hospital?.name,
        addressLine1: hospitalProfile?.addressLine1, addressLine2: hospitalProfile?.addressLine2,
        postalCode: hospitalProfile?.postalCode, officialPhone: hospitalProfile?.officialPhone,
        officialEmail: hospitalProfile?.officialEmail,
      }}
      title="Payment Receipt"
      metaLeft={[
        { label: "Receipt No", value: invoice.invoiceNumber },
        { label: "Date", value: new Date(invoice.invoiceDate).toLocaleDateString() },
      ]}
      metaRight={[
        { label: "Patient", value: patientName },
        { label: "Appt Date", value: new Date(appointmentDate).toLocaleDateString() },
      ]}
      totals={{
        subtotal: Number(invoice?.grossAmount || 0),
        discount: Number(invoice?.discountAmount || 0),
        tax: Number(invoice?.taxAmount || 0), taxLabel: "Tax (CGST + SGST)",
        total: netAmount, paid: totalPaid, refunded: totalRefunded, balance,
      }}
      afterTotals={afterTotals}
      paidWatermark={isFullyPaid && totalRefunded <= 0}
      footer="Thank you for your visit. Get well soon!"
    >
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
        <thead>
          <tr>
            <th style={{ ...thBase, textAlign: "left" }}>Description</th>
            <th style={{ ...thBase, textAlign: "center" }}>Qty</th>
            <th style={{ ...thBase, textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.InvoiceItem?.map((item: any, idx: number) => (
            <tr key={idx}>
              <td style={{ ...tdBase, textAlign: "left" }}>{item.description}</td>
              <td style={{ ...tdBase, textAlign: "center" }}>{item.quantity}</td>
              <td style={{ ...tdBase, textAlign: "right" }}>{formatINR(item.totalPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </BillDocument>
  );
}
