import type { CSSProperties } from "react";
import { formatINR } from "@/utils/format";
import BillDocument from "@/components/billing/BillDocument";

/**
 * The document a patient is handed when money is returned to them.
 *
 * Built on the shared <BillDocument> so it carries the same hospital header,
 * type and spacing as the bill it reverses — a refund slip that looked like a
 * different system's output would be the first thing a patient distrusts.
 *
 * Two things it must state plainly, because they are what a patient checks:
 * how much came back, and how it was sent. The rest ties the refund to the bill
 * it came from so the desk can reconcile it later.
 */
export interface RefundReceiptData {
  refundNumber?: string | null;
  refundAmount: string | number;
  refundReason?: string | null;
  referenceNumber?: string | null;
  processedAt?: string | null;
  refundMethod?: string | null;
  /** True when no method was recorded and the original payment's was assumed. */
  refundMethodAssumed?: boolean;
  processedByName?: string | null;
  approvedByName?: string | null;
  invoice?: { invoiceNumber?: string | null; invoiceDate?: string | null; netAmount?: string | number | null } | null;
  originalPayment?: { paidAmount?: string | number | null; method?: string | null; reference?: string | null; paidAt?: string | null } | null;
  patient?: { name?: string | null; uhid?: string | null; phone?: string | null } | null;
  hospital?: {
    hospitalName?: string | null; addressLine1?: string | null; city?: string | null;
    officialPhone?: string | null; officialEmail?: string | null; gstNumber?: string | null;
  } | null;
}

const th: CSSProperties = { padding: "10px 8px", borderBottom: "2px solid #e5e7eb", color: "#4b5563", textTransform: "uppercase", fontSize: 12, fontWeight: 700, textAlign: "left" };
const td: CSSProperties = { padding: "10px 8px", borderBottom: "1px solid #f3f4f6", fontSize: 13 };

const date = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const dateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function RefundReceipt({ data }: { data: RefundReceiptData }) {
  const amount = Number(data.refundAmount ?? 0);

  return (
    <BillDocument
      variant="receipt"
      hospital={{
        hospitalName: data.hospital?.hospitalName,
        addressLine1: data.hospital?.addressLine1,
        addressLine2: data.hospital?.city,
        officialPhone: data.hospital?.officialPhone,
        officialEmail: data.hospital?.officialEmail,
        gstNumber: data.hospital?.gstNumber,
      }}
      title="Refund Receipt"
      metaLeft={[
        { label: "Refund No.", value: data.refundNumber || "—" },
        { label: "Refunded on", value: dateTime(data.processedAt) },
        { label: "Against invoice", value: data.invoice?.invoiceNumber || "—" },
      ]}
      metaRight={[
        { label: "Patient", value: data.patient?.name || "—" },
        { label: "UHID", value: data.patient?.uhid || "—" },
        { label: "Phone", value: data.patient?.phone || "—" },
      ]}
      // Just the one figure. Passing `refunded` as well printed "Total ₹2,450"
      // above "Refunded −₹2,450", which reads as a ₹2,450 bill that was then
      // refunded to nil rather than as ₹2,450 handed back.
      totals={{ total: amount }}
      afterTotals={
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#6b7280", letterSpacing: 1, marginBottom: 8 }}>
            HOW THIS REFUND WAS SENT
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#4b5563", marginBottom: 4 }}>
            <span>
              {data.refundMethod || "—"}
              {data.referenceNumber ? ` (Ref: ${data.referenceNumber})` : ""}
            </span>
            <span style={{ fontWeight: 700 }}>{formatINR(amount)}</span>
          </div>
          {/* Say so when the method was inferred rather than recorded, instead of
              printing a guess as though it were fact. */}
          {data.refundMethodAssumed && (
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              Method not recorded — shown as the original payment's method.
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 800, color: "#6b7280", letterSpacing: 1, margin: "14px 0 8px" }}>
            THE PAYMENT THIS REVERSES
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#4b5563" }}>
            <span>
              {date(data.originalPayment?.paidAt)} • {data.originalPayment?.method || "—"}
              {data.originalPayment?.reference ? ` (Ref: ${data.originalPayment.reference})` : ""}
            </span>
            <span style={{ fontWeight: 700 }}>{formatINR(Number(data.originalPayment?.paidAmount ?? 0))}</span>
          </div>
        </div>
      }
      footer={
        <div style={{ fontSize: 11, color: "#6b7280" }}>
          <div style={{ marginBottom: 4 }}>
            Processed by {data.processedByName || "—"}
            {data.approvedByName ? ` · approved by ${data.approvedByName}` : ""}
          </div>
          <div>This receipt confirms money returned to the patient. Please retain it.</div>
        </div>
      }
    >
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <thead>
          <tr>
            <th style={th}>Refund for</th>
            <th style={{ ...th, textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={td}>
              {data.refundReason || "Refund"}
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                Invoice {data.invoice?.invoiceNumber || "—"} dated {date(data.invoice?.invoiceDate)}
                {data.invoice?.netAmount != null ? ` · bill ${formatINR(Number(data.invoice.netAmount))}` : ""}
              </div>
            </td>
            <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{formatINR(amount)}</td>
          </tr>
        </tbody>
      </table>
    </BillDocument>
  );
}
