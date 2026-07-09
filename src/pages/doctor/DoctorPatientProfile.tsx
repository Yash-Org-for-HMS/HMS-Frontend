import { ACCENTS } from "../../styles/accents";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Avatar, Chip, Divider, Button,
} from "@mui/material";
import {
  ArrowBackRounded, PersonRounded, HistoryRounded, WarningAmberRounded,
  LocalHospitalRounded, MedicationRounded, VaccinesRounded, MedicalServicesRounded,
  TodayRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import Mascot from "../../components/Mascot";
import ErrorState from "../../components/ErrorState";
import PageLoader from "../../components/PageLoader";
import StatCard from "../../components/StatCard";
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

// Consistent card header (icon + title + divider) shared by every card on this
// page, so the four sidebar cards and the consultation-history card read as
// one system instead of each having its own ad-hoc header style.
function Section({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, mb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ color: DOCTOR_BLUE, display: "flex" }}>{icon}</Box>
          <Typography variant="subtitle1" sx={{ color: "text.primary", fontWeight: 700 }}>{title}</Typography>
        </Box>
        {action}
      </Box>
      <Divider sx={{ borderColor: "divider", mb: 0.5 }} />
      {children}
    </Paper>
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

  const vaccinationQ = useQuery({
    queryKey: ["doctor-patient-vaccination-schedule", id],
    queryFn: async () => (await axiosInstance.get(`/vaccination/patients/${id}/schedule`)).data.data,
    enabled: !!id,
  });

  const surgeriesQ = useQuery({
    queryKey: ["patient-surgeries", id],
    queryFn: async () => (await axiosInstance.get(`/ipd/patients/${id}/surgeries`)).data.data,
    enabled: !!id,
  });

  const p = patientQ.data;
  const history: any[] = historyQ.data || [];
  const dueRows: any[] = (vaccinationQ.data?.rows || []).filter((r: any) => r.state === "OVERDUE" || r.state === "DUE_SOON");
  const VAX_STATE_COLOR: Record<string, string> = { OVERDUE: "#ef4444", DUE_SOON: "#f59e0b" };
  const surgeries: any[] = surgeriesQ.data || [];
  const SURGERY_STATE_COLOR: Record<string, string> = { SCHEDULED: "#f59e0b", COMPLETED: "#10b981", CANCELLED: "#64748b" };

  // At-a-glance stat tiles, computed once for the row under the hero.
  const lastConsult = history[0];
  const hasOverdueDose = dueRows.some((r) => r.state === "OVERDUE");
  const doseColor = dueRows.length === 0 ? "#10b981" : hasOverdueDose ? "#ef4444" : "#f59e0b";
  const hasAllergy = !!p?.allergies && p.allergies !== "None reported";

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
        <Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)} sx={{ mt: 1 }}>
          Back to Patients
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 0, md: 1 }, maxWidth: 1200, mx: "auto" }}>
      {/* Back */}
      <Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)} sx={{ color: "text.secondary", textTransform: "none", mb: 1.5 }}>
        Back to patients
      </Button>

      {/* Hero */}
      <Paper elevation={0} sx={{
        p: 2.5, mb: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", position: "relative", overflow: "hidden",
        background: `linear-gradient(135deg, ${DOCTOR_BLUE}0f 0%, ${DOCTOR_BLUE}05 100%)`,
        "&::before": { content: '""', position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: `linear-gradient(90deg, ${DOCTOR_BLUE}, #60a5fa)` },
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2.5, flexWrap: "wrap" }}>
          <Avatar sx={{ width: 68, height: 68, bgcolor: DOCTOR_BLUE, color: "#fff", fontWeight: 800, fontSize: "1.6rem", boxShadow: `0 8px 24px ${DOCTOR_BLUE}40` }}>
            {p.firstName?.charAt(0) || "P"}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.75 }}>
              {p.firstName} {p.lastName}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
              <Chip size="small" label={`UHID: ${p.uhidNumber}`} sx={{ fontFamily: "monospace", fontWeight: 700, bgcolor: `${DOCTOR_BLUE}1a`, color: DOCTOR_BLUE }} />
              <Chip size="small" label={p.age != null ? `${p.age} yrs` : "Age unknown"} sx={{ bgcolor: "action.hover" }} />
              <Chip size="small" label={p.genderLabel} sx={{ bgcolor: "action.hover" }} />
              <Chip size="small" icon={<MedicationRounded sx={{ fontSize: "14px !important" }} />} label={p.bloodGroupLabel} sx={{ bgcolor: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 700 }} />
              {hasAllergy && (
                <Chip size="small" icon={<WarningAmberRounded sx={{ fontSize: "14px !important" }} />} label="Allergies" sx={{ bgcolor: "rgba(245,158,11,0.12)", color: "#d97706", fontWeight: 700 }} />
              )}
            </Box>
          </Box>
          <Chip icon={<PersonRounded sx={{ fontSize: "16px !important" }} />} label="Read-only clinical view" size="small" sx={{ bgcolor: `${DOCTOR_BLUE}1a`, color: DOCTOR_BLUE, fontWeight: 700 }} />
        </Box>
      </Paper>

      {/* Stat tiles */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 2, mb: 2 }}>
        <StatCard layout="horizontal" icon={<HistoryRounded />} label="Consultations" value={history.length} color={DOCTOR_BLUE} />
        <StatCard layout="horizontal" icon={<TodayRounded />} label="Last visit" color="#8b5cf6"
          value={lastConsult ? new Date(lastConsult.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
          sub={lastConsult ? lastConsult.doctorName : "no visits yet"} />
        <StatCard layout="horizontal" icon={<VaccinesRounded />} label="Doses due" value={dueRows.length} color={doseColor}
          sub={hasOverdueDose ? "overdue" : dueRows.length ? "due soon" : "up to date"} />
        <StatCard layout="horizontal" icon={<MedicalServicesRounded />} label="Surgeries" value={surgeries.length} color="#0891b2" />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "320px 1fr" }, gap: 2, alignItems: "start" }}>
        {/* Demographics + allergies */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Section title="Demographics" icon={<PersonRounded fontSize="small" />}>
            <InfoRow label="Phone" value={p.phone} />
            <InfoRow label="Email" value={p.email} />
            <InfoRow label="City" value={p.city} />
            <InfoRow label="Date of Birth" value={p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString("en-GB") : "—"} />
          </Section>

          <Section title="Allergies" icon={<WarningAmberRounded fontSize="small" sx={{ color: hasAllergy ? "#ef4444" : DOCTOR_BLUE }} />}>
            {hasAllergy ? (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <Typography variant="body2" sx={{ color: "#dc2626", fontWeight: 600, lineHeight: 1.6 }}>{p.allergies}</Typography>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>None reported</Typography>
            )}
          </Section>

          {/* Read-only immunization snapshot — full schedule + administer/skip
              actions live on the Reception patient profile; this view only
              surfaces what's due/overdue so it doesn't act during consultation. */}
          <Section title="Immunization" icon={<VaccinesRounded fontSize="small" />}>
            {vaccinationQ.isLoading ? (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>Loading…</Typography>
            ) : dueRows.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>No doses due or overdue.</Typography>
            ) : (
              dueRows.slice(0, 5).map((r) => (
                <Box key={r.patientVaccinationId} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.75, borderBottom: "1px dashed", borderColor: "divider", gap: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{r.vaccineName} — {r.doseLabel}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>Due {new Date(r.dueDate).toLocaleDateString("en-GB")}</Typography>
                  </Box>
                  <Chip size="small" label={r.state === "OVERDUE" ? "Overdue" : "Due soon"} sx={{ bgcolor: `${VAX_STATE_COLOR[r.state]}1f`, color: VAX_STATE_COLOR[r.state], fontWeight: 700, flexShrink: 0 }} />
                </Box>
              ))
            )}
          </Section>

          {/* Read-only surgery history — added/edited from the IPD Admissions
              page (Surgery Details), scoped to a specific admission; this is
              just the patient-wide read view for consultation reference. */}
          <Section title="Surgeries" icon={<MedicalServicesRounded fontSize="small" />}>
            {surgeriesQ.isLoading ? (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>Loading…</Typography>
            ) : surgeries.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>No surgeries on record.</Typography>
            ) : (
              surgeries.slice(0, 5).map((s) => (
                <Box key={s.surgeryId} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.75, borderBottom: "1px dashed", borderColor: "divider", gap: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{s.procedureName}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {s.surgeryType === "MAJOR" ? "Major" : "Minor"}{s.gradeName ? ` · ${s.gradeName}` : ""}{s.surgeonName ? ` · Dr. ${s.surgeonName}` : ""}
                    </Typography>
                  </Box>
                  <Chip size="small" label={s.status.charAt(0) + s.status.slice(1).toLowerCase()} sx={{ bgcolor: `${SURGERY_STATE_COLOR[s.status]}1f`, color: SURGERY_STATE_COLOR[s.status], fontWeight: 700, flexShrink: 0 }} />
                </Box>
              ))
            )}
          </Section>
        </Box>

        {/* Consultation history */}
        <Section title="Consultation History" icon={<HistoryRounded fontSize="small" />}>
          {historyQ.isLoading ? (
            <PageLoader />
          ) : history.length === 0 ? (
            <Box sx={{ py: 2 }}>
              <Mascot pose="nothing-here-yet" title="No consultations yet" subtitle="No past consultations on record for this patient." size={110} />
            </Box>
          ) : (
            <Box sx={{ position: "relative", pl: 2, mt: 1, "&::before": { content: '""', position: "absolute", top: 10, bottom: 10, left: 15, width: 2, bgcolor: "divider" } }}>
              {history.map((h, i) => (
                <Box key={i} sx={{ position: "relative", mb: 3, pl: 3, "&:last-child": { mb: 0 } }}>
                  <Box sx={{ position: "absolute", left: -21, top: 4, width: 14, height: 14, borderRadius: "50%", bgcolor: "background.paper", border: `3px solid ${DOCTOR_BLUE}`, zIndex: 1 }} />
                  <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 3, bgcolor: "background.default" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1, alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {new Date(h.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </Typography>
                      <Chip label={h.doctorName} size="small" sx={{ height: 20, ...typeScale.chip, bgcolor: `${DOCTOR_BLUE}1a`, color: DOCTOR_BLUE }} />
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
        </Section>
      </Box>
    </Box>
  );
}
