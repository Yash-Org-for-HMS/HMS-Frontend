import { useState, useEffect } from "react";
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
  CircularProgress,
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
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    // Appointment Settings
    appointmentDuration: 15,
    bufferTime: 5,
    // workingHoursJson: null, // Keeping simple for this phase

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
    currencyCode: "USD",
    taxPercentage: 0,
    invoicePrefix: "INV-",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/hospital/settings");
      const data = res.data.data;
      const hospital = data.hospital || {};
      const settings = data.settings || {};

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
        currencyCode: settings.currencyCode || "USD",
        taxPercentage: settings.taxPercentage ?? 0,
        invoicePrefix: settings.invoicePrefix || "INV-",
      });
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

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
      setError(null);
      setSuccess(null);
      await axiosInstance.put("/hospital/settings", formData);
      setSuccess("Settings updated successfully!");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <CircularProgress sx={{ color: "#10b981" }} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
      <Typography variant="h4" fontWeight="700" sx={{ mb: 1, color: "#f8fafc" }}>
        Hospital Settings
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, color: "#94a3b8" }}>
        Configure appointments, localization, notifications, and billing defaults.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3, bgcolor: "rgba(239, 68, 68, 0.1)", color: "#fca5a5" }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3, bgcolor: "rgba(16, 185, 129, 0.1)", color: "#6ee7b7" }}>
          {success}
        </Alert>
      )}

      <Paper
        component="form"
        onSubmit={handleSubmit}
        sx={{
          bgcolor: "#1e293b",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 3,
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: "rgba(255, 255, 255, 0.08)" }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              px: 2,
              "& .MuiTab-root": {
                color: "#94a3b8",
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.95rem",
                minHeight: 64,
              },
              "& .Mui-selected": {
                color: "#10b981 !important",
              },
              "& .MuiTabs-indicator": {
                backgroundColor: "#10b981",
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
          </Tabs>
        </Box>

        <Box sx={{ p: 4 }}>
          {/* Appointment Settings Tab */}
          <CustomTabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
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
              <Grid item xs={12} md={6}>
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
              <Grid item xs={12} md={4}>
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
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Timezone"
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  placeholder="e.g. Asia/Kolkata"
                />
              </Grid>
              <Grid item xs={12} md={4}>
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
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Switch checked={formData.queueEnabled} onChange={handleChange} name="queueEnabled" color="primary" />}
                  label="Enable Patient Queue System"
                  sx={{ color: "#f8fafc" }}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ color: "#94a3b8", mb: 2 }}>Notification Preferences</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <FormControlLabel
                      control={<Switch checked={formData.smsEnabled} onChange={handleChange} name="smsEnabled" color="primary" />}
                      label="SMS Notifications"
                      sx={{ color: "#f8fafc" }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControlLabel
                      control={<Switch checked={formData.emailEnabled} onChange={handleChange} name="emailEnabled" color="primary" />}
                      label="Email Notifications"
                      sx={{ color: "#f8fafc" }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControlLabel
                      control={<Switch checked={formData.whatsappEnabled} onChange={handleChange} name="whatsappEnabled" color="primary" />}
                      label="WhatsApp Notifications"
                      sx={{ color: "#f8fafc" }}
                    />
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </CustomTabPanel>

          {/* Billing Defaults Tab */}
          <CustomTabPanel value={tabValue} index={3}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Currency Code"
                  name="currencyCode"
                  value={formData.currencyCode}
                  onChange={handleChange}
                  placeholder="e.g. USD, INR"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Tax Percentage (%)"
                  name="taxPercentage"
                  value={formData.taxPercentage}
                  onChange={handleChange}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Invoice Prefix"
                  name="invoicePrefix"
                  value={formData.invoicePrefix}
                  onChange={handleChange}
                  placeholder="e.g. INV-"
                />
              </Grid>
            </Grid>
          </CustomTabPanel>
        </Box>

        <Box sx={{ p: 3, borderTop: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", justifyContent: "flex-end" }}>
          <Button
            type="submit"
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveRounded />}
            sx={{
              bgcolor: "#10b981",
              "&:hover": { bgcolor: "#059669" },
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
