import { ACCENTS, SEMANTIC, NEUTRAL } from "@/styles/accents";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Avatar, Chip, Divider, Button, Stack, Tooltip, alpha,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, IconButton, CircularProgress,
} from "@mui/material";
import {
  ArrowBackRounded, PersonRounded, HistoryRounded, WarningAmberRounded,
  LocalHospitalRounded, VaccinesRounded, MedicalServicesRounded,
  TodayRounded, BadgeRounded, WcRounded, BloodtypeRounded, LocalPhoneRounded,
  EmailRounded, LocationOnRounded, TimelineRounded,
  FolderSharedRounded, UploadFileRounded, DescriptionRounded, OpenInNewRounded, DeleteOutlineRounded,
} from "@mui/icons-material";
import { getInitials } from "@/utils/format";
import { axiosInstance } from "@/api/axios";
import { assetUrl } from "@/utils/assetUrl";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";
import { getApiErrorMessage } from "@/utils/apiError";
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
              {!hasAllergy && <Chip label="No known allergies" size="small" sx={{ bgcolor: alpha(SEMANTIC.success, 0.1), color: SEMANTIC.successDark, fontWeight: 600 }} />}
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
          {/* Details not already surfaced in the header (which carries name,
              phone, email, city, and the UHID/gender/blood/age chips). */}
          <Section title="Patient details" icon={<PersonRounded fontSize="small" />}>
            <InfoRow label="Date of birth" value={p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString("en-GB") : "—"} />
            <InfoRow label="Address" value={[p.addressLine1, p.addressLine2, p.city, p.district, p.state, p.postalCode].filter(Boolean).join(", ") || "—"} />
            {(p.emergencyContactName || p.emergencyContactPhone) && (
              <InfoRow label="Emergency contact" value={[p.emergencyContactName, p.emergencyContactPhone, p.emergencyContactRelation ? `(${p.emergencyContactRelation})` : ""].filter(Boolean).join(" ")} />
            )}
            <InfoRow label="Registered" value={p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-GB") : "—"} />
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

        {/* Unified clinical record — every event in time order */}
        <Section title="Clinical Record" icon={<TimelineRounded fontSize="small" />}>
          <ClinicalTimeline patientId={id!} />
        </Section>

        {/* Clinical documents — typed, uploaded files (discharge summaries, referrals, …) */}
        <ClinicalDocuments patientId={id!} />

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

// Event-type metadata for the unified clinical timeline (label + dot colour).
const TL_META: Record<string, { label: string; color: string }> = {
  VISIT: { label: "Visits", color: DOCTOR_BLUE },
  MEDICATION: { label: "Meds", color: "#8b5cf6" },
  LAB: { label: "Labs", color: "#0891b2" },
  IMAGING: { label: "Imaging", color: "#0e7490" },
  VITALS: { label: "Vitals", color: "#16a34a" },
  ADMISSION: { label: "Admissions", color: "#b45309" },
  SURGERY: { label: "Surgery", color: "#db2777" },
  NURSING_NOTE: { label: "Nursing", color: "#64748b" },
};

// The patient's whole clinical story in one date-sorted, type-filterable feed.
// Fetches once and filters client-side; counts come from the full (uncapped) set.
function ClinicalTimeline({ patientId }: { patientId: string }) {
  const [type, setType] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["clinical-timeline", patientId],
    queryFn: async () => (await axiosInstance.get(`/doctor/patients/${patientId}/clinical-timeline`)).data.data,
  });

  if (isLoading) return <ListSkeleton rows={5} />;
  const counts: Record<string, number> = data?.counts ?? {};
  const all: any[] = data?.events ?? [];
  if (!all.length) return <Typography variant="body2" sx={{ color: "text.secondary" }}>No clinical events on record yet.</Typography>;
  const events = type ? all.filter((e) => e.type === type) : all;
  const chipSx = (active: boolean, color: string) => ({ height: 24, fontWeight: 700, fontSize: "0.68rem", cursor: "pointer", ...(active ? { bgcolor: color, color: "#fff" } : {}) });

  return (
    <>
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 2 }}>
        <Chip label={`All (${data.total})`} size="small" onClick={() => setType(null)} variant={type === null ? "filled" : "outlined"} sx={chipSx(type === null, DOCTOR_BLUE)} />
        {Object.keys(TL_META).filter((t) => counts[t]).map((t) => (
          <Chip key={t} label={`${TL_META[t].label} (${counts[t]})`} size="small" onClick={() => setType(t)} variant={type === t ? "filled" : "outlined"} sx={chipSx(type === t, TL_META[t].color)} />
        ))}
      </Box>
      <Box sx={{ position: "relative", pl: 2, "&::before": { content: '""', position: "absolute", top: 6, bottom: 6, left: 15, width: 2, bgcolor: "divider" } }}>
        {events.map((e, i) => {
          const m = TL_META[e.type] ?? { label: e.type, color: "#64748b" };
          return (
            <Box key={i} sx={{ position: "relative", mb: 2.25, pl: 3, "&:last-child": { mb: 0 } }}>
              <Box sx={{ position: "absolute", left: -21, top: 4, width: 12, height: 12, borderRadius: "50%", bgcolor: m.color, boxShadow: (t) => `0 0 0 3px ${t.palette.background.paper}`, zIndex: 1 }} />
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.25 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                  {new Date(e.at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </Typography>
                <Chip label={m.label} size="small" sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700, bgcolor: `${m.color}1f`, color: m.color }} />
                {e.doctor && <Typography variant="caption" sx={{ color: "text.disabled" }}>· Dr. {e.doctor}</Typography>}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{e.title}</Typography>
              {e.summary && <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{e.summary}</Typography>}
            </Box>
          );
        })}
      </Box>
    </>
  );
}

// Typed clinical documents (discharge summaries, referrals, external reports, …):
// upload, list, open, and uploader-only soft-delete. Distinct from the timeline's
// transactional events — these are files the workflow doesn't otherwise capture.
function ClinicalDocuments({ patientId }: { patientId: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [typeId, setTypeId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["clinical-documents", patientId],
    queryFn: async () => (await axiosInstance.get(`/doctor/patients/${patientId}/records`)).data.data,
  });
  const types: { id: number; name: string }[] = data?.types ?? [];
  const records: any[] = data?.records ?? [];

  const reset = () => { setTypeId(""); setTitle(""); setFile(null); };
  const submit = async () => {
    if (!typeId) { toast.error("Choose a document type"); return; }
    if (!title.trim()) { toast.error("Enter a title"); return; }
    if (!file) { toast.error("Choose a file to upload"); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("recordTypeId", String(typeId));
      fd.append("title", title.trim());
      fd.append("file", file);
      await axiosInstance.post(`/doctor/patients/${patientId}/records`, fd);
      toast.success("Document uploaded");
      qc.invalidateQueries({ queryKey: ["clinical-documents", patientId] });
      setOpen(false); reset();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Upload failed"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: any) => {
    const ok = await confirm({
      title: "Remove this document?",
      message: `"${r.title}" will be removed from view but kept for the record. You can only remove a document you uploaded.`,
      confirmText: "Remove", destructive: true,
    });
    if (!ok) return;
    try {
      await axiosInstance.delete(`/doctor/patients/${patientId}/records/${r.medicalRecordId}`);
      toast.success("Document removed");
      qc.invalidateQueries({ queryKey: ["clinical-documents", patientId] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not remove document"));
    }
  };

  return (
    <Section
      title="Clinical Documents"
      icon={<FolderSharedRounded fontSize="small" />}
      action={<Button size="small" startIcon={<UploadFileRounded />} variant="outlined" onClick={() => setOpen(true)}>Upload</Button>}
    >
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : records.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>No documents on record yet.</Typography>
      ) : (
        <Stack spacing={1}>
          {records.map((r) => (
            <Paper key={r.medicalRecordId} elevation={0} sx={{ p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 2, display: "flex", alignItems: "center", gap: 1.25 }}>
              <DescriptionRounded sx={{ color: DOCTOR_BLUE, fontSize: 22 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {r.type} · {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · {r.uploadedBy}
                </Typography>
              </Box>
              {r.attachmentUrl && (
                <Tooltip title="Open">
                  <IconButton size="small" component="a" href={assetUrl(r.attachmentUrl)} target="_blank" rel="noopener">
                    <OpenInNewRounded fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {r.mine && (
                <Tooltip title="Remove (you uploaded this)">
                  <IconButton size="small" color="error" onClick={() => remove(r)}>
                    <DeleteOutlineRounded fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Upload clinical document</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField select label="Document type" value={typeId} onChange={(e) => setTypeId(e.target.value)} fullWidth size="small">
              {types.map((t) => <MenuItem key={t.id} value={String(t.id)}>{t.name}</MenuItem>)}
            </TextField>
            <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth size="small" placeholder="e.g. Discharge summary — 04 Aug 2026" inputProps={{ maxLength: 300 }} />
            <Button component="label" variant="outlined" startIcon={<UploadFileRounded />}>
              {file ? file.name : "Choose file"}
              <input hidden type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Button>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>PDF, image, or Word document, up to 15 MB.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={saving} startIcon={saving ? <CircularProgress size={16} /> : undefined}>Upload</Button>
        </DialogActions>
      </Dialog>
    </Section>
  );
}
