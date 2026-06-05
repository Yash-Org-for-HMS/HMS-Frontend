import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Grid, Typography, Paper, CircularProgress, Alert,
  Button, TextField, Divider, Avatar, IconButton, Chip, Tab, Tabs, Autocomplete
} from "@mui/material";
import {
  ArrowBackRounded, CheckCircleRounded, SaveRounded, MonitorHeartRounded,
  HistoryRounded, PersonRounded, LocalHospitalRounded, DateRangeRounded
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import PrescriptionWriter from "./PrescriptionWriter";
import LabOrderForm from "./LabOrderForm";
import RadiologyOrderForm from "./RadiologyOrderForm";

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
  const [success, setSuccess] = useState<string | null>(null);

  const [context, setContext] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

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

      if (data.consultation) {
        setForm({
          soapSubjective: data.consultation.soapSubjective || "",
          soapObjective: data.consultation.soapObjective || "",
          soapAssessment: data.consultation.soapAssessment || "",
          soapPlan: data.consultation.soapPlan || "",
          diagnosis: data.consultation.diagnosis || "",
          followUpDate: data.consultation.followUpDate ? new Date(data.consultation.followUpDate).toISOString().split('T')[0] : "",
        });
      }

      if (data.patient?.patientId) {
        fetchHistory(data.patient.patientId);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load consultation context");
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

  const handleSave = async (isAutoSave = false) => {
    try {
      if (!isAutoSave) setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await axiosInstance.post(`/doctor/consultation/appointments/${appointmentId}`, form);
      
      // Update context if consultationId was generated
      if (res.data.data?.consultationId && !context?.consultation?.consultationId) {
        setContext((prev: any) => ({
          ...prev,
          consultation: { ...prev?.consultation, consultationId: res.data.data.consultationId }
        }));
      }

      if (!isAutoSave) {
        setSuccess("Consultation drafted successfully");
        setTimeout(() => setSuccess(null), 3000);
      }
      return res.data.data?.consultationId;
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save consultation");
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
      setError(err.response?.data?.message || "Failed to complete consultation");
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
        <CircularProgress sx={{ color: DOCTOR_BLUE }} />
      </Box>
    );
  }

  if (error && !context) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error}</Alert>
        <Button startIcon={<ArrowBackRounded />} onClick={() => navigate("/doctor/queue")} sx={{ mt: 2 }}>
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
        <Box sx={{ display: "flex", gap: 1.5 }}>
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

      {success && <Alert severity="success" sx={{ borderRadius: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setError(null)}>{error}</Alert>}

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
                    <TextField
                      fullWidth multiline rows={3}
                      placeholder="Patient's chief complaints, history of present illness..."
                      value={form.soapSubjective}
                      onChange={(e) => setForm({ ...form, soapSubjective: e.target.value })}
                      sx={{ "& fieldset": { borderColor: "divider" } }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: "text.primary" }}>
                      O - Objective
                    </Typography>
                    <TextField
                      fullWidth multiline rows={3}
                      placeholder="Physical examination findings, visible signs..."
                      value={form.soapObjective}
                      onChange={(e) => setForm({ ...form, soapObjective: e.target.value })}
                      sx={{ "& fieldset": { borderColor: "divider" } }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: "text.primary" }}>
                      A - Assessment & Diagnosis
                    </Typography>
                    <TextField
                      fullWidth multiline rows={3}
                      placeholder="Medical diagnosis, differential diagnosis..."
                      value={form.soapAssessment}
                      onChange={(e) => setForm({ ...form, soapAssessment: e.target.value })}
                      sx={{ mb: 2, "& fieldset": { borderColor: "divider" } }}
                    />
                    <Autocomplete
                      options={icd10Options}
                      getOptionLabel={(option) => `[${option.icd10Code}] ${option.shortDescription}`}
                      loading={icd10Loading}
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
                    <TextField
                      fullWidth multiline rows={4}
                      placeholder="Treatment plan, prescribed medicines, lab tests ordered, follow-up instructions..."
                      value={form.soapPlan}
                      onChange={(e) => setForm({ ...form, soapPlan: e.target.value })}
                      sx={{ "& fieldset": { borderColor: "divider" } }}
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
