import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  TextField,
  MenuItem,
  IconButton,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { ArrowBackRounded, SaveRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function OnboardingForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hospitalName, setHospitalName] = useState<string>("");

  const [formData, setFormData] = useState({
    onboardingStatus: "pending",
    tenantSetupCompleted: false,
    defaultRolesSeeded: false,
    paymentVerified: false,
  });

  useEffect(() => {
    const fetchOnboarding = async () => {
      try {
        const response = await axiosInstance.get(`/onboarding/${id}`);
        const d = response.data.data;
        setHospitalName(d.hospital?.hospitalName || "Unknown Hospital");
        setFormData({
          onboardingStatus: d.onboardingStatus || "pending",
          tenantSetupCompleted: d.tenantSetupCompleted || false,
          defaultRolesSeeded: d.defaultRolesSeeded || false,
          paymentVerified: d.paymentVerified || false,
        });
      } catch (err) {
        setError(t("common.error"));
      } finally {
        setInitialLoading(false);
      }
    };
    fetchOnboarding();
  }, [id, t]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked, type } = e.target;
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await axiosInstance.put(`/onboarding/${id}`, formData);
      navigate("/onboarding");
    } catch (err: any) {
      setError(err.response?.data?.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: "#10b981" }} />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 4, gap: 2 }}>
        <IconButton
          onClick={() => navigate("/onboarding")}
          sx={{
            bgcolor: "action.hover",
            border: "1px solid", borderColor: "divider",
            color: "text.primary",
            "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
          }}
        >
          <ArrowBackRounded />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight="800" sx={{ color: "text.primary", letterSpacing: "-0.5px" }}>
            {t("onboarding.updateProgress", "Update Onboarding Progress")}
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            {hospitalName}
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>{error}</Alert>}

      <Paper
        elevation={2}
        sx={{
          p: { xs: 3, md: 5 },
          bgcolor: "background.paper",
          backdropFilter: "blur(10px)",
          border: "1px solid", borderColor: "divider",
          borderRadius: 4,
        }}
      >
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <Box sx={{ p: 2, bgcolor: "background.paper", borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", flexDirection: "column", gap: 2 }}>
                <FormControlLabel
                  control={<Switch checked={formData.tenantSetupCompleted} onChange={handleChange} name="tenantSetupCompleted" color="primary" />}
                  label={<Typography sx={{ color: "text.primary", fontWeight: 500 }}>Tenant Setup Completed</Typography>}
                />
                <FormControlLabel
                  control={<Switch checked={formData.defaultRolesSeeded} onChange={handleChange} name="defaultRolesSeeded" color="primary" />}
                  label={<Typography sx={{ color: "text.primary", fontWeight: 500 }}>Default Roles Seeded</Typography>}
                />
                <FormControlLabel
                  control={<Switch checked={formData.paymentVerified} onChange={handleChange} name="paymentVerified" color="primary" />}
                  label={<Typography sx={{ color: "text.primary", fontWeight: 500 }}>Payment Verified</Typography>}
                />
              </Box>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                select
                fullWidth
                label={t("onboarding.status", "Overall Status")}
                name="onboardingStatus"
                value={formData.onboardingStatus}
                onChange={handleChange}
                required
                
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="stalled">Stalled</MenuItem>
              </TextField>
              <Typography variant="caption" sx={{ color: "text.secondary", mt: 1, display: "block" }}>
                Setting status to "Completed" will automatically mark the hospital as "Active" if it isn't already.
              </Typography>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 3 }}>
                <Button 
                  variant="outlined" 
                  onClick={() => navigate("/onboarding")} 
                  disabled={loading} 
                  sx={{ borderColor: "divider", color: "text.primary" }}
                >
                  {t("common.cancel", "Cancel")}
                </Button>
                <Button 
                  type="submit" 
                  variant="contained" 
                  disabled={loading} 
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveRounded />} 
                  sx={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
                >
                  {loading ? t("common.saving", "Saving...") : t("common.save", "Update Status")}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Container>
  );
}

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    color: "text.primary",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    "& fieldset": { borderColor: "divider" },
    "&.Mui-focused fieldset": { borderColor: "#10b981" },
  },
  "& .MuiInputLabel-root": { color: "text.secondary" },
};
