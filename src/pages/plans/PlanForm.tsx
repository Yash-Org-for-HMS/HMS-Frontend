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
  IconButton,
  Alert,
  CircularProgress,
  Autocomplete,
  Chip
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { ArrowBackRounded, SaveRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

// Available modules in the system that can be part of a plan
const AVAILABLE_MODULES = [
  "OPD", "IPD", "Billing", "Pharmacy", "Laboratory", "Radiology", 
  "Inventory", "HR", "Analytics", "Telemedicine", "PatientPortal"
];

export default function PlanForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<any>({
    planName: "",
    monthlyPrice: "",
    annualPrice: "",
    maxDoctors: "",
    maxBranches: "",
    maxStorageGb: "",
    featuresJson: [] as string[],
  });

  useEffect(() => {
    if (isEdit) {
      const fetchPlan = async () => {
        try {
          const response = await axiosInstance.get(`/plans/${id}`);
          const d = response.data.data;
          setFormData({
            planName: d.planName || "",
            monthlyPrice: d.monthlyPrice !== null ? parseFloat(d.monthlyPrice) : "",
            annualPrice: d.annualPrice !== null ? parseFloat(d.annualPrice) : "",
            maxDoctors: d.maxDoctors !== null ? d.maxDoctors : "",
            maxBranches: d.maxBranches !== null ? d.maxBranches : "",
            maxStorageGb: d.maxStorageGb !== null ? d.maxStorageGb : "",
            featuresJson: Array.isArray(d.featuresJson) ? d.featuresJson : [],
          });
        } catch (err) {
          setError(t("common.error"));
        } finally {
          setInitialLoading(false);
        }
      };
      fetchPlan();
    }
  }, [id, isEdit, t]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData({ 
      ...formData, 
      [name]: type === "number" ? (value === "" ? "" : parseFloat(value)) : value 
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isEdit) {
        await axiosInstance.put(`/plans/${id}`, formData);
      } else {
        await axiosInstance.post("/plans", formData);
      }
      navigate("/plans");
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
          onClick={() => navigate("/plans")}
          sx={{
            bgcolor: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#f8fafc",
            "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
          }}
        >
          <ArrowBackRounded />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight="800" sx={{ color: "#f8fafc", letterSpacing: "-0.5px" }}>
            {isEdit ? t("plans.editPlan", "Edit Plan") : t("plans.addPlan", "Add Plan")}
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>{error}</Alert>}

      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 5 },
          bgcolor: "rgba(30, 41, 59, 0.7)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 4,
          animation: "fadeInUp 0.6s ease-out both",
        }}
      >
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={t("plans.planName", "Plan Name")}
                name="planName"
                value={formData.planName}
                onChange={handleChange}
                required
                sx={textFieldSx}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                type="number"
                label={t("plans.monthlyPrice", "Monthly Price ($)")}
                name="monthlyPrice"
                value={formData.monthlyPrice}
                onChange={handleChange}
                required
                inputProps={{ step: "0.01", min: "0" }}
                sx={textFieldSx}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                type="number"
                label={t("plans.annualPrice", "Annual Price ($)")}
                name="annualPrice"
                value={formData.annualPrice}
                onChange={handleChange}
                required
                inputProps={{ step: "0.01", min: "0" }}
                sx={textFieldSx}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                type="number"
                label={t("plans.maxDoctors", "Max Doctors")}
                name="maxDoctors"
                value={formData.maxDoctors}
                onChange={handleChange}
                required
                inputProps={{ min: "1" }}
                sx={textFieldSx}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                type="number"
                label={t("plans.maxBranches", "Max Branches")}
                name="maxBranches"
                value={formData.maxBranches}
                onChange={handleChange}
                required
                inputProps={{ min: "1" }}
                sx={textFieldSx}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                type="number"
                label={t("plans.maxStorageGb", "Max Storage (GB)")}
                name="maxStorageGb"
                value={formData.maxStorageGb}
                onChange={handleChange}
                required
                inputProps={{ min: "1" }}
                sx={textFieldSx}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                multiple
                options={AVAILABLE_MODULES}
                value={formData.featuresJson}
                onChange={(_, newValue) => setFormData({ ...formData, featuresJson: newValue })}
                renderTags={(value: readonly string[], getTagProps) =>
                  value.map((option: string, index: number) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    return (
                      <Chip 
                        variant="outlined" 
                        label={option} 
                        key={key} 
                        {...tagProps} 
                        sx={{ color: "#34d399", borderColor: "rgba(16, 185, 129, 0.4)", bgcolor: "rgba(16, 185, 129, 0.1)" }}
                      />
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t("plans.features", "Included Modules/Features")}
                    placeholder="Select modules"
                    sx={textFieldSx}
                  />
                )}
                slotProps={{
                  paper: {
                    sx: {
                      bgcolor: "#1e293b",
                      color: "#f8fafc",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "12px",
                      mt: 1,
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)"
                    }
                  }
                }}
                ListboxProps={{
                  sx: {
                    p: 1,
                    "& .MuiAutocomplete-option": {
                      borderRadius: "8px",
                      my: 0.5,
                      py: 1.2,
                      px: 2,
                      '&[aria-selected="true"]': {
                        backgroundColor: "rgba(16, 185, 129, 0.25) !important",
                        color: "#34d399",
                      },
                      '&.Mui-focused': {
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                      }
                    }
                  }
                }}
                sx={{
                  "& .MuiOutlinedInput-root": { backgroundColor: "rgba(15, 23, 42, 0.4)" }
                }}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 3 }}>
                <Button 
                  variant="outlined" 
                  onClick={() => navigate("/plans")} 
                  disabled={loading} 
                  sx={{ 
                    borderColor: "rgba(255,255,255,0.2)", 
                    color: "#cbd5e1",
                    "&:hover": { borderColor: "rgba(255,255,255,0.4)" }
                  }}
                >
                  {t("common.cancel", "Cancel")}
                </Button>
                <Button 
                  type="submit" 
                  variant="contained" 
                  disabled={loading} 
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveRounded />} 
                  sx={{ 
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    boxShadow: "0 4px 14px 0 rgba(16, 185, 129, 0.39)",
                  }}
                >
                  {loading ? t("common.saving", "Saving...") : t("common.save", "Save Plan")}
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
    color: "#f1f5f9",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)", borderRadius: "12px" },
    "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
    "&.Mui-focused fieldset": { borderColor: "#10b981" },
  },
  "& .MuiInputLabel-root": { color: "#94a3b8" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#10b981" },
  "& input[type=number]::-webkit-inner-spin-button, & input[type=number]::-webkit-outer-spin-button": {
    WebkitAppearance: "none",
    margin: 0,
  },
  "& input[type=number]": {
    MozAppearance: "textfield",
  },
};
