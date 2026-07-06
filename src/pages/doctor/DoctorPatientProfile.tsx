import { ACCENTS } from "../../styles/accents";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Avatar, Chip, Divider, IconButton, Button,
} from "@mui/material";
import {
  ArrowBackRounded, PersonRounded, HistoryRounded, WarningAmberRounded,
  LocalHospitalRounded, MedicationRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import Mascot from "../../components/Mascot";
import ErrorState from "../../components/ErrorState";
import PageLoader from "../../components/PageLoader";
import { typeScale } from "../../styles/typography";
import { sanitizeRichText } from "../../utils/sanitizeHtml";

const DOCTOR_BLUE = ACCENTS.doctor;

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 1, borderBottom: "1px dashed", borderColor: "divider", gap: 2 }}>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary", textAlign: "right" }}>{value ?? "—"}</Typography>
    </Box>
  );
}

export default function DoctorPatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const patientQ = useQuery({
    queryKey: ["doctor-patient", id],
    queryFn: async () => (await axiosInstance.get(`/doctor/patients/${id}`)).data.data,
    enabled: !!id,
  });

  const historyQ = useQuery({
    queryKey: ["doctor-patient-history", id],
    queryFn: async () => (await axiosInstance.get(`/doctor/consultation/patients/${id}/history`)).data.data,
    enabled: !!id,
  });

  const p = patientQ.data;
  const history: any[] = historyQ.data || [];

  if (patientQ.isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "70vh" }}>
        <Mascot pose="thinking" subtitle="Loading patient record…" />
      </Box>
    );
  }

  if (patientQ.isError || !p) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", p: 4 }}>
        <ErrorState title="Couldn't load this patient" message={(patientQ.error as any)?.response?.data?.message} onRetry={() => patientQ.refetch()} />
        <Button startIcon={<ArrowBackRounded />} onClick={() => navigate("/doctor/patients")} sx={{ mt: 1 }}>
          Back to My Patients
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 0, md: 1 }, maxWidth: 1100, mx: "auto" }}>
      {/* Back */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate("/doctor/patients")} sx={{ color: "text.secondary" }}>
          <ArrowBackRounded />
        </IconButton>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>My Patients</Typography>
      </Box>

      {/* Hero */}
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Avatar sx={{ width: 64, height: 64, bgcolor: `${DOCTOR_BLUE}22`, color: DOCTOR_BLUE, fontWeight: 800, fontSize: "1.5rem" }}>
          {p.firstName?.charAt(0) || "P"}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {p.firstName} {p.lastName}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
            <Chip size="small" label={`UHID: ${p.uhidNumber}`} sx={{ fontFamily: "monospace", fontWeight: 600 }} />
            <Chip size="small" label={p.age != null ? `${p.age} yrs` : "Age unknown"} />
            <Chip size="small" label={p.genderLabel} />
            <Chip size="small" icon={<MedicationRounded sx={{ fontSize: "16px !important" }} />} label={p.bloodGroupLabel} sx={{ bgcolor: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 600 }} />
          </Box>
        </Box>
        <Chip icon={<PersonRounded />} label="Read-only clinical view" size="small" sx={{ bgcolor: "rgba(59,130,246,0.1)", color: DOCTOR_BLUE, fontWeight: 600 }} />
      </Paper>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "320px 1fr" }, gap: 2, alignItems: "start" }}>
        {/* Demographics + allergies */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Demographics</Typography>
            <InfoRow label="Phone" value={p.phone} />
            <InfoRow label="Email" value={p.email} />
            <InfoRow label="City" value={p.city} />
            <InfoRow label="Date of Birth" value={p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString("en-GB") : "—"} />
          </Paper>

          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: p.allergies && p.allergies !== "None reported" ? "rgba(239,68,68,0.4)" : "divider" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
              <WarningAmberRounded sx={{ color: "#ef4444", fontSize: 18 }} /> Allergies
            </Typography>
            <Typography variant="body2" sx={{ color: p.allergies && p.allergies !== "None reported" ? "#ef4444" : "text.secondary", fontWeight: p.allergies && p.allergies !== "None reported" ? 600 : 400 }}>
              {p.allergies}
            </Typography>
          </Paper>
        </Box>

        {/* Consultation history */}
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <HistoryRounded sx={{ color: DOCTOR_BLUE, fontSize: 20 }} /> Consultation History
          </Typography>

          {historyQ.isLoading ? (
            <PageLoader />
          ) : history.length === 0 ? (
            <Mascot pose="nothing-here-yet" subtitle="No past consultations on record." size={120} />
          ) : (
            <Box sx={{ position: "relative", pl: 2, "&::before": { content: '""', position: "absolute", top: 10, bottom: 10, left: 15, width: 2, bgcolor: "divider" } }}>
              {history.map((h, i) => (
                <Box key={i} sx={{ position: "relative", mb: 3, pl: 3 }}>
                  <Box sx={{ position: "absolute", left: -21, top: 4, width: 14, height: 14, borderRadius: "50%", bgcolor: "background.paper", border: `3px solid ${DOCTOR_BLUE}`, zIndex: 1 }} />
                  <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 3, bgcolor: "background.default" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1, alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {new Date(h.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </Typography>
                      <Chip label={h.doctorName} size="small" sx={{ height: 20, ...typeScale.chip, bgcolor: "rgba(59,130,246,0.1)", color: DOCTOR_BLUE }} />
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5, display: "flex", alignItems: "center", gap: 0.5 }}>
                      <LocalHospitalRounded sx={{ fontSize: 16, color: DOCTOR_BLUE }} />
                      {h.diagnosis || "No diagnosis recorded"}
                    </Typography>
                    {h.soapAssessment && (
                      <Box
                        sx={{ color: "text.secondary", ...typeScale.body, lineHeight: 1.5, "& p": { m: 0 } }}
                        dangerouslySetInnerHTML={{ __html: sanitizeRichText(h.soapAssessment) }}
                      />
                    )}
                    {h.prescribedMedicines && h.prescribedMedicines.length > 0 && (
                      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px dashed", borderColor: "divider" }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>Prescribed:</Typography>
                        {h.prescribedMedicines.map((med: any, idx: number) => (
                          <Typography key={idx} variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                            • {med.medicineName || "Medicine"} — {med.dosage} ({med.frequency}) × {med.durationDays}d
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Paper>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
