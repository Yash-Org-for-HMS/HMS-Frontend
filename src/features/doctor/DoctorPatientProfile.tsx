import { ACCENTS, SEMANTIC, NEUTRAL } from "@/styles/accents";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Avatar, Chip, Divider, Button, Stack, Tooltip, alpha,
} from "@mui/material";
import {
  ArrowBackRounded, PersonRounded, HistoryRounded, WarningAmberRounded,
  LocalHospitalRounded, VaccinesRounded, MedicalServicesRounded,
  TodayRounded, BadgeRounded, WcRounded, BloodtypeRounded, LocalPhoneRounded,
  EmailRounded, LocationOnRounded,
} from "@mui/icons-material";
import { getInitials } from "@/utils/format";
import { axiosInstance } from "@/api/axios";
import Mascot from "@/components/Mascot";
import ErrorState from "@/components/ErrorState";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import StatCard from "@/components/StatCard";
import { typeScale } from "@/styles/typography";
import { sanitizeRichText } from "@/utils/sanitizeHtml";
import { apiErrorText } from "@/utils/apiError";

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
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box sx={{ width: 30, height: 30, borderRadius: 1.25, display: "grid", placeItems: "center", bgcolor: alpha(DOCTOR_BLUE, 0.12), color: DOCTOR_BLUE }}>{icon}</Box>
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
  const VAX_STATE_COLOR: Record<string, string> = { OVERDUE: SEMANTIC.danger, DUE_SOON: SEMANTIC.warning };
  const surgeries: any[] = surgeriesQ.data || [];
  const SURGERY_STATE_COLOR: Record<string, string> = { SCHEDULED: SEMANTIC.warning, COMPLETED: SEMANTIC.success, CANCELLED: NEUTRAL.muted };

  // At-a-glance stat tiles, computed once for the row under the hero.
  const lastConsult = history[0];
  const hasOverdueDose = dueRows.some((r) => r.state === "OVERDUE");
  const doseColor = dueRows.length === 0 ? SEMANTIC.success : hasOverdueDose ? SEMANTIC.danger : SEMANTIC.warning;
  const hasAllergy = !!p?.allergies && p.allergies !== "None reported";

  if (patientQ.isLoading) {
    return <DetailSkeleton />;
  }

  if (patientQ.isError || !p) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", p: 4 }}>
        <ErrorState title="Couldn't load this patient" message={apiErrorText(patientQ.error)} onRetry={() => patientQ.refetch()} />
        <Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)} sx={{ mt: 1 }}>
          Back to Patients
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 0, md: 1 }, maxWidth: 1200, mx: "auto" }}>
      {/* Top nav */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, gap: 1, flexWrap: "wrap" }}>
        <Button startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)} sx={{ color: "text.secondary", textTransform: "none", fontWeight: 600 }}>Back to patients</Button>
        <Tooltip title="You're viewing this record during consultation; edits happen in the reception/clinical panels.">
          <Chip icon={<PersonRounded sx={{ fontSize: "15px !important" }} />} label="Read-only clinical view" size="small" sx={{ bgcolor: alpha(DOCTOR_BLUE, 0.12), color: DOCTOR_BLUE, fontWeight: 600 }} />
        </Tooltip>
      </Box>

      {/* ── Header ── */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper", overflow: "hidden", mb: 2 }}>
        <Box sx={{ p: { xs: 2.5, sm: 3 }, display: "flex", gap: 2.5, alignItems: "flex-start", flexWrap: "wrap" }}>
          <Avatar sx={{ width: 88, height: 88, bgcolor: DOCTOR_BLUE, color: "#fff", fontWeight: 800, fontSize: "2rem",
            border: "3px solid", borderColor: alpha(DOCTOR_BLUE, 0.4), boxShadow: `0 8px 22px ${alpha(DOCTOR_BLUE, 0.28)}` }}>
            {getInitials(p.firstName, p.lastName)}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.15, mb: 1, wordBreak: "break-word" }}>{p.firstName} {p.lastName}</Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center", mb: 1.25 }}>
              <Chip icon={<BadgeRounded sx={{ fontSize: "14px !important" }} />} label={p.uhidNumber} size="small" sx={{ bgcolor: alpha(DOCTOR_BLUE, 0.12), color: DOCTOR_BLUE, fontWeight: 700, fontFamily: "monospace" }} />
              <Chip icon={<WcRounded sx={{ fontSize: "14px !important" }} />} label={p.genderLabel} size="small" sx={{ bgcolor: alpha("#8b5cf6", 0.12), color: "#8b5cf6", fontWeight: 600 }} />
              <Chip icon={<BloodtypeRounded sx={{ fontSize: "14px !important" }} />} label={p.bloodGroupLabel} size="small" sx={{ bgcolor: alpha(SEMANTIC.danger, 0.1), color: SEMANTIC.danger, fontWeight: 700 }} />
              {p.age != null && <Chip label={`${p.age} yrs`} size="small" sx={{ bgcolor: alpha(SEMANTIC.success, 0.1), color: SEMANTIC.success, fontWeight: 600 }} />}
            </Box>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: { xs: 1, sm: 2.5 }, color: "text.secondary" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                <LocalPhoneRounded sx={{ fontSize: 16 }} /><Typography variant="body2" noWrap>{p.phone || "—"}</Typography>
              </Box>
              {p.email && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                  <EmailRounded sx={{ fontSize: 16 }} /><Typography variant="body2" noWrap>{p.email}</Typography>
                </Box>
              )}
              {p.city && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <LocationOnRounded sx={{ fontSize: 16 }} /><Typography variant="body2">{p.city}</Typography>
                </Box>
              )}
            </Stack>
          </Box>
        </Box>

        {/* Allergy strip — clinically critical, always visible when present */}
        {hasAllergy && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: { xs: 2.5, sm: 3 }, py: 1.25, bgcolor: alpha(SEMANTIC.danger, 0.07), borderTop: "1px solid", borderColor: alpha(SEMANTIC.danger, 0.2) }}>
            <WarningAmberRounded sx={{ color: SEMANTIC.danger, fontSize: 20, flexShrink: 0 }} />
            <Typography variant="body2" sx={{ color: SEMANTIC.danger, fontWeight: 500 }}>
              <Box component="span" sx={{ fontWeight: 800 }}>Allergies:</Box> {p.allergies}
            </Typography>
          </Box>
        )}
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

          <Section title="Allergies" icon={<WarningAmberRounded fontSize="small" sx={{ color: hasAllergy ? SEMANTIC.danger : DOCTOR_BLUE }} />}>
            {hasAllergy ? (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <Typography variant="body2" sx={{ color: SEMANTIC.dangerDark, fontWeight: 600, lineHeight: 1.6 }}>{p.allergies}</Typography>
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
            <ListSkeleton rows={4} />
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
