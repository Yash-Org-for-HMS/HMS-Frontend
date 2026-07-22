import { useEffect, useState } from "react";
import { getApiErrorMessage } from "@/utils/apiError";
import { useParams } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import { axiosInstance } from "@/api/axios";
import { formatINR } from "@/utils/format";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import BillDocument from "@/components/billing/BillDocument";
import { NEUTRAL } from "@/styles/accents";

// Printable A4 in-patient bill. Hospitals print on their own pre-printed
// letterhead stationery, so we render NO logo/branding — just a fixed blank top
// gap for the letterhead, then the bill body (meta grid, Bill-To, categorized
// itemized table with subtotals, totals).

const CATEGORY_ORDER = [
  "ADMISSION", "ROOM", "PROCEDURE", "INVESTIGATION", "RADIOLOGY", "DOCTOR_VISIT", "PHARMACY", "OTHER",
];
const CATEGORY_LABEL: Record<string, string> = {
  ADMISSION: "Admission Charges",
  ROOM: "Room Charges",
  PROCEDURE: "Procedures",
  INVESTIGATION: "Investigation Charges",
  RADIOLOGY: "Radiology Charges",
  DOCTOR_VISIT: "Doctor Visit Charges",
  PHARMACY: "Pharmacy",
  OTHER: "Other Charges",
};

// Fallback category when a legacy line has no stored `category`: mirror the
// description-prefix rule used elsewhere (analytics), so old invoices still group.
function deriveCategory(item: any): string {
  if (item.category && CATEGORY_LABEL[item.category]) return item.category;
  const d = String(item.description || "");
  if (d.startsWith("Bed charges")) return "ROOM";
  if (d.startsWith("Pharmacy")) return "PHARMACY";
  if (d.startsWith("Radiology")) return "RADIOLOGY";
  if (d.startsWith("Lab")) return "INVESTIGATION";
  if (d.startsWith("Consultation") || d.startsWith("Doctor")) return "DOCTOR_VISIT";
  return "OTHER";
}

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

function ageSex(patient: any): string {
  if (!patient) return "—";
  const sex = patient.genderId === 1 ? "M" : patient.genderId === 2 ? "F" : "O";
  const age = patient.dateOfBirth
    ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / 31557600000)
    : null;
  return age != null ? `${sex} / ${age}Y` : sex;
}

export default function PrintIpBill() {
  const { invoiceId } = useParams();
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await axiosInstance.get(`/reception/billing/invoices/${invoiceId}/detail`);
        setInv(res.data.data);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, "Failed to load this bill"));
      } finally {
        setLoading(false);
      }
    })();
  }, [invoiceId]);

  useEffect(() => {
    if (!loading && inv) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [loading, inv]);

  if (loading) return <DetailSkeleton />;
  if (error) return <Typography color="error" sx={{ p: 4 }}>{error}</Typography>;
  if (!inv) return <Typography sx={{ p: 4 }}>Bill not found</Typography>;

  const patient = inv.patient;
  const adm = inv.admission;
  const items: any[] = inv.InvoiceItem || [];

  // Group by category (in canonical order) with per-group subtotals.
  const groups = CATEGORY_ORDER
    .map((cat) => {
      const rows = items.filter((it) => deriveCategory(it) === cat);
      const subtotal = rows.reduce((s, it) => s + Number(it.totalPrice || 0), 0);
      return { cat, rows, subtotal };
    })
    .filter((g) => g.rows.length > 0);

  const totalPaid = (inv.Payment || []).reduce((s: number, p: any) => s + Number(p.paidAmount || 0), 0);
  const totalRefunded = (inv.Refund || []).reduce((s: number, r: any) => s + Number(r.refundAmount || 0), 0);
  const netPaid = totalPaid - totalRefunded;
  const balance = Number(inv.netAmount || 0) - netPaid;

  const patientAddress = patient
    ? [patient.addressLine1, patient.addressLine2, patient.city, patient.district, patient.state, patient.postalCode].filter(Boolean).join(", ")
    : "";

  const cell: React.CSSProperties = { padding: "5px 8px", fontSize: 12, borderBottom: "1px solid #e5e7eb" };
  const th: React.CSSProperties = { ...cell, fontWeight: 700, background: "#f8fafc", borderBottom: "1.5px solid #cbd5e1", textAlign: "right" };

  return (
    <Box sx={{
      width: "210mm", minHeight: "297mm", margin: "0 auto", bgcolor: "white", color: "#111827",
      px: "18mm", pb: "15mm", pt: 0, boxSizing: "border-box", fontFamily: "'Inter', Arial, sans-serif",
      "@media screen": { boxShadow: "0 4px 12px rgba(0,0,0,0.12)", my: 4 },
      "@media print": { margin: 0, boxShadow: "none", width: "100%" },
    }}>
      <BillDocument
        variant="letterhead"
        title="Final IP Bill"
        metaLeft={[
          { label: "UHID", value: patient?.uhidNumber },
          { label: "Patient", value: patient ? `${patient.firstName || ""} ${patient.lastName || ""} (${ageSex(patient)})` : "—" },
          { label: "Contact", value: patient?.phone },
          { label: "Consultant", value: adm?.consultantName },
        ]}
        metaRight={[
          { label: "Bill No", value: inv.invoiceNumber },
          { label: "Bill Date", value: fmtDateTime(inv.invoiceDate) },
          { label: "IP ID", value: adm?.admissionNumber },
          { label: "DOA", value: fmtDateTime(adm?.admissionDate) },
          { label: "DOD", value: fmtDateTime(adm?.dischargeDate) },
        ]}
        totals={{
          subtotal: Number(inv.grossAmount || 0),
          discount: Number(inv.discountAmount || 0),
          tax: Number(inv.taxAmount || 0), taxLabel: "Tax (CGST+SGST)",
          total: Number(inv.netAmount || 0), paid: totalPaid, refunded: totalRefunded, balance,
        }}
        footer={
          <span style={{ display: "flex", justifyContent: "space-between", width: "100%", fontStyle: "normal", color: "#6b7280" }}>
            <span>Bill No: {inv.invoiceNumber}</span>
            <span>Printed: {fmtDateTime(new Date().toISOString())}</span>
          </span>
        }
      >
        {/* Bill To */}
        <div style={{ marginBottom: 16, padding: 10, border: "1px solid #e5e7eb", borderRadius: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5 }}>BILL TO</div>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{patient ? `${patient.firstName || ""} ${patient.lastName || ""}` : "—"}</div>
          {patientAddress && <div style={{ fontSize: 11.5, color: "#4b5563" }}>{patientAddress}</div>}
        </div>

        {/* Itemized, categorized table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left", width: "9%" }}>Date</th>
              <th style={{ ...th, textAlign: "left", width: "37%" }}>Service Name</th>
              <th style={{ ...th, width: "6%" }}>Qty</th>
              <th style={{ ...th }}>Rate</th>
              <th style={{ ...th }}>Gross</th>
              <th style={{ ...th, width: "7%" }}>Disc %</th>
              <th style={{ ...th }}>Disc Amt</th>
              <th style={{ ...th }}>Net Amt</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <GroupBlock key={g.cat} label={CATEGORY_LABEL[g.cat]} rows={g.rows} subtotal={g.subtotal} cell={cell} />
            ))}
            {groups.length === 0 && (
              <tr><td colSpan={8} style={{ ...cell, textAlign: "center", color: "#9ca3af" }}>No charges on this bill</td></tr>
            )}
          </tbody>
        </table>
      </BillDocument>
    </Box>
  );
}

function GroupBlock({ label, rows, subtotal, cell }: { label: string; rows: any[]; subtotal: number; cell: React.CSSProperties }) {
  const num: React.CSSProperties = { ...cell, textAlign: "right" };
  return (
    <>
      <tr>
        <td colSpan={8} style={{ ...cell, fontWeight: 700, background: NEUTRAL.subtle, textTransform: "uppercase", fontSize: 11, letterSpacing: 0.5 }}>{label}</td>
      </tr>
      {rows.map((it, i) => {
        const gross = it.grossAmount != null ? Number(it.grossAmount) : Number(it.totalPrice || 0);
        const disc = Number(it.discountAmount || 0);
        const discPct = gross > 0 && disc > 0 ? ((disc / gross) * 100).toFixed(1) : "—";
        return (
          <tr key={it.invoiceItemId || i}>
            <td style={{ ...cell }}>{it.itemDate ? fmtDate(it.itemDate) : "—"}</td>
            <td style={{ ...cell }}>{it.description}</td>
            <td style={{ ...cell, textAlign: "center" }}>{it.quantity}</td>
            <td style={num}>{formatINR(it.unitPrice)}</td>
            <td style={num}>{formatINR(gross)}</td>
            <td style={{ ...cell, textAlign: "center" }}>{discPct === "—" ? "—" : `${discPct}%`}</td>
            <td style={num}>{disc > 0 ? formatINR(disc) : "—"}</td>
            <td style={{ ...num, fontWeight: 600 }}>{formatINR(it.totalPrice)}</td>
          </tr>
        );
      })}
      <tr>
        <td colSpan={7} style={{ ...cell, textAlign: "right", fontWeight: 700, fontSize: 11.5 }}>{label} subtotal</td>
        <td style={{ ...cell, textAlign: "right", fontWeight: 700 }}>{formatINR(subtotal)}</td>
      </tr>
    </>
  );
}
