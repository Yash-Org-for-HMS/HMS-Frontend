import { useEffect, useRef } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box,
} from "@mui/material";
import { PrintRounded, CloseRounded } from "@mui/icons-material";
import JsBarcode from "jsbarcode";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { ACCENTS, NEUTRAL } from "@/styles/accents";

export interface IdCardPatient {
  uhidNumber: string;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string;
  genderLabel?: string;
  bloodGroupLabel?: string;
  phone?: string;
  age?: number | null;
}

interface IdCardModalProps {
  open: boolean;
  onClose: () => void;
  patient: IdCardPatient | null;
}

/**
 * Patient ID card / wristband print. Renders a credit-card-sized card with the
 * patient's identity and a CODE128 barcode of their UHID (scannable by handheld
 * readers), then prints it via a hidden iframe — no full-page reload, and the
 * barcode is a self-contained SVG so it prints crisply.
 */
export default function IdCardModal({ open, onClose, patient }: IdCardModalProps) {
  const { hospital } = useHospitalAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);

  // Render the barcode into the SVG whenever the card opens / patient changes.
  useEffect(() => {
    if (open && patient?.uhidNumber && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, patient.uhidNumber, {
          format: "CODE128",
          displayValue: false,
          width: 1.6,
          height: 50,
          margin: 0,
          background: "#ffffff",
          lineColor: "#000000",
        });
      } catch {
        /* invalid value — fall back to the human-readable UHID shown below */
      }
    }
  }, [open, patient?.uhidNumber]);

  const handlePrint = () => {
    if (!cardRef.current) return;
    const content = cardRef.current.outerHTML; // includes the rendered barcode SVG
    const headStyles = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]')
    ).map((el) => el.outerHTML).join("");

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open();
    doc.write(
      `<!doctype html><html><head><title>Patient ID Card</title>${headStyles}` +
      `<style>@page{margin:8mm} body{margin:0;display:flex;justify-content:center;padding:12px;font-family:Inter,Arial,sans-serif;}</style>` +
      `</head><body>${content}</body></html>`
    );
    doc.close();
    const win = iframe.contentWindow!;
    const cleanup = () => { if (iframe.parentNode) document.body.removeChild(iframe); };
    win.onafterprint = cleanup;
    setTimeout(() => { win.focus(); win.print(); setTimeout(cleanup, 1000); }, 250);
  };

  if (!open || !patient) return null;

  const fullName = `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Patient";
  const dob = patient.dateOfBirth
    ? new Date(patient.dateOfBirth).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  // Built as real elements (not an HTML string) so React escapes every value —
  // patient.phone in particular is free text and must never be interpolated
  // into markup directly.
  const infoItems: { label: string; value: string }[] = [
    { label: "DOB:", value: `${dob}${patient.age != null ? ` (${patient.age}y)` : ""}` },
    { label: "Sex:", value: patient.genderLabel || "—" },
    { label: "Blood:", value: patient.bloodGroupLabel || "—" },
    ...(patient.phone ? [{ label: "Ph:", value: patient.phone }] : []),
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        Patient ID Card
        <Button onClick={onClose} sx={{ minWidth: 0, p: 1, color: "text.secondary" }}><CloseRounded /></Button>
      </DialogTitle>
      <DialogContent sx={{ display: "flex", justifyContent: "center", py: 3 }}>
        {/* Inline styles on the inner markup so the printed card looks identical
            regardless of the app's CSS. Fixed width for consistent print size. */}
        <Box ref={cardRef} sx={{ width: 340 }} style={{ background: "#fff", color: NEUTRAL.textPrimary, borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(135deg,#0891b2,#06b6d4)", color: "#fff", padding: "12px 16px" }}>
            <div style={{ fontWeight: 800, fontSize: "15px", letterSpacing: "0.3px" }}>{hospital?.name || "Hospital"}</div>
            <div style={{ fontSize: "10px", opacity: 0.9, letterSpacing: "2px", textTransform: "uppercase" }}>Patient Identification Card</div>
          </div>
          <div style={{ padding: "16px" }}>
            <div style={{ fontSize: "18px", fontWeight: 800, marginBottom: "8px" }}>{fullName}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: "12px", color: NEUTRAL.textSecondary, marginBottom: "14px" }}>
              {infoItems.map((item) => (
                <span key={item.label}>
                  <b style={{ color: NEUTRAL.textPrimary }}>{item.label}</b> {item.value}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", borderTop: "1px dashed #cbd5e1", paddingTop: "12px" }}>
              <svg ref={barcodeRef} />
              <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "13px", letterSpacing: "1px", marginTop: "2px" }}>{patient.uhidNumber}</div>
            </div>
          </div>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">Close</Button>
        <Button variant="contained" startIcon={<PrintRounded />} onClick={handlePrint} sx={{ bgcolor: "#06b6d4", "&:hover": { bgcolor: ACCENTS.reception } }}>
          Print ID Card
        </Button>
      </DialogActions>
    </Dialog>
  );
}
