import { Fragment, useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "@/utils/apiError";
import { useParams } from "react-router-dom";
import { Box, Typography, ToggleButton, ToggleButtonGroup, Button } from "@mui/material";
import { PrintRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";

/**
 * Printable A4 in-patient tax invoice. A self-contained GST document: printed
 * hospital header, patient/admission meta, a category→date itemisation with
 * per-line HSN + CGST/SGST and per-category subtotals, and a tax-breakup +
 * deposit + balance panel. A screen-only Summary⇄Detailed toggle collapses the
 * line detail to category subtotals for a quick read.
 */

const CATEGORY_ORDER = ["ADMISSION", "ROOM", "DOCTOR_VISIT", "PROCEDURE", "INVESTIGATION", "RADIOLOGY", "PHARMACY", "OTHER"];
const CATEGORY_LABEL: Record<string, string> = {
  ADMISSION: "Admission Charges", ROOM: "Room / Bed Charges", DOCTOR_VISIT: "Doctor Charges",
  PROCEDURE: "Procedures", INVESTIGATION: "Laboratory", RADIOLOGY: "Radiology / Imaging",
  PHARMACY: "Pharmacy & Medical Supplies", OTHER: "Other Charges",
};

// Fallback category for a legacy line with no stored `category`.
function deriveCategory(item: any): string {
  if (item.category && CATEGORY_LABEL[item.category]) return item.category;
  const d = String(item.description || "");
  if (d.startsWith("Bed charges")) return "ROOM";
  if (d.startsWith("Pharmacy") || d.includes("qty ")) return "PHARMACY";
  if (d.startsWith("Radiology")) return "RADIOLOGY";
  if (d.startsWith("Lab")) return "INVESTIGATION";
  if (d.startsWith("Consultation") || d.startsWith("Doctor")) return "DOCTOR_VISIT";
  return "OTHER";
}

const INK = "#111827", SUB = "#6b7280", LINE = "#e5e7eb", HEAD = "#f1f5f9", ACCENT = "#0e7490";
const n = (v: any) => Number(v || 0);
// ₹ with thousands + parentheses for negatives (returns/adjustments).
const inr = (v: any) => {
  const x = n(v);
  const s = Math.abs(x).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return x < 0 ? `(₹${s})` : `₹${s}`;
};
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
function ageSex(p: any): string {
  if (!p) return "—";
  const sex = p.genderId === 1 ? "M" : p.genderId === 2 ? "F" : "O";
  const age = p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / 31557600000) : null;
  return age != null ? `${age}Y / ${sex}` : sex;
}

export default function PrintIpBill() {
  const { invoiceId } = useParams();
  const [inv, setInv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"detailed" | "summary">("detailed");

  useEffect(() => {
    (async () => {
      try {
        const res = await axiosInstance.get(`/reception/billing/invoices/${invoiceId}/detail`);
        setInv(res.data.data);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, "Failed to load this bill"));
      } finally { setLoading(false); }
    })();
  }, [invoiceId]);

  const items: any[] = inv?.InvoiceItem || [];

  // Group into category → date → rows, in canonical category order.
  const groups = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => {
      const rows = items.filter((it) => deriveCategory(it) === cat);
      if (!rows.length) return null;
      const byDate = new Map<string, any[]>();
      for (const r of rows) {
        const key = r.itemDate ? new Date(r.itemDate).toISOString().slice(0, 10) : "—";
        (byDate.get(key) ?? byDate.set(key, []).get(key)!).push(r);
      }
      const dates = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, rs]) => ({ date, rows: rs }));
      const taxable = rows.reduce((s, it) => s + n(it.totalPrice), 0);
      const tax = rows.reduce((s, it) => s + n(it.taxAmount), 0);
      return { cat, dates, taxable, tax, amount: taxable + tax };
    }).filter(Boolean) as { cat: string; dates: { date: string; rows: any[] }[]; taxable: number; tax: number; amount: number }[];
  }, [items]);

  if (loading) return <DetailSkeleton />;
  if (error) return <Typography color="error" sx={{ p: 4 }}>{error}</Typography>;
  if (!inv) return <Typography sx={{ p: 4 }}>Bill not found</Typography>;

  const p = inv.patient, adm = inv.admission, hosp = inv.hospital || {}, dep = inv.deposits;
  const bed = adm?.bed;
  const totalPaid = (inv.Payment || []).reduce((s: number, x: any) => s + n(x.paidAmount), 0);
  const totalRefunded = (inv.Refund || []).reduce((s: number, x: any) => s + n(x.refundAmount), 0);
  const balance = n(inv.netAmount) - (totalPaid - totalRefunded);
  const patientAddress = p ? [p.addressLine1, p.addressLine2, p.city, p.district, p.state, p.postalCode].filter(Boolean).join(", ") : "";
  const hospAddress = [hosp.addressLine1, hosp.addressLine2, hosp.landmark, hosp.city, hosp.postalCode].filter(Boolean).join(", ");
  const bedLabel = bed ? [bed.wardName, bed.roomNumber ? `Room ${bed.roomNumber}` : null, bed.bedNumber ? `Bed ${bed.bedNumber}` : null, bed.roomClass].filter(Boolean).join(" · ") : "—";

  const th: React.CSSProperties = { padding: "6px 7px", fontSize: 10.5, fontWeight: 700, background: HEAD, color: "#334155", textTransform: "uppercase", letterSpacing: 0.3, borderBottom: `1.5px solid #cbd5e1` };
  const td: React.CSSProperties = { padding: "5px 7px", fontSize: 11, borderBottom: `1px solid ${LINE}`, verticalAlign: "top" };
  const num = { textAlign: "right" as const };

  const MetaRow = ({ k, v }: { k: string; v: any }) => (
    <div style={{ display: "flex", gap: 6, marginBottom: 3, fontSize: 11.5 }}>
      <span style={{ color: SUB, minWidth: 96, fontWeight: 600 }}>{k}</span>
      <span style={{ color: INK, fontWeight: 500 }}>{v ?? "—"}</span>
    </div>
  );
  const TotalRow = ({ k, v, bold, color, big }: { k: string; v: string; bold?: boolean; color?: string; big?: boolean }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: big ? 14 : 12, fontWeight: bold ? 800 : 500, color: color || INK }}>
      <span>{k}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{v}</span>
    </div>
  );

  return (
    <Box sx={{ bgcolor: "#eef2f5", minHeight: "100vh", py: { xs: 0, sm: 3 }, "@media print": { bgcolor: "white", py: 0 } }}>
      {/* Screen-only controls */}
      <Box className="no-print" sx={{ maxWidth: "210mm", mx: "auto", mb: 1.5, px: 2, display: "flex", justifyContent: "space-between", alignItems: "center", "@media print": { display: "none" } }}>
        <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v) => v && setMode(v)}>
          <ToggleButton value="detailed" sx={{ textTransform: "none" }}>Detailed</ToggleButton>
          <ToggleButton value="summary" sx={{ textTransform: "none" }}>Summary</ToggleButton>
        </ToggleButtonGroup>
        <Button variant="contained" startIcon={<PrintRounded />} onClick={() => window.print()} sx={{ textTransform: "none", "&:hover": { bgcolor: "#0c5f76" } }}>Print</Button>
      </Box>

      <Box sx={{
        width: "210mm", minHeight: "297mm", mx: "auto", bgcolor: "white", color: INK, px: "16mm", py: "12mm",
        boxSizing: "border-box", fontFamily: "'Inter', Arial, sans-serif",
        "@media screen": { boxShadow: "0 4px 16px rgba(0,0,0,0.12)" },
        "@media print": { boxShadow: "none", width: "100%", px: "12mm", py: "8mm" },
      }}>
        {/* ── Hospital header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, borderBottom: `2px solid ${ACCENT}`, paddingBottom: 10 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0 }}>
            {hosp.logoUrl && <img src={hosp.logoUrl} alt="" style={{ height: 46, width: "auto", objectFit: "contain" }} />}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: 0.2, color: INK }}>{hosp.hospitalName || "Hospital"}</div>
              {hosp.legalBusinessName && <div style={{ fontSize: 11, color: SUB }}>{hosp.legalBusinessName}</div>}
              {hospAddress && <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>{hospAddress}</div>}
              <div style={{ fontSize: 11, color: SUB }}>
                {hosp.officialPhone ? `Ph: ${hosp.officialPhone}` : ""}{hosp.officialPhone && hosp.officialEmail ? "  ·  " : ""}{hosp.officialEmail || ""}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            {hosp.gstNumber && <div style={{ fontSize: 11.5, fontWeight: 700 }}>GSTIN: {hosp.gstNumber}</div>}
            {hosp.registrationNumber && <div style={{ fontSize: 10.5, color: SUB }}>Reg: {hosp.registrationNumber}</div>}
          </div>
        </div>

        {/* Title bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: HEAD, borderRadius: 4, padding: "6px 12px", margin: "12px 0" }}>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2 }}>TAX INVOICE — IN-PATIENT BILL</span>
          <span style={{ fontSize: 11.5, color: SUB }}>
            <b style={{ color: INK }}>{inv.invoiceNumber}</b> · {fmtDateTime(inv.invoiceDate)}
            {inv.invoiceStatus ? ` · ${inv.invoiceStatus}` : ""}
          </span>
        </div>

        {/* ── Meta: patient + admission ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 14 }}>
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 5, padding: "9px 11px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: 0.6, marginBottom: 5 }}>PATIENT</div>
            <MetaRow k="Name" v={<b>{p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() : "—"} ({ageSex(p)})</b>} />
            <MetaRow k="UHID / MRN" v={p?.uhidNumber} />
            <MetaRow k="Phone" v={p?.phone} />
            <MetaRow k="Address" v={patientAddress || "—"} />
            <MetaRow k="Consultant" v={adm?.consultantName} />
          </div>
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 5, padding: "9px 11px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: 0.6, marginBottom: 5 }}>ADMISSION</div>
            <MetaRow k="IP No" v={adm?.admissionNumber} />
            <MetaRow k="Admitted" v={fmtDateTime(adm?.admissionDate)} />
            <MetaRow k="Discharged" v={fmtDateTime(adm?.dischargeDate)} />
            <MetaRow k="Ward/Bed" v={bedLabel} />
            {dep && <MetaRow k="Deposit" v={`${inr(dep.available)} available`} />}
          </div>
        </div>

        {/* ── Category summary strip ── */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: mode === "summary" ? 0 : 14 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>Charge Group</th>
              <th style={{ ...th, ...num }}>Taxable</th>
              <th style={{ ...th, ...num }}>CGST</th>
              <th style={{ ...th, ...num }}>SGST</th>
              <th style={{ ...th, ...num }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.cat}>
                <td style={{ ...td, fontWeight: 600 }}>{CATEGORY_LABEL[g.cat]}</td>
                <td style={{ ...td, ...num }}>{inr(g.taxable)}</td>
                <td style={{ ...td, ...num, color: SUB }}>{inr(g.tax / 2)}</td>
                <td style={{ ...td, ...num, color: SUB }}>{inr(g.tax / 2)}</td>
                <td style={{ ...td, ...num, fontWeight: 700 }}>{inr(g.amount)}</td>
              </tr>
            ))}
            {groups.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#9ca3af" }}>No charges on this bill</td></tr>}
          </tbody>
        </table>

        {/* ── Detailed itemisation — each charge group its own section, dates within ── */}
        {mode === "detailed" && groups.map((g) => (
          <div key={g.cat} style={{ marginBottom: 12, breakInside: "avoid" }}>
            <div style={{ background: ACCENT, color: "white", fontSize: 11, fontWeight: 700, letterSpacing: 0.4, padding: "4px 8px", borderRadius: "4px 4px 0 0" }}>
              {CATEGORY_LABEL[g.cat]}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left", width: "4%" }}>#</th>
                  <th style={{ ...th, textAlign: "left" }}>Description</th>
                  <th style={{ ...th, width: "8%" }}>HSN</th>
                  <th style={{ ...th, ...num, width: "6%" }}>Qty</th>
                  <th style={{ ...th, ...num, width: "10%" }}>Rate</th>
                  <th style={{ ...th, ...num, width: "12%" }}>Taxable</th>
                  <th style={{ ...th, ...num, width: "11%" }}>CGST</th>
                  <th style={{ ...th, ...num, width: "11%" }}>SGST</th>
                  <th style={{ ...th, ...num, width: "13%" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {g.dates.map((d) => (
                  <Fragment key={`d-${g.cat}-${d.date}`}>
                    <tr>
                      <td colSpan={9} style={{ ...td, background: "#f8fafc", fontWeight: 700, fontSize: 10.5, color: SUB, borderBottom: `1px solid ${LINE}` }}>{d.date === "—" ? "Undated" : fmtDate(d.date)}</td>
                    </tr>
                    {d.rows.map((it, i) => {
                      const taxable = n(it.totalPrice), tax = n(it.taxAmount);
                      const sub = [it.batchNo ? `Batch ${it.batchNo}` : null, it.expiryDate ? `Exp ${fmtDate(it.expiryDate)}` : null, it.manufacturer, it.orderingDoctor ? `by ${it.orderingDoctor}` : null].filter(Boolean).join(" · ");
                      return (
                        <tr key={it.invoiceItemId || `${d.date}-${i}`}>
                          <td style={{ ...td, color: SUB }}>{i + 1}</td>
                          <td style={td}>
                            {it.description}
                            {sub && <div style={{ fontSize: 9.5, color: SUB, marginTop: 1 }}>{sub}</div>}
                          </td>
                          <td style={{ ...td, textAlign: "center", color: SUB, fontSize: 10 }}>{it.hsnCode || "—"}</td>
                          <td style={{ ...td, ...num }}>{it.quantity}</td>
                          <td style={{ ...td, ...num }}>{inr(it.unitPrice)}</td>
                          <td style={{ ...td, ...num }}>{inr(taxable)}</td>
                          <td style={{ ...td, ...num, color: SUB }}>{tax ? inr(tax / 2) : "—"}</td>
                          <td style={{ ...td, ...num, color: SUB }}>{tax ? inr(tax / 2) : "—"}</td>
                          <td style={{ ...td, ...num, fontWeight: 600 }}>{inr(taxable + tax)}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
                <tr>
                  <td colSpan={5} style={{ ...td, textAlign: "right", fontWeight: 700, background: "#f8fafc" }}>{CATEGORY_LABEL[g.cat]} subtotal</td>
                  <td style={{ ...td, ...num, fontWeight: 700, background: "#f8fafc" }}>{inr(g.taxable)}</td>
                  <td style={{ ...td, ...num, fontWeight: 700, background: "#f8fafc" }}>{inr(g.tax / 2)}</td>
                  <td style={{ ...td, ...num, fontWeight: 700, background: "#f8fafc" }}>{inr(g.tax / 2)}</td>
                  <td style={{ ...td, ...num, fontWeight: 800, background: "#f8fafc" }}>{inr(g.amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        {/* ── Totals panel ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6, breakInside: "avoid" }}>
          <div style={{ width: 320, border: `1px solid ${LINE}`, borderRadius: 6, padding: "10px 14px" }}>
            <TotalRow k="Taxable value" v={inr(inv.grossAmount)} />
            {n(inv.discountAmount) > 0 && <TotalRow k="Discount" v={`- ${inr(inv.discountAmount)}`} color="#059669" />}
            <TotalRow k="CGST" v={inr(inv.cgstAmount)} />
            <TotalRow k="SGST" v={inr(inv.sgstAmount)} />
            {n(inv.igstAmount) > 0 && <TotalRow k="IGST" v={inr(inv.igstAmount)} />}
            <div style={{ borderTop: `1px solid ${LINE}`, margin: "5px 0" }} />
            <TotalRow k="Net payable" v={inr(inv.netAmount)} bold big />
            <div style={{ borderTop: `1px dashed ${LINE}`, margin: "6px 0" }} />
            {dep && n(dep.applied) > 0 && <TotalRow k="Deposit applied" v={`- ${inr(dep.applied)}`} color={SUB} />}
            {totalPaid > 0 && <TotalRow k="Paid" v={`- ${inr(totalPaid)}`} color={SUB} />}
            {totalRefunded > 0 && <TotalRow k="Refunded" v={`+ ${inr(totalRefunded)}`} color="#8b5cf6" />}
            <TotalRow k={balance > 0.005 ? "Balance due" : "Balance / (Refundable)"} v={inr(balance)} bold color={balance > 0.005 ? "#dc2626" : "#059669"} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 24, borderTop: `1px solid ${LINE}`, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9ca3af" }}>
          <span>Computer-generated tax invoice — no signature required. CGST/SGST as applicable.</span>
          <span>Printed {fmtDateTime(new Date().toISOString())}</span>
        </div>
      </Box>
    </Box>
  );
}
