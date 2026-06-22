import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, CircularProgress, Chip, Button, Divider, Tabs, Tab,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import {
  MedicationRounded, ScienceRounded, MonitorHeartRounded, PrintRounded,
  OpenInNewRounded, VisibilityRounded, CloseRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../ErrorState";
import { useHospitalAuth } from "../../contexts/HospitalAuthContext";
import { assetUrl } from "../../utils/assetUrl";
import dayjs from "dayjs";

type DocKind = "prescription" | "lab" | "radiology";

const ACCENT = "#0891b2";

export default function ClinicalRecordsSection({ patientId }: { patientId: string }) {
  const { hospital } = useHospitalAuth();
  const [tab, setTab] = useState(0);
  const [preview, setPreview] = useState<{ kind: DocKind; doc: any } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["clinical-documents", patientId],
    queryFn: async () => (await axiosInstance.get(`/reception/patients/${patientId}/clinical-documents`)).data.data,
  });

  const prescriptions: any[] = data?.prescriptions || [];
  const labOrders: any[] = data?.labOrders || [];
  const radiologyOrders: any[] = data?.radiologyOrders || [];
  const counts = [prescriptions.length, labOrders.length, radiologyOrders.length];

  const handlePrint = () => {
    if (!printRef.current) return;
    const headStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map((el) => el.outerHTML).join("");
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open();
    doc.write(`<!doctype html><html><head><title>Document</title>${headStyles}<style>@media print{@page{margin:1cm}body{font-family:Inter,Arial,sans-serif;color:#1f2937}}</style></head><body>${printRef.current.innerHTML}</body></html>`);
    doc.close();
    const win = iframe.contentWindow!;
    const cleanup = () => { if (iframe.parentNode) document.body.removeChild(iframe); };
    win.onafterprint = cleanup;
    setTimeout(() => { win.focus(); win.print(); setTimeout(cleanup, 1000); }, 250);
  };

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <MedicationRounded sx={{ color: ACCENT }} fontSize="small" />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }}>Prescriptions & Reports</Typography>
      </Box>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={26} sx={{ color: ACCENT }} /></Box>
      ) : isError ? (
        <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
      ) : (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1, "& .MuiTab-root": { textTransform: "none", fontWeight: 600 }, "& .Mui-selected": { color: `${ACCENT} !important` }, "& .MuiTabs-indicator": { bgcolor: ACCENT } }}>
            <Tab icon={<MedicationRounded fontSize="small" />} iconPosition="start" label={`Prescriptions (${counts[0]})`} />
            <Tab icon={<ScienceRounded fontSize="small" />} iconPosition="start" label={`Lab (${counts[1]})`} />
            <Tab icon={<MonitorHeartRounded fontSize="small" />} iconPosition="start" label={`Radiology (${counts[2]})`} />
          </Tabs>

          {tab === 0 && <DocList items={prescriptions} empty="No prescriptions on record"
            render={(p) => ({
              title: `Prescription • ${dayjs(p.prescriptionDate).format("DD MMM YYYY")}`,
              sub: `${p.doctorName || "—"} • ${p.items.length} medicine${p.items.length === 1 ? "" : "s"}`,
              chip: { label: p.dispensingStatus, color: p.dispensingStatus === "dispensed" ? "#10b981" : "#f59e0b" },
            })}
            onView={(p) => setPreview({ kind: "prescription", doc: p })} />}

          {tab === 1 && <DocList items={labOrders} empty="No lab orders on record"
            render={(o) => ({
              title: `Lab order • ${dayjs(o.orderDate).format("DD MMM YYYY")}`,
              sub: `${o.doctorName || "—"} • ${o.tests.length} test${o.tests.length === 1 ? "" : "s"} • ${o.sampleBarcode}`,
              chip: o.resultsReady ? { label: "Results ready", color: "#10b981" } : { label: "Pending", color: "#f59e0b" },
            })}
            onView={(o) => setPreview({ kind: "lab", doc: o })} />}

          {tab === 2 && <DocList items={radiologyOrders} empty="No radiology orders on record"
            render={(o) => ({
              title: `${o.scanType} • ${dayjs(o.orderDate).format("DD MMM YYYY")}`,
              sub: `${o.doctorName || "—"} • ${o.status}`,
              chip: o.findings || o.impression ? { label: "Report ready", color: "#10b981" } : { label: o.status || "Pending", color: "#f59e0b" },
              extra: o.reportUrl ? { href: assetUrl(o.reportUrl) } : undefined,
            })}
            onView={(o) => setPreview({ kind: "radiology", doc: o })} />}
        </>
      )}

      {/* Preview / print dialog */}
      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Document preview
          <Button onClick={() => setPreview(null)} sx={{ minWidth: 0, p: 1, color: "text.secondary" }}><CloseRounded /></Button>
        </DialogTitle>
        <DialogContent dividers>
          <Box ref={printRef}>
            <Box sx={{ textAlign: "center", borderBottom: "2px solid #0891b2", pb: 1.5, mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: "#0e7490" }}>{hospital?.name || "Hospital"}</Typography>
              <Typography variant="caption" sx={{ color: "#6b7280" }}>
                {data?.patient?.name} • UHID {data?.patient?.uhid}
              </Typography>
            </Box>
            {preview?.kind === "prescription" && <PrescriptionView doc={preview.doc} />}
            {preview?.kind === "lab" && <LabView doc={preview.doc} />}
            {preview?.kind === "radiology" && <RadiologyView doc={preview.doc} />}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          {preview?.kind === "radiology" && preview.doc.reportUrl && (
            <Button startIcon={<OpenInNewRounded />} onClick={() => window.open(assetUrl(preview.doc.reportUrl), "_blank")} sx={{ color: ACCENT }}>
              Open uploaded file
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setPreview(null)} color="inherit">Close</Button>
          <Button variant="contained" startIcon={<PrintRounded />} onClick={handlePrint} sx={{ bgcolor: ACCENT, "&:hover": { bgcolor: "#0e7490" } }}>
            Print
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

function DocList({ items, empty, render, onView }: {
  items: any[]; empty: string;
  render: (item: any) => { title: string; sub: string; chip: { label: string; color: string }; extra?: { href: string } };
  onView: (item: any) => void;
}) {
  if (items.length === 0) {
    return <Typography variant="body2" sx={{ color: "text.secondary", py: 3, textAlign: "center" }}>{empty}</Typography>;
  }
  return (
    <Box>
      {items.map((item, idx) => {
        const r = render(item);
        return (
          <Box key={idx}>
            {idx > 0 && <Divider sx={{ borderColor: "divider" }} />}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, py: 1.5, flexWrap: "wrap" }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>{r.title}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>{r.sub}</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Chip label={r.chip.label} size="small" sx={{ bgcolor: `${r.chip.color}22`, color: r.chip.color, fontWeight: 700, textTransform: "capitalize" }} />
                {r.extra && (
                  <Button size="small" startIcon={<OpenInNewRounded />} onClick={() => window.open(r.extra!.href, "_blank")} sx={{ textTransform: "none", color: "#0891b2" }}>File</Button>
                )}
                <Button size="small" startIcon={<VisibilityRounded />} onClick={() => onView(item)} sx={{ textTransform: "none", color: "#0891b2" }}>View / Print</Button>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

const cell: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #eee", fontSize: 13, textAlign: "left" };
const th: React.CSSProperties = { ...cell, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", fontSize: 11 };

function PrescriptionView({ doc }: { doc: any }) {
  return (
    <Box>
      <Typography variant="body2" sx={{ color: "#6b7280", mb: 1 }}>
        {dayjs(doc.prescriptionDate).format("DD MMM YYYY")} • {doc.doctorName || "—"}
      </Typography>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>℞ Prescription</Typography>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={th}>Medicine</th><th style={th}>Dosage</th><th style={th}>Frequency</th><th style={th}>Duration</th><th style={th}>Qty</th></tr></thead>
        <tbody>
          {doc.items.map((it: any, i: number) => (
            <tr key={i}>
              <td style={cell}>{it.medicineName || it.genericName || "—"}</td>
              <td style={cell}>{it.dosage}</td>
              <td style={cell}>{it.frequency}</td>
              <td style={cell}>{it.durationDays} days</td>
              <td style={cell}>{it.quantity} {it.unit || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {doc.specialInstructions && (
        <Typography variant="body2" sx={{ mt: 2, color: "#374151" }}><strong>Instructions:</strong> {doc.specialInstructions}</Typography>
      )}
    </Box>
  );
}

function LabView({ doc }: { doc: any }) {
  return (
    <Box>
      <Typography variant="body2" sx={{ color: "#6b7280", mb: 1 }}>
        {dayjs(doc.orderDate).format("DD MMM YYYY")} • {doc.doctorName || "—"} • {doc.sampleBarcode}
      </Typography>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Lab Report</Typography>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={th}>Test</th><th style={th}>Result</th><th style={th}>Unit</th><th style={th}>Normal range</th></tr></thead>
        <tbody>
          {doc.tests.map((t: any, i: number) => (
            <tr key={i}>
              <td style={cell}>{t.testName}{t.isCritical ? " ⚠" : ""}</td>
              <td style={{ ...cell, fontWeight: 700, color: t.isCritical ? "#ef4444" : "#111827" }}>{t.resultValue || "—"}</td>
              <td style={cell}>{t.unit || "—"}</td>
              <td style={cell}>{t.normalRange || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

function RadiologyView({ doc }: { doc: any }) {
  return (
    <Box>
      <Typography variant="body2" sx={{ color: "#6b7280", mb: 1 }}>
        {dayjs(doc.orderDate).format("DD MMM YYYY")} • {doc.doctorName || "—"}
      </Typography>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>{doc.scanType} — Radiology Report</Typography>
      {doc.findings && (<Box sx={{ mb: 1.5 }}><Typography variant="caption" sx={{ fontWeight: 700, color: "#4b5563", display: "block" }}>FINDINGS</Typography><Typography variant="body2" sx={{ color: "#374151", whiteSpace: "pre-wrap" }}>{doc.findings}</Typography></Box>)}
      {doc.impression && (<Box><Typography variant="caption" sx={{ fontWeight: 700, color: "#4b5563", display: "block" }}>IMPRESSION</Typography><Typography variant="body2" sx={{ color: "#374151", whiteSpace: "pre-wrap" }}>{doc.impression}</Typography></Box>)}
      {!doc.findings && !doc.impression && (
        <Typography variant="body2" sx={{ color: "#6b7280", fontStyle: "italic" }}>
          No written report yet{doc.reportUrl ? " — an uploaded file is available." : "."}
        </Typography>
      )}
    </Box>
  );
}
