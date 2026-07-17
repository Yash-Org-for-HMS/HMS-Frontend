import { Box, Typography, Button, Paper, Chip } from "@mui/material";
import { ACCENTS } from "@/styles/accents";
import { stripHtml } from "@/utils/format";

const DOCTOR_BLUE = ACCENTS.doctor;

interface Props {
  history: any[];
  error: string | null;
  onRetry: () => void;
}

/**
 * The past-consultations timeline shown in the ConsultationWorkspace's left
 * "History" tab. Purely presentational — extracted verbatim from the workspace;
 * takes the loaded history plus an error/retry so the workspace stays lean.
 */
export default function ConsultationHistory({ history, error, onRetry }: Props) {
  if (error) {
    return (
      <Box sx={{ textAlign: "center", mt: 4 }}>
        <Typography variant="body2" sx={{ color: "error.main", mb: 1 }}>{error}</Typography>
        <Button size="small" onClick={onRetry}>Retry</Button>
      </Box>
    );
  }
  if (history.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center", mt: 4 }}>
        No past consultation history.
      </Typography>
    );
  }
  return (
    <Box sx={{ position: "relative", pl: 2, "&::before": { content: '""', position: "absolute", top: 10, bottom: 10, left: 15, width: 2, bgcolor: "divider" } }}>
      {history.map((h, i) => (
        <Box key={i} sx={{ position: "relative", mb: 3, pl: 3 }}>
          <Box sx={{ position: "absolute", left: -21, top: 4, width: 14, height: 14, borderRadius: "50%", bgcolor: "background.paper", border: `3px solid ${DOCTOR_BLUE}`, zIndex: 1 }} />
          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 3, bgcolor: "background.default", transition: "all 0.2s", "&:hover": { borderColor: DOCTOR_BLUE, boxShadow: "0 4px 12px rgba(59,130,246,0.1)" } }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1, alignItems: "center" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "text.primary" }}>
                {new Date(h.createdAt).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' })}
              </Typography>
              <Chip label={h.doctorName} size="small" sx={{ height: 20, fontSize: "0.75rem", fontWeight: 600, bgcolor: "rgba(59,130,246,0.1)", color: DOCTOR_BLUE }} />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5, color: "text.primary" }}>
              {h.diagnosis || "No Diagnosis Recorded"}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.5 }}>
              {stripHtml(h.soapAssessment) || "No notes available for this consultation."}
            </Typography>
            {h.prescribedMedicines && h.prescribedMedicines.length > 0 && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px dashed", borderColor: "divider" }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.primary", mb: 0.5, display: "block" }}>
                  Prescribed Medicines:
                </Typography>
                {h.prescribedMedicines.map((med: any, idx: number) => (
                  <Box key={idx} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      • {med.medicineName || "Medicine"} - {med.dosage} ({med.frequency}) for {med.durationDays} days
                    </Typography>
                    {med.buyOutside ? (
                      <Chip label="Bought Outside" size="small" sx={{ height: 16, fontSize: "0.75rem" }} />
                    ) : (
                      <Chip label="Hospital Pharmacy" color="primary" variant="outlined" size="small" sx={{ height: 16, fontSize: "0.75rem" }} />
                    )}
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Box>
      ))}
    </Box>
  );
}
