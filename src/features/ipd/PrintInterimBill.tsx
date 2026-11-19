import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Typography, Button } from "@mui/material";
import { PrintRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { formatDate, formatDateTime } from "@/utils/format";
import { getApiErrorMessage } from "@/utils/apiError";
import ErrorState from "@/components/ErrorState";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import { BillLetterhead, BillTitleBar, BillFooter } from "@/components/billing/BillDocument";
import { useLetterhead } from "@/hooks/useLetterhead";
import type { AdmissionDetail } from "./ipd.types";

/**
 * Printable interim bill for a patient still admitted: the stay's charges so
 * far, before the final bill exists (that is made only at discharge). Read
 * from the same admission detail the discharge screen previews, so the figure
 * here is the figure the discharge would bill today, before any price changed
 * or charge added on that screen. Not a tax invoice, and says so.
 */

const CATEGORY_ORDER = ["PACKAGE", "ADMISSION", "ROOM", "DOCTOR_VISIT", "PROCEDURE", "IMPLANT", "INVESTIGATION", "RADIOLOGY", "PHARMACY", "OTHER"];
const CATEGORY_LABEL: Record<string, string> = {
  ADMISSION: "Admission Charges", ROOM: "Room / Bed Charges", DOCTOR_VISIT: "Doctor Charges",
  PROCEDURE: "Procedures", IMPLANT: "Implants", INVESTIGATION: "Laboratory", RADIOLOGY: "Radiology / Imaging",
  PHARMACY: "Pharmacy & Medical Supplies", OTHER: "Other Charges", PACKAGE: "Package",
};
const PAYER_LABEL: Record<string, string> = { CASH: "Cash", INSURANCE: "Insurance", CORPORATE: "Corporate", GOVT_SCHEME: "Govt scheme" };

const INK = "#111827", SUB = "#6b7280", LINE = "#e5e7eb", HEAD = "#f1f5f9", ACCENT = "#0e7490";
const n = (v: unknown) => Number(v || 0);
const inr = (v: unknown) => {
  const x = n(v);
  const s = Math.abs(x).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return x < 0 ? `(₹${s})` : `₹${s}`;
};

type Line = { description: string; category: string; date?: string | null; qty: string; rate: number | null; taxable: number; tax: number; note?: string };

const MetaRow = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div style={{ display: "flex", gap: 6, marginBottom: 3, fontSize: 11.5 }}>
    <span style={{ color: SUB, minWidth: 96, fontWeight: 600 }}>{k}</span>
    <span style={{ color: INK, fontWeight: 500 }}>{v ?? "-"}</span>
  </div>
);
const TotalRow = ({ k, v, bold, color, big }: { k: string; v: string; bold?: boolean; color?: string; big?: boolean }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: big ? 14 : 12, fontWeight: bold ? 800 : 500, color: color || INK }}>
    <span>{k}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{v}</span>
  </div>
);

export default function PrintInterimBill() {
  const { admissionId } = useParams();
  const hospital = useLetterhead();
  const { data: a, isLoading, isError, error, refetch, dataUpdatedAt } = useQuery<AdmissionDetail>({
    queryKey: ["ipd-admission", admissionId],
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admissionId}`)).data.data,
  });
  // When these figures were read - the page renders only once they have been.
  const asOf = new Date(dataUpdatedAt).toISOString();

  const lines = useMemo<Line[]>(() => {
    if (!a) return [];
    const out: Line[] = [];
    // Room rent and nursing per run of one rate, named as the discharge bill names them.
    for (const seg of a.bedSegments || []) {
      if (!(seg.days > 0)) continue;
      const unit = seg.unit || "day";
      for (const run of seg.runs ?? []) {
        for (const [label, rate] of [["Room rent", n(run.rent)], ["Nursing", n(run.nursing)]] as const) {
          if (rate > 0) out.push({ description: `${label} - ${seg.label}`, category: "ROOM", date: run.from, qty: `${run.days} ${unit}${run.days === 1 ? "" : "s"}`, rate, taxable: rate * run.days, tax: 0 });
        }
      }
    }
    if (n(a.packageBedCovered) > 0) out.push({ description: "Covered by package", category: "ROOM", qty: "", rate: null, taxable: -n(a.packageBedCovered), tax: 0 });
    for (const c of a.pendingCharges || []) {
      out.push({
        description: c.description, category: c.category && CATEGORY_LABEL[c.category] ? c.category : "OTHER", date: c.itemDate,
        qty: String(c.quantity ?? 1), rate: c.blocked ? null : n(c.unitPrice), taxable: n(c.totalPrice), tax: n(c.taxAmount),
        note: c.blocked ? "Price to be set at billing" : undefined,
      });
    }
    return out;
  }, [a]);

  const groups = useMemo(() => CATEGORY_ORDER.map((cat) => {
    const rows = lines.filter((l) => l.category === cat).sort((x, y) => String(x.date ?? "").localeCompare(String(y.date ?? "")));
    return rows.length ? { cat, rows, amount: rows.reduce((s, r) => s + r.taxable + r.tax, 0) } : null;
  }).filter(Boolean) as { cat: string; rows: Line[]; amount: number }[], [lines]);

  if (isLoading) return <DetailSkeleton />;
  if (isError) return <ErrorState message={getApiErrorMessage(error, "Failed to load this admission")} onRetry={() => refetch()} />;
  if (!a) return <Typography sx={{ p: 4 }}>Admission not found</Typography>;

  const taxable = lines.reduce((s, l) => s + l.taxable, 0);
  const tax = lines.reduce((s, l) => s + l.tax, 0);
  const total = taxable + tax;
  const advance = n(a.depositBalance);
  const balance = total - advance;
  const unpriced = (a.pendingCharges || []).filter((c) => c.blocked).length;
  const awaiting = a.awaitingPharmacy ?? [];
  const bed = a.bed;
  const bedLabel = bed ? (bed.label || [bed.wardName, bed.roomNumber ? `Room ${bed.roomNumber}` : null, bed.bedNumber ? `Bed ${bed.bedNumber}` : null].filter(Boolean).join(" · ")) : "-";

  const th: React.CSSProperties = { padding: "6px 7px", fontSize: 10.5, fontWeight: 700, background: HEAD, color: "#334155", textTransform: "uppercase", letterSpacing: 0.3, borderBottom: "1.5px solid #cbd5e1" };
  const td: React.CSSProperties = { padding: "5px 7px", fontSize: 11, borderBottom: `1px solid ${LINE}`, verticalAlign: "top" };
  const num = { textAlign: "right" as const };

  return (
    <Box sx={{ bgcolor: "#eef2f5", minHeight: "100vh", py: { xs: 0, sm: 3 }, "@media print": { bgcolor: "white", py: 0 } }}>
      <Box className="no-print" sx={{ maxWidth: "210mm", mx: "auto", mb: 1.5, px: 2, display: "flex", justifyContent: "flex-end", "@media print": { display: "none" } }}>
        <Button variant="contained" startIcon={<PrintRounded />} onClick={() => window.print()} sx={{ textTransform: "none", "&:hover": { bgcolor: "#0c5f76" } }}>Print</Button>
      </Box>

      <Box sx={{
        width: "210mm", minHeight: "297mm", mx: "auto", bgcolor: "white", color: INK, px: "16mm", py: "12mm",
        boxSizing: "border-box", fontFamily: "'Inter', Arial, sans-serif",
        "@media screen": { boxShadow: "0 4px 16px rgba(0,0,0,0.12)" },
        "@media print": { boxShadow: "none", width: "100%", px: "12mm", py: "8mm" },
      }}>
        <BillLetterhead hospital={hospital} />
        <BillTitleBar title="Interim Bill - Not a Tax Invoice" right={<>Charges up to <b style={{ color: INK }}>{formatDateTime(asOf)}</b></>} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 14 }}>
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 5, padding: "9px 11px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: 0.6, marginBottom: 5 }}>PATIENT</div>
            <MetaRow k="Name" v={<b>{a.patientName}</b>} />
            <MetaRow k="UHID / MRN" v={a.uhid} />
            <MetaRow k="Consultant" v={a.doctorName} />
            <MetaRow k="Payer" v={PAYER_LABEL[a.payerType ?? "CASH"] ?? a.payerType} />
          </div>
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 5, padding: "9px 11px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: 0.6, marginBottom: 5 }}>ADMISSION</div>
            <MetaRow k="IP No" v={a.admissionNumber} />
            <MetaRow k="Admitted" v={formatDateTime(a.admissionDate)} />
            <MetaRow k="Days so far" v={a.days ?? "-"} />
            <MetaRow k="Ward/Bed" v={bedLabel} />
          </div>
        </div>

        {groups.map((g) => (
          <div key={g.cat} style={{ marginBottom: 12, breakInside: "avoid" }}>
            <div style={{ background: ACCENT, color: "white", fontSize: 11, fontWeight: 700, letterSpacing: 0.4, padding: "4px 8px", borderRadius: "4px 4px 0 0" }}>{CATEGORY_LABEL[g.cat]}</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left", width: "4%" }}>#</th>
                  <th style={{ ...th, textAlign: "left", width: "12%" }}>Date</th>
                  <th style={{ ...th, textAlign: "left" }}>Description</th>
                  <th style={{ ...th, ...num, width: "10%" }}>Qty</th>
                  <th style={{ ...th, ...num, width: "12%" }}>Rate</th>
                  <th style={{ ...th, ...num, width: "11%" }}>GST</th>
                  <th style={{ ...th, ...num, width: "14%" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, i) => (
                  <tr key={`${g.cat}-${i}`}>
                    <td style={{ ...td, color: SUB }}>{i + 1}</td>
                    <td style={{ ...td, color: SUB }}>{r.date ? formatDate(r.date) : "-"}</td>
                    <td style={td}>
                      {r.description}
                      {r.note && <div style={{ fontSize: 9.5, color: "#b45309", marginTop: 1 }}>{r.note}</div>}
                    </td>
                    <td style={{ ...td, ...num }}>{r.qty}</td>
                    <td style={{ ...td, ...num }}>{r.rate == null ? "-" : inr(r.rate)}</td>
                    <td style={{ ...td, ...num, color: SUB }}>{r.tax ? inr(r.tax) : "-"}</td>
                    <td style={{ ...td, ...num, fontWeight: 600 }}>{inr(r.taxable + r.tax)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={6} style={{ ...td, textAlign: "right", fontWeight: 700, background: "#f8fafc" }}>{CATEGORY_LABEL[g.cat]} subtotal</td>
                  <td style={{ ...td, ...num, fontWeight: 800, background: "#f8fafc" }}>{inr(g.amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
        {groups.length === 0 && <div style={{ ...td, textAlign: "center", color: "#9ca3af", marginBottom: 12 }}>No charges yet</div>}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 6, breakInside: "avoid" }}>
          <div style={{ flex: 1, fontSize: 10.5, color: SUB, lineHeight: 1.5 }}>
            {unpriced > 0 && <div>{unpriced} item{unpriced === 1 ? "" : "s"} still to be priced - not in the total.</div>}
            {awaiting.length > 0 && <div>{awaiting.length} medicine order{awaiting.length === 1 ? "" : "s"} not yet given by the pharmacy ({inr(a.awaitingPharmacyTotal)}) - not in the total.</div>}
          </div>
          <div style={{ width: 320, border: `1px solid ${LINE}`, borderRadius: 6, padding: "10px 14px" }}>
            <TotalRow k="Charges" v={inr(taxable)} />
            <TotalRow k="GST" v={inr(tax)} />
            <div style={{ borderTop: `1px solid ${LINE}`, margin: "5px 0" }} />
            <TotalRow k="Total so far" v={inr(total)} bold big />
            <div style={{ borderTop: `1px dashed ${LINE}`, margin: "6px 0" }} />
            <TotalRow k="Advance paid" v={`- ${inr(advance)}`} color={SUB} />
            <TotalRow k={balance > 0.005 ? "Balance due so far" : "Advance left over"} v={inr(Math.abs(balance))} bold color={balance > 0.005 ? "#dc2626" : "#059669"} />
          </div>
        </div>

        <BillFooter>Interim statement of charges to date - not a tax invoice. The final bill is made at discharge and may differ.</BillFooter>
      </Box>
    </Box>
  );
}
