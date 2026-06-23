import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Grid, Typography, Paper, CircularProgress,
  Button, TextField, Divider, Avatar, IconButton, Chip, Tab, Tabs, Autocomplete
} from "@mui/material";
import {
  ArrowBackRounded, CheckCircleRounded, SaveRounded, MonitorHeartRounded,
  HistoryRounded, PersonRounded, LocalHospitalRounded, DateRangeRounded,
  CloudDoneRounded, CloudSyncRounded, CloudOffRounded
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import Mascot from "../../components/Mascot";
import ErrorState from "../../components/ErrorState";
import PrescriptionWriter from "./PrescriptionWriter";
import LabOrderForm from "./LabOrderForm";
import RadiologyOrderForm from "./RadiologyOrderForm";
import RichTextEditor from "../../components/RichTextEditor";
import { useToast } from "../../contexts/ToastContext";

const DOCTOR_BLUE = "#3b82f6";

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

  // Auto-save: track the last-persisted form so we only save real changes, and
  // surface a quiet status indicator instead of a toast on every keystroke.
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const lastSavedRef = useRef<string>("");

  const [tabIndex, setTabIndex] = useState(0);
  const [rightTabIndex, setRightTabIndex] = useState(0);

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
    } catch (err: any) {
      const errMsg = err.response?.data?.message || "Failed to load consultation context";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (patientId: string) => {
    try {
      const res = await axiosInstance.get(`/doctor/consultation/patients/${patientId}/history`);
      setHistory(res.data.data);
    } catch (err) {
      console.error("Failed to load history", err);
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
    } catch (err: any) {
      if (!isAutoSave) toast.error(err.response?.data?.message || "Failed to save consultation");
      return null;
    } finally {
      if (!isAutoSave) setSaving(false);
    }
  };

  const handleComplete = async () => {
    try {
      setCompleting(true);
      // Auto-save first
      await axiosInstance.post(`/doctor/consultation/appointments/${appointmentId}`, form);
      
      // Then mark complete
      await axiosInstance.post(`/doctor/consultation/appointments/${appointmentId}/complete`);
      
      navigate("/doctor/queue");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to complete consultation");
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
        <Mascot pose="thinking" subtitle="Loading consultation…" />
      </Box>
    );
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
                {p?.gender} • {p?.dob ? `${new Date().getFullYear() - new Date(p.dob).getFullYear()} yrs` : "Age Unknown"} • {context?.appointment?.reason || "General Checkup"}
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
            variant="outlined"
            onClick={() => handleSave(false)}
            disabled={saving || completing}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveRounded />}
            sx={{ borderColor: "divider", color: "text.primary", textTransform: "none", fontWeight: 600 }}
          >
            Save Draft
          </Button>
          <Button
            variant="contained"
            onClick={handleComplete}
            disabled={saving || completing}
            startIcon={completing ? <CircularProgress size={16} color="inherit" /> : <CheckCircleRounded />}
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
              {history.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center", mt: 4 }}>
                  No past consultation history.
                </Typography>
              ) : (
                <Box sx={{ position: "relative", pl: 2, "&::before": { content: '""', position: "absolute", top: 10, bottom: 10, left: 15, width: 2, bgcolor: "divider" } }}>
                  {history.map((h, i) => (
                    <Box key={i} sx={{ position: "relative", mb: 3, pl: 3 }}>
                      <Box sx={{ position: "absolute", left: -21, top: 4, width: 14, height: 14, borderRadius: "50%", bgcolor: "background.paper", border: `3px solid ${DOCTOR_BLUE}`, zIndex: 1 }} />
                      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 3, bgcolor: "background.default", transition: "all 0.2s", "&:hover": { borderColor: DOCTOR_BLUE, boxShadow: "0 4px 12px rgba(59,130,246,0.1)" } }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1, alignItems: "center" }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "text.primary" }}>
                            {new Date(h.createdAt).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' })}
                          </Typography>
                          <Chip label={h.doctorName} size="small" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 600, bgcolor: "rgba(59,130,246,0.1)", color: DOCTOR_BLUE }} />
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5, color: "text.primary" }}>
                          {h.diagnosis || "No Diagnosis Recorded"}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.5 }}>
                          {h.soapAssessment || "No notes available for this consultation."}
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
                                  <Chip label="Bought Outside" size="small" sx={{ height: 16, fontSize: "0.6rem" }} />
                                ) : (
                                  <Chip label="Hospital Pharmacy" color="primary" variant="outlined" size="small" sx={{ height: 16, fontSize: "0.6rem" }} />
                                )}
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Paper>
                    </Box>
                  ))}
                </Box>
              )}
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
                <Tab icon={<LocalHospitalRounded fontSize="small" />} iconPosition="start" label="Lab Orders" sx={{ textTransform: "none", fontWeight: 600, minHeight: 48 }} />
                <Tab icon={<LocalHospitalRounded fontSize="small" />} iconPosition="start" label="Radiology Orders" sx={{ textTransform: "none", fontWeight: 600, minHeight: 48 }} />
              </Tabs>
            </Box>

            <TabPanel value={rightTabIndex} index={0}>
              <Box sx={{ p: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
                  <LocalHospitalRounded sx={{ color: DOCTOR_BLUE }} />
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>Clinical Notes (SOAP)</Typography>
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
                                {icd10Loading ? <CircularProgress color="inherit" size={20} /> : null}
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
                    age: (p?.dateOfBirth || p?.dob)
                      ? Math.floor((Date.now() - new Date(p?.dateOfBirth || p?.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
                      : null,
                    gender: p?.gender,
                  }}
                  diagnosis={form.diagnosis}
                  onRequireSave={() => handleSave(true)}
                />
              </Box>
            </TabPanel>

            <TabPanel value={rightTabIndex} index={2}>
              <Box sx={{ p: 1 }}>
                <LabOrderForm 
                  consultationId={context?.consultation?.consultationId}
                  patientId={p?.patientId}
                  onRequireSave={() => handleSave(true)}
                />
              </Box>
            </TabPanel>

            <TabPanel value={rightTabIndex} index={3}>
              <Box sx={{ p: 1 }}>
                <RadiologyOrderForm 
                  consultationId={context?.consultation?.consultationId}
                  patientId={p?.patientId}
                  onRequireSave={() => handleSave(true)}
                />
              </Box>
            </TabPanel>
            
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
