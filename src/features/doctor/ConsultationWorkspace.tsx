import { ACCENTS } from "@/styles/accents";
import { getApiErrorMessage } from "@/utils/apiError";
import { calculateAge } from "@/utils/format";
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Grid, Typography, Paper,
  Button, TextField, Divider, Avatar, IconButton, Chip, Tab, Tabs, Autocomplete
} from "@mui/material";
import {
  ArrowBackRounded, CheckCircleRounded, SaveRounded, MonitorHeartRounded,
  HistoryRounded, PersonRounded, LocalHospitalRounded, DateRangeRounded,
  CloudDoneRounded, CloudSyncRounded, CloudOffRounded, AutoAwesomeRounded
} from "@mui/icons-material";
import AiSummaryPanel from "./AiSummaryPanel";
import { axiosInstance } from "@/api/axios";
import Mascot from "@/components/Mascot";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import ErrorState from "@/components/ErrorState";
import PrescriptionWriter from "./PrescriptionWriter";
import SoapTemplateBar, { type SoapTemplate } from "@/components/doctor/SoapTemplateBar";
import LabOrderForm from "./LabOrderForm";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import ConsultationHistory from "@/components/doctor/ConsultationHistory";
import RadiologyOrderForm from "./RadiologyOrderForm";
import RichTextEditor from "@/components/RichTextEditor";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { useToast } from "@/providers/ToastContext";

const DOCTOR_BLUE = ACCENTS.doctor;

function TabPanel(props: any) {
  const { children, value, index, ...other } = props;
  return (
    <div 
      role="tabpanel" 
      hidden={value !== index} 
      {...other} 
      style={{ flex: 1, minHeight: 0, overflowY: "auto", display: value === index ? "block" : "none" }}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function ConsultationWorkspace() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const [context, setContext] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Auto-save: track the last-persisted form so we only save real changes, and
  // surface a quiet status indicator instead of a toast on every keystroke.
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const lastSavedRef = useRef<string>("");

  const [tabIndex, setTabIndex] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const [rightTabIndex, setRightTabIndex] = useState(0);
  // Lab & radiology ordering is part of the Laboratory module — hide those tabs
  // when the hospital's plan doesn't include it (the API also rejects the order).
  const { isModuleEnabled } = useEnabledModules();
  const labEnabled = isModuleEnabled("Laboratory");

  const [icd10Options, setIcd10Options] = useState<any[]>([]);
  const [icd10Loading, setIcd10Loading] = useState(false);
  const [icd10Query, setIcd10Query] = useState("");

  const [form, setForm] = useState({
    soapSubjective: "",
    soapObjective: "",
    soapAssessment: "",
    soapPlan: "",
    diagnosis: "",
    followUpDate: "",
  });

  useEffect(() => {
    fetchContext();
  }, [appointmentId]);

  const fetchContext = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/doctor/consultation/appointments/${appointmentId}`);
      const data = res.data.data;
      setContext(data);

      const loadedForm = data.consultation
        ? {
            soapSubjective: data.consultation.soapSubjective || "",
            soapObjective: data.consultation.soapObjective || "",
            soapAssessment: data.consultation.soapAssessment || "",
            soapPlan: data.consultation.soapPlan || "",
            diagnosis: data.consultation.diagnosis || "",
            followUpDate: data.consultation.followUpDate ? new Date(data.consultation.followUpDate).toISOString().split('T')[0] : "",
          }
        : { soapSubjective: "", soapObjective: "", soapAssessment: "", soapPlan: "", diagnosis: "", followUpDate: "" };
      setForm(loadedForm);
      // Seed the baseline so the auto-save effect doesn't fire on the initial load.
      lastSavedRef.current = JSON.stringify(loadedForm);

      if (data.patient?.patientId) {
        fetchHistory(data.patient.patientId);
      }
    } catch (err: unknown) {
      const errMsg = getApiErrorMessage(err, "Failed to load consultation context");
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (patientId: string) => {
    try {
      setHistoryError(null);
      const res = await axiosInstance.get(`/doctor/consultation/patients/${patientId}/history`);
      setHistory(res.data.data);
    } catch (err: unknown) {
      // Surfaced distinctly from "no history" below — a fetch failure must not
      // look identical to a patient who genuinely has no past consultations.
      setHistoryError(getApiErrorMessage(err, "Failed to load consultation history"));
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (icd10Query.length >= 2) {
        try {
          setIcd10Loading(true);
          const res = await axiosInstance.get(`/doctor/consultation/icd10?q=${icd10Query}`);
          setIcd10Options(res.data.data);
        } catch (err) {
          console.error("Failed to fetch ICD-10 codes", err);
        } finally {
          setIcd10Loading(false);
        }
      } else {
        setIcd10Options([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [icd10Query]);

  // Debounced auto-save: persist SOAP edits ~2s after the doctor stops typing so
  // closing the tab mid-note no longer loses work. Skips while loading and when
  // nothing has changed since the last save.
  useEffect(() => {
    if (loading) return;
    const serialized = JSON.stringify(form);
    if (serialized === lastSavedRef.current) return;
    const t = setTimeout(async () => {
      setSaveStatus("saving");
      const result = await handleSave(true);
      if (result !== null) {
        lastSavedRef.current = serialized;
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [form, loading]);

  const handleSave = async (isAutoSave = false) => {
    try {
      if (!isAutoSave) setSaving(true);
      const res = await axiosInstance.post(`/doctor/consultation/appointments/${appointmentId}`, form);

      // Update context if consultationId was generated
      if (res.data.data?.consultationId && !context?.consultation?.consultationId) {
        setContext((prev: any) => ({
          ...prev,
          consultation: { ...prev?.consultation, consultationId: res.data.data.consultationId }
        }));
      }

      if (!isAutoSave) {
        // A manual save also satisfies the auto-save baseline.
        lastSavedRef.current = JSON.stringify(form);
        setSaveStatus("saved");
        toast.success("Consultation drafted successfully");
      }
      // Return the id when present, but treat any non-throwing save as success
      // (existing consultations may not echo the id back).
      return res.data.data?.consultationId ?? true;
    } catch (err: unknown) {
      if (!isAutoSave) toast.error(getApiErrorMessage(err, "Failed to save consultation"));
      return null;
    } finally {
      if (!isAutoSave) setSaving(false);
    }
  };

  const applyTemplate = (t: SoapTemplate) => {
    setForm((prev) => ({
      ...prev,
      soapSubjective: t.soapSubjective || "",
      soapObjective: t.soapObjective || "",
      soapAssessment: t.soapAssessment || "",
      soapPlan: t.soapPlan || "",
      diagnosis: t.diagnosis || prev.diagnosis,
    }));
  };

  const handleComplete = async () => {
    try {
      setCompleting(true);
      // Auto-save first
      await axiosInstance.post(`/doctor/consultation/appointments/${appointmentId}`, form);
      
      // Then mark complete
      await axiosInstance.post(`/doctor/consultation/appointments/${appointmentId}/complete`);
      
      navigate("/doctor/queue");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to complete consultation"));
      setCompleting(false);
    }
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (error && !context) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", p: 4 }}>
        <ErrorState title="Couldn't load the consultation" message={error} onRetry={() => fetchContext()} />
        <Button startIcon={<ArrowBackRounded />} onClick={() => navigate("/doctor/queue")} sx={{ mt: 1 }}>
          Back to Queue
        </Button>
      </Box>
    );
  }

  const p = context?.patient;
  const v = context?.vitals;

  return (
    <Box sx={{ height: "calc(100vh - 100px)", display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Top Bar */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton onClick={() => navigate("/doctor/queue")} sx={{ color: "text.secondary" }}>
            <ArrowBackRounded />
          </IconButton>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar sx={{ bgcolor: `${DOCTOR_BLUE}22`, color: DOCTOR_BLUE, fontWeight: 700 }}>
              {p?.firstName?.charAt(0) || "P"}
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                {p?.firstName} {p?.lastName}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {p?.gender} • {(p?.dateOfBirth || p?.dob) ? `${calculateAge(p?.dateOfBirth || p?.dob)} yrs` : "Age Unknown"} • {context?.appointment?.reason || "General Checkup"}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          {saveStatus !== "idle" && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mr: 0.5 }}>
              {saveStatus === "saving" && <CloudSyncRounded sx={{ fontSize: 18, color: "text.secondary" }} />}
              {saveStatus === "saved" && <CloudDoneRounded sx={{ fontSize: 18, color: "#16a34a" }} />}
              {saveStatus === "error" && <CloudOffRounded sx={{ fontSize: 18, color: "#ef4444" }} />}
              <Typography variant="caption" sx={{ color: saveStatus === "error" ? "#ef4444" : "text.secondary", fontWeight: 600 }}>
                {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "All changes saved" : "Save failed — retrying on next edit"}
              </Typography>
            </Box>
          )}
          <Button
            variant={aiOpen ? "contained" : "outlined"}
            onClick={() => setAiOpen((v) => !v)}
            startIcon={<AutoAwesomeRounded />}
            sx={aiOpen
              ? { textTransform: "none", fontWeight: 700, color: "#fff", background: `linear-gradient(135deg, ${DOCTOR_BLUE}, #8b5cf6)`, boxShadow: `0 4px 12px ${DOCTOR_BLUE}44`, "&:hover": { background: `linear-gradient(135deg, #2563eb, #7c3aed)` } }
              : { textTransform: "none", fontWeight: 700, color: DOCTOR_BLUE, borderColor: `${DOCTOR_BLUE}55`, background: `linear-gradient(135deg, ${DOCTOR_BLUE}0d, #8b5cf60d)`, "&:hover": { borderColor: DOCTOR_BLUE, background: `linear-gradient(135deg, ${DOCTOR_BLUE}1a, #8b5cf61a)` } }}
          >
            Ask Dr. Dex
          </Button>
          <Button
            variant="outlined"
            onClick={() => handleSave(false)}
            disabled={saving || completing}
            startIcon={saving ? <HeartbeatLoader size={22} /> : <SaveRounded />}
            sx={{ borderColor: "divider", color: "text.primary", textTransform: "none", fontWeight: 600 }}
          >
            Save Draft
          </Button>
          <Button
            variant="contained"
            onClick={handleComplete}
            disabled={saving || completing}
            startIcon={completing ? <HeartbeatLoader size={22} /> : <CheckCircleRounded />}
            sx={{ bgcolor: DOCTOR_BLUE, "&:hover": { bgcolor: "#2563eb" }, textTransform: "none", fontWeight: 600, boxShadow: "0 4px 12px rgba(59,130,246,0.3)" }}
          >
            Complete Consultation
          </Button>
        </Box>
      </Paper>
<Grid container spacing={2} sx={{ flex: 1, minHeight: 0 }}>
        {/* Left Panel: Patient Info & Vitals */}
        <Grid size={{ xs: 12, md: 3.5 }} sx={{ height: "100%" }}>
          <Paper elevation={0} sx={{ height: "100%", borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
              <Tabs value={tabIndex} onChange={(e, val) => setTabIndex(val)} variant="fullWidth">
                <Tab icon={<PersonRounded fontSize="small" />} iconPosition="start" label="Patient" sx={{ textTransform: "none", fontWeight: 600, minHeight: 48 }} />
                <Tab icon={<HistoryRounded fontSize="small" />} iconPosition="start" label="History" sx={{ textTransform: "none", fontWeight: 600, minHeight: 48 }} />
              </Tabs>
            </Box>

            <TabPanel value={tabIndex} index={0}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
                <MonitorHeartRounded sx={{ color: "#ef4444", fontSize: 18 }} /> Today's Vitals
              </Typography>
              {v ? (
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 3 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>BP</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{v.bpSystolic}/{v.bpDiastolic} mmHg</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>Pulse</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{v.pulseRate} bpm</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>Temp</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{v.temperatureC} °C</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>SpO2</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{v.oxygenSaturation}%</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>Weight</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{v.weightKg} kg</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>Pain</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{v.painScale}/10</Typography>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic", mb: 3 }}>
                  No vitals recorded for this visit.
                </Typography>
              )}

              <Divider sx={{ mb: 2 }} />
              
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Allergies & Demographics</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>
                <strong>Blood Group:</strong> {p?.bloodGroup || "Unknown"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>
                <strong>Allergies:</strong> {p?.allergies || "None reported"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                <strong>Contact:</strong> {p?.phoneNumber || "N/A"}
              </Typography>
            </TabPanel>

            <TabPanel value={tabIndex} index={1}>
              <ConsultationHistory
                history={history}
                error={historyError}
                onRetry={() => p?.patientId && fetchHistory(p.patientId)}
              />
            </TabPanel>
          </Paper>
        </Grid>

        {/* Right Panel: SOAP Notes */}
        <Grid size={{ xs: 12, md: 8.5 }} sx={{ height: "100%" }}>
          <Paper elevation={0} sx={{ height: "100%", borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", flexDirection: "column", overflow: "hidden" }}>

            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
              <Tabs value={rightTabIndex} onChange={(e, val) => setRightTabIndex(val)} variant="scrollable" scrollButtons="auto">
                <Tab icon={<LocalHospitalRounded fontSize="small" />} iconPosition="start" label="Clinical Notes (SOAP)" sx={{ textTransform: "none", fontWeight: 600, minHeight: 48 }} />
                <Tab icon={<SaveRounded fontSize="small" />} iconPosition="start" label="Prescription Writer" sx={{ textTransform: "none", fontWeight: 600, minHeight: 48 }} />
                {labEnabled && <Tab icon={<LocalHospitalRounded fontSize="small" />} iconPosition="start" label="Lab Orders" sx={{ textTransform: "none", fontWeight: 600, minHeight: 48 }} />}
                {labEnabled && <Tab icon={<LocalHospitalRounded fontSize="small" />} iconPosition="start" label="Radiology Orders" sx={{ textTransform: "none", fontWeight: 600, minHeight: 48 }} />}
              </Tabs>
            </Box>

            <TabPanel value={rightTabIndex} index={0}>
              <Box sx={{ p: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 3, flexWrap: "wrap" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <LocalHospitalRounded sx={{ color: DOCTOR_BLUE }} />
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>Clinical Notes (SOAP)</Typography>
                  </Box>
                  <SoapTemplateBar current={form} onApply={applyTemplate} />
                </Box>

                <Grid container spacing={3}>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: "text.primary" }}>
                      S - Subjective
                    </Typography>
                    <RichTextEditor
                      value={form.soapSubjective}
                      onChange={(val) => setForm({ ...form, soapSubjective: val })}
                      placeholder="Patient's chief complaints, history of present illness..."
                      minHeight={100}
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: "text.primary" }}>
                      O - Objective
                    </Typography>
                    <RichTextEditor
                      value={form.soapObjective}
                      onChange={(val) => setForm({ ...form, soapObjective: val })}
                      placeholder="Physical examination findings, visible signs..."
                      minHeight={100}
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: "text.primary" }}>
                      A - Assessment & Diagnosis
                    </Typography>
                    <RichTextEditor
                      value={form.soapAssessment}
                      onChange={(val) => setForm({ ...form, soapAssessment: val })}
                      placeholder="Medical diagnosis, differential diagnosis..."
                      minHeight={100}
                    />
                    <Box sx={{ mt: 2 }} />
                    <Autocomplete
                      options={icd10Options}
                      getOptionLabel={(option) => `[${option.icd10Code}] ${option.shortDescription}`}
                      loading={icd10Loading}
                      noOptionsText={<Mascot pose="no-matches" subtitle="No matching ICD-10 codes" size={72} sx={{ py: 1 }} />}
                      onInputChange={(e, newInputValue) => setIcd10Query(newInputValue)}
                      onChange={(e, newValue) => {
                        if (newValue) {
                          setForm({ ...form, diagnosis: `[${newValue.icd10Code}] ${newValue.shortDescription}` });
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Primary Diagnosis (ICD-10)"
                          placeholder="Search ICD-10 (e.g. Fever, Hypertension...)"
                          fullWidth
                          sx={{ "& fieldset": { borderColor: "divider" } }}
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {icd10Loading ? <HeartbeatLoader size={22} /> : null}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          }}
                        />
                      )}
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: "text.primary" }}>
                      P - Plan
                    </Typography>
                    <RichTextEditor
                      value={form.soapPlan}
                      onChange={(val) => setForm({ ...form, soapPlan: val })}
                      placeholder="Treatment plan, prescribed medicines, lab tests ordered, follow-up instructions..."
                      minHeight={150}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: "text.primary" }}>
                      Follow-up Date
                    </Typography>
                    <TextField
                      fullWidth
                      type="date"
                      value={form.followUpDate}
                      onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                      sx={{ "& fieldset": { borderColor: "divider" } }}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>
              </Box>
            </TabPanel>

            <TabPanel value={rightTabIndex} index={1}>
              <Box sx={{ p: 1 }}>
                <PrescriptionWriter
                  consultationId={context?.consultation?.consultationId}
                  patientId={p?.patientId}
                  patientAllergies={(p?.allergiesList || []).map((a: any) => a.allergen).filter(Boolean)}
                  patientInfo={{
                    name: `${p?.firstName || ""} ${p?.lastName || ""}`.trim(),
                    uhid: p?.uhidNumber,
                    age: calculateAge(p?.dateOfBirth || p?.dob),
                    gender: p?.gender,
                  }}
                  patientWeightKg={v?.weightKg != null ? Number(v.weightKg) : null}
                  diagnosis={form.diagnosis}
                  onRequireSave={() => handleSave(true)}
                />
              </Box>
            </TabPanel>

            {labEnabled && (
              <TabPanel value={rightTabIndex} index={2}>
                <Box sx={{ p: 1 }}>
                  <LabOrderForm
                    consultationId={context?.consultation?.consultationId}
                    patientId={p?.patientId}
                    onRequireSave={() => handleSave(true)}
                  />
                </Box>
              </TabPanel>
            )}

            {labEnabled && (
              <TabPanel value={rightTabIndex} index={3}>
                <Box sx={{ p: 1 }}>
                  <RadiologyOrderForm
                    consultationId={context?.consultation?.consultationId}
                    patientId={p?.patientId}
                    onRequireSave={() => handleSave(true)}
                  />
                </Box>
              </TabPanel>
            )}
            
          </Paper>
        </Grid>
      </Grid>

      {/* Dr. Dex — non-modal slide-over. No backdrop/dimming, so the notes stay
          visible + interactive beside it. Kept ALWAYS mounted (slid off-screen
          when closed) so the briefing + chat persist for the whole visit. */}
      {aiOpen && (
        <Box
          onClick={() => setAiOpen(false)}
          sx={{ display: { xs: "block", md: "none" }, position: "fixed", inset: 0, zIndex: 1200, bgcolor: "rgba(15,23,42,0.35)" }}
        />
      )}
      <Box
        sx={{
          position: "fixed", top: { xs: 0, md: 84 }, right: 0, bottom: { xs: 0, md: 16 },
          width: { xs: "100%", sm: 460 },
          zIndex: 1250,
          px: { xs: 0, md: 2 },
          transform: aiOpen ? "translateX(0)" : "translateX(calc(100% + 40px))",
          transition: "transform .3s cubic-bezier(.4,0,.2,1)",
          pointerEvents: aiOpen ? "auto" : "none",
        }}
      >
        <Paper
          elevation={0}
          sx={{
            height: "100%", display: "flex", flexDirection: "column", overflow: "hidden",
            borderRadius: { xs: 0, md: 4 },
            border: "1px solid", borderColor: "divider",
            boxShadow: "-16px 0 48px rgba(30,41,59,0.18)",
          }}
        >
          <AiSummaryPanel patientId={p?.patientId} onCollapse={() => setAiOpen(false)} />
        </Paper>
      </Box>
    </Box>
  );
}
