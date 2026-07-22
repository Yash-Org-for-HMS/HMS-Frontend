import { useState, useEffect } from "react";
import { SEMANTIC } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import ErrorState from "@/components/ErrorState";
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  TextField,
  Button,
  Grid,
  MenuItem,
  Alert,
  Switch,
  FormControlLabel,
} from "@mui/material";
import {
  SaveRounded,
  AccessTimeRounded,
  LanguageRounded,
  SettingsSuggestRounded,
  ReceiptRounded,
  MedicalServicesRounded,
  PersonRounded,
  LocalHospitalRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import PageHeader from "@/components/layout/PageHeader";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `settings-tab-${index}`,
    "aria-controls": `settings-tabpanel-${index}`,
  };
}

export default function HospitalSettings() {
  const [tabValue, setTabValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const [formData, setFormData] = useState({
    // Appointment Settings
    appointmentDuration: 15,
    bufferTime: 5,

    // Localization
    languageCode: "en",
    timezone: "UTC",
    dateFormat: "YYYY-MM-DD",

    // System Settings
    queueEnabled: true,
    smsEnabled: true,
    emailEnabled: true,
    whatsappEnabled: false,

    // Billing Defaults
    currencyCode: "INR",
    taxPercentage: 0,
    invoicePrefix: "INV-",

    // Clinical Workflow
    vitalsCollector: "RECEPTIONIST" as "RECEPTIONIST" | "NURSE",
    billingStrategy: "PRE_PAID" as "PRE_PAID" | "POST_PAID",
  });

  const { data: settingsData, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ["hospital-settings"],
    queryFn: async () => (await axiosInstance.get("/hospital/settings")).data.data,
  });

  // Seed the editable form once settings load.
  useEffect(() => {
    if (!settingsData) return;
    const hospital = settingsData.hospital || {};
    const settings = settingsData.settings || {};
    setFormData({
      appointmentDuration: settings.appointmentDuration ?? 15,
      bufferTime: settings.bufferTime ?? 5,
      languageCode: hospital.languageCode || "en",
      timezone: hospital.timezone || "UTC",
      dateFormat: hospital.dateFormat || "YYYY-MM-DD",
      queueEnabled: settings.queueEnabled ?? true,
      smsEnabled: settings.smsEnabled ?? true,
      emailEnabled: settings.emailEnabled ?? true,
      whatsappEnabled: settings.whatsappEnabled ?? false,
      currencyCode: settings.currencyCode || "INR",
      taxPercentage: settings.taxPercentage ?? 0,
      invoicePrefix: settings.invoicePrefix || "INV-",
      vitalsCollector: (settings.vitalsCollector as "RECEPTIONIST" | "NURSE") || "RECEPTIONIST",
      billingStrategy: (settings.billingStrategy as "PRE_PAID" | "POST_PAID") || "PRE_PAID",
    });
  }, [settingsData]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await axiosInstance.put("/hospital/settings", formData);
      toast.success("Settings updated successfully!");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to update settings"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DetailSkeleton />
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load settings"
        message={apiErrorText(error)}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
      <PageHeader
        title="Hospital Settings"
        subtitle="Configure appointments, localization, notifications, and billing defaults."
      />
<Paper
        component="form"
        onSubmit={handleSubmit}
        sx={{
          bgcolor: "background.paper",
          border: "1px solid", borderColor: "divider",
          borderRadius: 3,
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              px: 2,
              "& .MuiTab-root": {
                color: "text.secondary",
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.875rem",
                minHeight: 64,
              },
              "& .Mui-selected": {
                color: "#10b981 !important",
              },
              "& .MuiTabs-indicator": {
                backgroundColor: SEMANTIC.success,
                height: 3,
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
              },
            }}
          >
            <Tab icon={<AccessTimeRounded sx={{ mr: 1 }} />} iconPosition="start" label="Appointment Settings" {...a11yProps(0)} />
            <Tab icon={<LanguageRounded sx={{ mr: 1 }} />} iconPosition="start" label="Localization" {...a11yProps(1)} />
            <Tab icon={<SettingsSuggestRounded sx={{ mr: 1 }} />} iconPosition="start" label="System Settings" {...a11yProps(2)} />
            <Tab icon={<ReceiptRounded sx={{ mr: 1 }} />} iconPosition="start" label="Billing Defaults" {...a11yProps(3)} />
            <Tab icon={<MedicalServicesRounded sx={{ mr: 1 }} />} iconPosition="start" label="Clinical Workflow" {...a11yProps(4)} />
          </Tabs>
        </Box>

        <Box sx={{ p: 4 }}>
          {/* Appointment Settings Tab */}
          <CustomTabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Appointment Duration (mins)"
                  name="appointmentDuration"
                  value={formData.appointmentDuration}
                  onChange={handleChange}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Buffer Time (mins)"
                  name="bufferTime"
                  value={formData.bufferTime}
                  onChange={handleChange}
                  required
                />
              </Grid>
            </Grid>
          </CustomTabPanel>

          {/* Localization Tab */}
          <CustomTabPanel value={tabValue} index={1}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  select
                  label="Language"
                  name="languageCode"
                  value={formData.languageCode}
                  onChange={handleChange}
                >
                  <MenuItem value="en">English (US)</MenuItem>
                  <MenuItem value="es">Spanish</MenuItem>
                  <MenuItem value="hi">Hindi</MenuItem>
                  <MenuItem value="fr">French</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Timezone"
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  placeholder="e.g. Asia/Kolkata"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  select
                  label="Date Format"
                  name="dateFormat"
                  value={formData.dateFormat}
                  onChange={handleChange}
                >
                  <MenuItem value="YYYY-MM-DD">YYYY-MM-DD</MenuItem>
                  <MenuItem value="DD/MM/YYYY">DD/MM/YYYY</MenuItem>
                  <MenuItem value="MM/DD/YYYY">MM/DD/YYYY</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </CustomTabPanel>

          {/* System Settings Tab */}
          <CustomTabPanel value={tabValue} index={2}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <FormControlLabel
                  control={<Switch checked={formData.queueEnabled} onChange={handleChange} name="queueEnabled" color="primary" />}
                  label="Enable Patient Queue System"
                  sx={{ color: "text.primary" }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 2 }}>Notification Preferences</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControlLabel
                      control={<Switch checked={formData.smsEnabled} onChange={handleChange} name="smsEnabled" color="primary" />}
                      label="SMS Notifications"
                      sx={{ color: "text.primary" }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControlLabel
                      control={<Switch checked={formData.emailEnabled} onChange={handleChange} name="emailEnabled" color="primary" />}
                      label="Email Notifications"
                      sx={{ color: "text.primary" }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControlLabel
                      control={<Switch checked={formData.whatsappEnabled} onChange={handleChange} name="whatsappEnabled" color="primary" />}
                      label="WhatsApp Notifications"
                      sx={{ color: "text.primary" }}
                    />
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </CustomTabPanel>

          {/* Billing Defaults Tab */}
          <CustomTabPanel value={tabValue} index={3}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Currency Code"
                  name="currencyCode"
                  value={formData.currencyCode}
                  onChange={handleChange}
                  placeholder="e.g. USD, INR"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Tax Percentage (%)"
                  name="taxPercentage"
                  value={formData.taxPercentage}
                  onChange={handleChange}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Invoice Prefix"
                  name="invoicePrefix"
                  value={formData.invoicePrefix}
                  onChange={handleChange}
                  placeholder="e.g. INV-"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" sx={{ color: "text.secondary", mt: 2, mb: 2 }}>Payment Strategy</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box
                      onClick={() => setFormData(prev => ({ ...prev, billingStrategy: "PRE_PAID" }))}
                      sx={{
                        p: 2, borderRadius: 2, border: "2px solid", cursor: "pointer",
                        borderColor: formData.billingStrategy === "PRE_PAID" ? SEMANTIC.success : "divider",
                        bgcolor: formData.billingStrategy === "PRE_PAID" ? "rgba(16, 185, 129, 0.05)" : "transparent"
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight={600} color={formData.billingStrategy === "PRE_PAID" ? SEMANTIC.success : "text.primary"}>PRE-PAID (Strict Lock)</Typography>
                      <Typography variant="body2" color="text.secondary">Services are locked until the patient pays the bill. Payments can be collected anywhere.</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box
                      onClick={() => setFormData(prev => ({ ...prev, billingStrategy: "POST_PAID" }))}
                      sx={{
                        p: 2, borderRadius: 2, border: "2px solid", cursor: "pointer",
                        borderColor: formData.billingStrategy === "POST_PAID" ? SEMANTIC.success : "divider",
                        bgcolor: formData.billingStrategy === "POST_PAID" ? "rgba(16, 185, 129, 0.05)" : "transparent"
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight={600} color={formData.billingStrategy === "POST_PAID" ? SEMANTIC.success : "text.primary"}>POST-PAID (Consolidated)</Typography>
                      <Typography variant="body2" color="text.secondary">Services are instantly unlocked. Bills accumulate for discharge payment.</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </CustomTabPanel>

          {/* Clinical Workflow Tab */}
          <CustomTabPanel value={tabValue} index={4}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700, mb: 0.5 }}>
                Who Records Patient Vitals?
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Select the role responsible for recording vitals before the patient sees the doctor.
                This controls where the "Record Vitals" action appears in your workflow.
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {/* Receptionist Option */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Box
                  id="vitals-collector-receptionist"
                  onClick={() => setFormData(prev => ({ ...prev, vitalsCollector: "RECEPTIONIST" }))}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: "2px solid",
                    borderColor: formData.vitalsCollector === "RECEPTIONIST" ? "#06b6d4" : "divider",
                    bgcolor: formData.vitalsCollector === "RECEPTIONIST" ? "rgba(6,182,212,0.06)" : "background.default",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    "&:hover": { borderColor: "#06b6d4", bgcolor: "rgba(6,182,212,0.04)" },
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 2,
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: formData.vitalsCollector === "RECEPTIONIST" ? "rgba(6,182,212,0.2)" : "rgba(100,116,139,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <PersonRounded sx={{ color: formData.vitalsCollector === "RECEPTIONIST" ? "#06b6d4" : "text.secondary", fontSize: 28 }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                      <Typography variant="subtitle1" sx={{ color: formData.vitalsCollector === "RECEPTIONIST" ? "#06b6d4" : "text.primary", fontWeight: 700 }}>
                        Receptionist
                      </Typography>
                      {formData.vitalsCollector === "RECEPTIONIST" && (
                        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#06b6d4" }} />
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.5 }}>
                      Vitals are recorded at the front desk during check-in. The receptionist enters all
                      measurements before the patient is called to the doctor.
                    </Typography>
                    <Box sx={{ mt: 1.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
                      {["Quick check-in flow", "Single-staff hospitals", "OPD clinics"].map(tag => (
                        <Box key={tag} sx={{ px: 1, py: 0.3, borderRadius: 1, bgcolor: "rgba(6,182,212,0.1)", fontSize: "0.75rem", color: "#06b6d4", fontWeight: 600 }}>{tag}</Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Grid>

              {/* Nurse Option */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Box
                  id="vitals-collector-nurse"
                  onClick={() => setFormData(prev => ({ ...prev, vitalsCollector: "NURSE" }))}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: "2px solid",
                    borderColor: formData.vitalsCollector === "NURSE" ? "#a78bfa" : "divider",
                    bgcolor: formData.vitalsCollector === "NURSE" ? "rgba(167,139,250,0.06)" : "background.default",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    "&:hover": { borderColor: "#a78bfa", bgcolor: "rgba(167,139,250,0.04)" },
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 2,
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: formData.vitalsCollector === "NURSE" ? "rgba(167,139,250,0.2)" : "rgba(100,116,139,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <LocalHospitalRounded sx={{ color: formData.vitalsCollector === "NURSE" ? "#a78bfa" : "text.secondary", fontSize: 28 }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                      <Typography variant="subtitle1" sx={{ color: formData.vitalsCollector === "NURSE" ? "#a78bfa" : "text.primary", fontWeight: 700 }}>
                        Nurse
                      </Typography>
                      {formData.vitalsCollector === "NURSE" && (
                        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#a78bfa" }} />
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.5 }}>
                      A dedicated nurse records vitals in the examination room before the doctor consults
                      the patient. Ideal for multi-staff hospitals.
                    </Typography>
                    <Box sx={{ mt: 1.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
                      {["Clinical-grade accuracy", "Multi-staff hospitals", "Specialized care"].map(tag => (
                        <Box key={tag} sx={{ px: 1, py: 0.3, borderRadius: 1, bgcolor: "rgba(167,139,250,0.1)", fontSize: "0.75rem", color: "#a78bfa", fontWeight: 600 }}>{tag}</Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Grid>
            </Grid>

            {/* Info Banner */}
            <Box sx={{ mt: 3, p: 2.5, borderRadius: 2, bgcolor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", display: "flex", gap: 1.5 }}>
              <MedicalServicesRounded sx={{ color: SEMANTIC.warning, flexShrink: 0, mt: 0.2 }} />
              <Box>
                <Typography variant="body2" sx={{ color: SEMANTIC.warningLight, fontWeight: 600, mb: 0.3 }}>Current Selection: {formData.vitalsCollector === "RECEPTIONIST" ? "Receptionist" : "Nurse"}</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {formData.vitalsCollector === "RECEPTIONIST"
                    ? 'The "Record Vitals" button will appear in the Reception Queue for receptionists.'
                    : 'The "Record Vitals" button will appear in the Nurse Panel (/nurse/vitals). Receptionists will not see it in the queue.'}
                </Typography>
              </Box>
            </Box>
          </CustomTabPanel>
        </Box>

        <Box sx={{ p: 3, borderTop: "1px solid", borderColor: "divider", display: "flex", justifyContent: "flex-end" }}>
          <Button
            type="submit"
            variant="contained"
            disabled={saving}
            startIcon={saving ? <HeartbeatLoader size={22} /> : <SaveRounded />}
            sx={{
              bgcolor: SEMANTIC.success,
              "&:hover": { bgcolor: SEMANTIC.successDark },
              px: 4,
            }}
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
