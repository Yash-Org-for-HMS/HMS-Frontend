import { useQuery } from "@tanstack/react-query";
import { Box, Chip, Divider, Paper, Typography, alpha } from "@mui/material";
import { LocalHotelRounded, ArrowForwardRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { formatINR } from "@/utils/format";
import { BRAND, NEUTRAL, SEMANTIC } from "@/styles/accents";

interface Stay {
  admissionId: string;
  admissionNumber: string | null;
  branchName: string | null;
  status: string;
  admissionDate: string | null;
  dischargeDate: string | null;
  dischargeDisposition: string | null;
  doctorName: string | null;
  admittingDiagnosis: string | null;
  invoices: { invoiceId: string; invoiceNumber: string; netAmount: string | number; invoiceStatus: string }[];
  transferredFrom: { admissionNumber: string | null; branchName: string | null } | null;
  transferredTo: { admissionNumber: string | null; branchName: string | null } | null;
}

const ACCENT = BRAND.action;
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

/**
 * Every hospital stay the patient has had, at any branch — newest first, each
 * naming its branch, and a stay that moved to another branch linked to the one
 * it continued in. One history across the group, however the bills are split.
 *
 * Shows nothing for a patient who has never been admitted, or for a login that
 * cannot read in-patient records.
 */
export default function StaysSection({ patientId }: { patientId: string }) {
  const { data: stays = [] } = useQuery<Stay[]>({
    queryKey: ["patient-stays", patientId],
    queryFn: async () => (await axiosInstance.get(`/ipd/patients/${patientId}/admissions`)).data.data,
    retry: false,
  });
  if (!stays.length) return null;
  const manyBranches = new Set(stays.map((s) => s.branchName)).size > 1;

  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper", gridColumn: "1 / -1" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: 1.25, display: "grid", placeItems: "center", bgcolor: alpha(ACCENT, 0.12), color: ACCENT }}>
          <LocalHotelRounded fontSize="small" />
        </Box>
        <Typography variant="subtitle1" sx={{ color: "text.primary", fontWeight: 700 }}>Hospital stays</Typography>
      </Box>
      <Divider sx={{ borderColor: "divider", mb: 0.5 }} />
      {stays.map((s) => {
        const transferred = s.dischargeDisposition === "TRANSFERRED";
        const statusLabel = s.status === "ADMITTED" ? "In-patient" : transferred ? "Transferred out" : s.status === "CANCELLED" ? "Cancelled" : "Discharged";
        const statusColor = s.status === "ADMITTED" ? SEMANTIC.success : transferred ? ACCENT : NEUTRAL.muted;
        return (
          <Box key={s.admissionId} sx={{ py: 1.25, display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap", borderBottom: "1px solid", borderColor: "divider", "&:last-of-type": { borderBottom: 0 } }}>
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "monospace" }}>{s.admissionNumber ?? "Stay"}</Typography>
                {s.branchName && <Chip size="small" label={s.branchName} sx={{ height: 20, fontWeight: 600, bgcolor: alpha(ACCENT, 0.1), color: ACCENT }} />}
                <Chip size="small" label={statusLabel} sx={{ height: 20, fontWeight: 700, bgcolor: `${statusColor}22`, color: statusColor }} />
              </Box>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
                {day(s.admissionDate)} – {s.status === "ADMITTED" ? "now" : day(s.dischargeDate)}
                {s.doctorName ? ` · ${s.doctorName}` : ""}
                {s.admittingDiagnosis ? ` · ${s.admittingDiagnosis}` : ""}
              </Typography>
              {(s.transferredFrom || s.transferredTo) && (
                <Typography variant="caption" sx={{ color: ACCENT, display: "flex", alignItems: "center", gap: 0.5, mt: 0.25, fontWeight: 600 }}>
                  {s.transferredFrom && <>Came from {s.transferredFrom.branchName} ({s.transferredFrom.admissionNumber})</>}
                  {s.transferredFrom && s.transferredTo && " · "}
                  {s.transferredTo && <><ArrowForwardRounded sx={{ fontSize: 14 }} /> Went on to {s.transferredTo.branchName} ({s.transferredTo.admissionNumber})</>}
                </Typography>
              )}
            </Box>
            <Box sx={{ textAlign: "right", minWidth: 160 }}>
              {s.invoices.length ? s.invoices.map((i) => (
                <Typography key={i.invoiceId} variant="caption" sx={{ display: "block", color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
                  {i.invoiceNumber} · <Box component="span" sx={{ color: "text.primary", fontWeight: 700 }}>{formatINR(i.netAmount)}</Box>
                  {manyBranches && s.branchName ? ` · billed at ${s.branchName}` : ""}
                </Typography>
              )) : (
                <Typography variant="caption" sx={{ color: "text.disabled" }}>{s.status === "ADMITTED" ? "Bill at discharge" : "No bill"}</Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </Paper>
  );
}
