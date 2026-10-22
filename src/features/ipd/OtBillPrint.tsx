import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Box, Button, Typography } from "@mui/material";
import { PrintRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { formatDateTime } from "@/utils/format";
import { apiErrorText } from "@/utils/apiError";
import ErrorState from "@/components/ErrorState";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import { BillLetterhead, BillTitleBar, BillFooter, type BillHospital } from "@/components/billing/BillDocument";

/**
 * The OT bill: one theatre case's charges on one page, for the patient, the
 * insurer or the TPA.
 *
 * A statement, not an invoice. The money is charged once, on the patient's own
 * invoice (the discharge bill, or a day case's own); this page says which, so
 * nobody pays it twice.
 */

const INK = "#111827", SUB = "#6b7280", LINE = "#e5e7eb", HEAD = "#f1f5f9", ACCENT = "#0e7490";
const n = (v: unknown) => Number(v ?? 0) || 0;
const inr = (v: unknown) => `₹${n(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Charge = { surgeryChargeId: string; description: string; label: string; quantity: number; unitPrice: string; taxPercent: string; taxAmount: string; totalPrice: string };
type CaseInfo = {
  procedureName?: string; patientName?: string | null; uhid?: string | null; status?: string;
  billedOn?: "INVOICE" | "DISCHARGE" | "ON_FINISH"; invoiceNumber?: string | null; admissionNumber?: string | null;
};
type PrintInfo = {
  hospital?: BillHospital | null; surgeonName?: string | null; theatreName?: string | null; surgeryType?: string | null;
  anaesthesiaType?: string | null; operatedAt?: string | null; wheeledOutAt?: string | null; patientPhone?: string | null;
};

function MetaRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 11.5, padding: "1.5px 0" }}>
      <span style={{ color: SUB, minWidth: 92 }}>{k}</span>
      <span style={{ color: INK }}>{v || "-"}</span>
    </div>
  );
}

export default function OtBillPrint() {
  const { id = "" } = useParams();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ot-case-charges-print", id],
    queryFn: async () => (await axiosInstance.get(`/ipd/ot/cases/${id}/charges`, { params: { print: 1 } })).data.data,
  });

  if (isLoading) return <DetailSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  const c = (data?.case ?? {}) as CaseInfo;
  const p = (data?.print ?? {}) as PrintInfo;
  const charges = (data?.charges ?? []) as Charge[];
  const s = data?.summary ?? {};
  const gross = n(s.gross), tax = n(s.tax), total = n(s.total);

  const where = c.billedOn === "INVOICE"
    ? `Charged on invoice ${c.invoiceNumber}${c.admissionNumber ? " (the discharge bill)" : ""}. This statement is not a separate bill.`
    : c.billedOn === "DISCHARGE"
      ? `To be charged on the discharge bill${c.admissionNumber ? ` for IP No ${c.admissionNumber}` : ""}. This statement is not a separate bill.`
      : "To be charged on the patient's invoice when the case is finished. This statement is not a separate bill.";

  const th: React.CSSProperties = { padding: "6px 7px", fontSize: 10.5, fontWeight: 700, background: HEAD, color: "#334155", textTransform: "uppercase", letterSpacing: 0.3, borderBottom: "1.5px solid #cbd5e1" };
  const td: React.CSSProperties = { padding: "5px 7px", fontSize: 11, borderBottom: `1px solid ${LINE}`, verticalAlign: "top" };
  const num = { textAlign: "right" as const };

  return (
    <Box sx={{ bgcolor: "#eef2f5", minHeight: "100vh", py: { xs: 0, sm: 3 }, "@media print": { bgcolor: "white", py: 0 } }}>
      <Box className="no-print" sx={{ maxWidth: "210mm", mx: "auto", mb: 1.5, px: 2, display: "flex", justifyContent: "flex-end", "@media print": { display: "none" } }}>
        <Button variant="contained" startIcon={<PrintRounded />} onClick={() => window.print()} sx={{ textTransform: "none" }}>Print</Button>
      </Box>

      <Box sx={{
        width: "210mm", minHeight: "297mm", mx: "auto", bgcolor: "white", color: INK, px: "16mm", py: "12mm",
        boxSizing: "border-box", fontFamily: "'Inter', Arial, sans-serif",
        "@media screen": { boxShadow: "0 4px 16px rgba(0,0,0,0.12)" },
        "@media print": { boxShadow: "none", width: "100%", px: "12mm", py: "8mm" },
      }}>
        <BillLetterhead hospital={p.hospital} />
        <BillTitleBar
          title="OT Bill - Theatre Charges"
          right={<><b style={{ color: INK }}>{c.procedureName}</b>{p.operatedAt ? ` · ${formatDateTime(p.operatedAt)}` : ""}</>}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 14 }}>
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 5, padding: "9px 11px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: 0.6, marginBottom: 5 }}>PATIENT</div>
            <MetaRow k="Name" v={<b>{c.patientName}</b>} />
            <MetaRow k="UHID / MRN" v={c.uhid} />
            <MetaRow k="Phone" v={p.patientPhone} />
            <MetaRow k="IP No" v={c.admissionNumber ?? "Day case"} />
          </div>
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 5, padding: "9px 11px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: 0.6, marginBottom: 5 }}>OPERATION</div>
            <MetaRow k="Procedure" v={<b>{c.procedureName}</b>} />
            <MetaRow k="Surgeon" v={p.surgeonName} />
            <MetaRow k="Theatre" v={p.theatreName} />
            <MetaRow k="Type" v={[p.surgeryType && p.surgeryType.charAt(0) + p.surgeryType.slice(1).toLowerCase(), p.anaesthesiaType && `${p.anaesthesiaType.toLowerCase()} anaesthesia`].filter(Boolean).join(" · ")} />
            <MetaRow k="In / out" v={p.operatedAt ? `${formatDateTime(p.operatedAt)}${p.wheeledOutAt ? ` - ${formatDateTime(p.wheeledOutAt)}` : ""}` : null} />
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left", width: 28 }}>#</th>
              <th style={{ ...th, textAlign: "left" }}>Charge</th>
              <th style={{ ...th, ...num }}>Qty</th>
              <th style={{ ...th, ...num }}>Rate</th>
              <th style={{ ...th, ...num }}>GST</th>
              <th style={{ ...th, ...num }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {charges.map((ch, i) => (
              <tr key={ch.surgeryChargeId}>
                <td style={{ ...td, color: SUB }}>{i + 1}</td>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{ch.description}</div>
                  <div style={{ fontSize: 10, color: SUB }}>{ch.label}</div>
                </td>
                <td style={{ ...td, ...num }}>{ch.quantity}</td>
                <td style={{ ...td, ...num }}>{inr(ch.unitPrice)}</td>
                <td style={{ ...td, ...num, color: SUB }}>{n(ch.taxPercent) > 0 ? `${n(ch.taxPercent)}% · ${inr(ch.taxAmount)}` : "-"}</td>
                <td style={{ ...td, ...num, fontWeight: 700 }}>{inr(ch.totalPrice)}</td>
              </tr>
            ))}
            {charges.length === 0 && (
              <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#9ca3af" }}>No theatre charges have been added to this case</td></tr>
            )}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <div style={{ minWidth: 260 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}><span style={{ color: SUB }}>Charges</span><span>{inr(gross)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}><span style={{ color: SUB }}>CGST</span><span>{inr(tax / 2)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}><span style={{ color: SUB }}>SGST</span><span>{inr(tax / 2)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800, padding: "6px 0", borderTop: `1.5px solid ${INK}`, marginTop: 4 }}><span>Total</span><span>{inr(total)}</span></div>
          </div>
        </div>

        <Typography component="div" sx={{ mt: 2, p: 1.25, border: `1px solid ${LINE}`, borderRadius: 1, fontSize: 11.5, color: INK, bgcolor: HEAD }}>
          {where}
        </Typography>

        <BillFooter />
      </Box>
    </Box>
  );
}
