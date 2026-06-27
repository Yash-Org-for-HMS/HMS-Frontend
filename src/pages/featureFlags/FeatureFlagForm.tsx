import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Switch,
  FormControlLabel,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { ArrowBackRounded, SaveRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import { useToast } from "../../contexts/ToastContext";
import PageHeader from "../../components/layout/PageHeader";

export default function FeatureFlagForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const [formData, setFormData] = useState({
    hospitalId: "",
    featureKey: "",
    featureName: "",
    isEnabled: true,
    isGlobal: false,
  });

  const { data: hospitals = [] } = useQuery<any[]>({
    queryKey: ["hospitals", "feature-flag-options"],
    queryFn: async () => (await axiosInstance.get("/hospitals", { params: { limit: 100 } })).data.data,
  });

  const { data: flagData, isLoading: initialLoading, isError, error, refetch } = useQuery({
    queryKey: ["feature-flag", id],
    queryFn: async () => (await axiosInstance.get(`/feature-flags/${id}`)).data.data,
    enabled: isEdit,
  });

  // Default the hospital dropdown to the first option when creating.
  useEffect(() => {
    if (!isEdit && hospitals.length > 0) {
      setFormData((prev) => (prev.hospitalId ? prev : { ...prev, hospitalId: hospitals[0].hospitalId }));
    }
  }, [hospitals, isEdit]);

  // Seed the form with the existing flag when editing.
  useEffect(() => {
    if (!flagData) return;
    const d = flagData;
    setFormData({
      hospitalId: d.hospitalId || "",
      featureKey: d.featureKey || "",
      featureName: d.featureName || "",
      isEnabled: d.isEnabled,
      isGlobal: d.isGlobal || false,
    });
  }, [flagData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked, type } = e.target;
    setFormData({ 
      ...formData, 
      [name]: type === "checkbox" ? checked : value 
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await axiosInstance.put(`/feature-flags/${id}`, formData);
      } else {
        await axiosInstance.post("/feature-flags", formData);
      }
      navigate("/feature-flags");
    } catch (err: any) {
      toast.error(err.response?.data?.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <HeartbeatLoader size={48} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <ErrorState title="Couldn't load feature flag" message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 4, gap: 2 }}>
        <IconButton
          onClick={() => navigate("/feature-flags")}
          sx={{
            bgcolor: "action.hover",
            border: "1px solid", borderColor: "divider",
            color: "text.primary",
            "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
          }}
        >
          <ArrowBackRounded />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <PageHeader
            title={isEdit ? t("flags.editFlag", "Edit Feature Flag") : t("flags.addFlag", "Add Feature Flag")}
          />
        </Box>
      </Box>
<Paper
        elevation={2}
        sx={{
          p: { xs: 3, md: 5 },
          bgcolor: "background.paper",
          backdropFilter: "blur(10px)",
          border: "1px solid", borderColor: "divider",
          borderRadius: 4,
          animation: "fadeInUp 0.6s ease-out both",
        }}
      >
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <TextField
                select
                fullWidth
                label="Scope"
                name="isGlobal"
                value={formData.isGlobal ? "global" : "tenant"}
                onChange={(e) => {
                  const val = e.target.value === "global";
                  setFormData({
                    ...formData,
                    isGlobal: val,
                    hospitalId: val ? (formData.hospitalId || hospitals[0]?.hospitalId || "") : formData.hospitalId
                  });
                }}
                
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: {
                        bgcolor: "background.paper",
                        color: "text.primary",
                        border: "1px solid", borderColor: "divider",
                        "& .MuiMenuItem-root": { py: 1.5, px: 2 }
                      }
                    }
                  }
                }}
              >
                <MenuItem value="tenant" sx={{ fontWeight: 600, color: "#fbbf24" }}>Tenant-Specific (Single Hospital Override)</MenuItem>
                <MenuItem value="global" sx={{ fontWeight: 600, color: "#60a5fa" }}>Global (Applies to all Hospitals)</MenuItem>
              </TextField>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                select
                fullWidth
                label={formData.isGlobal ? "Host Hospital Context (Required by DB)" : t("flags.hospitalName", "Hospital")}
                name="hospitalId"
                value={formData.hospitalId}
                onChange={handleChange}
                required
                disabled={formData.isGlobal}
                helperText={formData.isGlobal ? "Global flags apply to all tenants. Selected hospital acts as database owner." : "Flag override will only apply to the selected hospital."}
                FormHelperTextProps={{ sx: { color: "text.secondary" } }}
                
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: {
                        bgcolor: "background.paper",
                        color: "text.primary",
                        border: "1px solid", borderColor: "divider",
                        "& .MuiMenuItem-root": {
                          py: 1.8,
                          px: 2,
                          "&:hover": { bgcolor: "action.hover" }
                        }
                      }
                    }
                  }
                }}
              >
                {hospitals.map(hospital => (
                  <MenuItem key={hospital.hospitalId} value={hospital.hospitalId}>
                    {hospital.hospitalName}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={t("flags.featureName", "Feature Name")}
                name="featureName"
                value={formData.featureName}
                onChange={handleChange}
                required
                placeholder="e.g. Advanced Analytics Dashboard"
                
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={t("flags.featureKey", "Feature Key")}
                name="featureKey"
                value={formData.featureKey}
                onChange={handleChange}
                required
                placeholder="e.g. Analytics"
                helperText="Must match the module name exactly if overriding a module"
                
                FormHelperTextProps={{ sx: { color: "text.secondary" } }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Box sx={{ p: 2, bgcolor: "background.paper", borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isEnabled}
                      onChange={handleChange}
                      name="isEnabled"
                      color="warning"
                    />
                  }
                  label={
                    <Typography sx={{ color: "text.primary", fontWeight: 600 }}>
                      {formData.isEnabled ? "Feature Enabled" : "Feature Disabled"}
                    </Typography>
                  }
                />
                <Typography variant="body2" sx={{ color: "text.secondary", ml: 4, mt: 0.5 }}>
                  {formData.isEnabled 
                    ? "This hospital will have access to this feature, regardless of their plan."
                    : "This hospital will NOT have access to this feature, even if it is in their plan."}
                </Typography>
              </Box>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 3 }}>
                <Button 
                  variant="outlined" 
                  onClick={() => navigate("/feature-flags")} 
                  disabled={loading} 
                  sx={{ 
                    borderColor: "divider", 
                    color: "text.primary",
                    "&:hover": { borderColor: "divider" }
                  }}
                >
                  {t("common.cancel", "Cancel")}
                </Button>
                <Button 
                  type="submit" 
                  variant="contained" 
                  disabled={loading} 
                  startIcon={loading ? <HeartbeatLoader size={22} /> : <SaveRounded />}
                  sx={{ 
                    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    boxShadow: "0 4px 14px 0 rgba(245, 158, 11, 0.39)",
                  }}
                >
                  {loading ? t("common.saving", "Saving...") : t("common.save", "Save Flag")}
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
    "& fieldset": { borderColor: "divider", borderRadius: "12px" },
    "&:hover fieldset": { borderColor: "divider" },
    "&.Mui-focused fieldset": { borderColor: "#f59e0b" },
  },
  "& .MuiInputLabel-root": { color: "text.secondary" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#f59e0b" },
};
