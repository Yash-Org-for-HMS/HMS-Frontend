import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Box,
  Container,
  Button,
  Paper,
  TextField,
  IconButton,
  Alert,
  Autocomplete,
  Chip
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { ArrowBackRounded, SaveRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import FormSkeleton from "../../components/skeletons/FormSkeleton";
import { useToast } from "../../contexts/ToastContext";
import FormHeader from "../../components/layout/FormHeader";
import { validate, hasErrors, required, isNonNegativeNumber, min } from "../../utils/validation";
import { apiErrorText } from "../../utils/apiError";

export default function PlanForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const [formData, setFormData] = useState<any>({
    planName: "",
    monthlyPrice: "",
    annualPrice: "",
    maxDoctors: "",
    maxBranches: "",
    maxStorageGb: "",
    featuresJson: [] as string[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: planData, isLoading: initialLoading, isError, error, refetch } = useQuery({
    queryKey: ["plan", id],
    queryFn: async () => (await axiosInstance.get(`/plans/${id}`)).data.data,
    enabled: isEdit,
  });

  // Module options come from the backend registry (single source of truth) —
  // not a hardcoded list — so plans only ever reference real, built modules.
  const { data: moduleList = [] } = useQuery({
    queryKey: ["modules-registry"],
    queryFn: async () => (await axiosInstance.get("/modules")).data.data as { key: string; label: string }[],
  });
  const moduleKeys = moduleList.map((m) => m.key);

  // Seed the form with the existing plan when editing.
  useEffect(() => {
    if (!planData) return;
    const d = planData;
    setFormData({
      planName: d.planName || "",
      monthlyPrice: d.monthlyPrice !== null ? parseFloat(d.monthlyPrice) : "",
      annualPrice: d.annualPrice !== null ? parseFloat(d.annualPrice) : "",
      maxDoctors: d.maxDoctors !== null ? d.maxDoctors : "",
      maxBranches: d.maxBranches !== null ? d.maxBranches : "",
      maxStorageGb: d.maxStorageGb !== null ? d.maxStorageGb : "",
      featuresJson: Array.isArray(d.featuresJson) ? d.featuresJson : [],
    });
  }, [planData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === "number" ? (value === "" ? "" : parseFloat(value)) : value
    });
    setErrors((prev) => (prev[name] ? { ...prev, [name]: "" } : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const found = validate(formData, {
      planName: [required("Plan name")],
      monthlyPrice: [required("Monthly price"), isNonNegativeNumber],
      annualPrice: [required("Annual price"), isNonNegativeNumber],
      maxDoctors: [required("Max doctors"), min(1)],
      maxBranches: [required("Max branches"), min(1)],
      maxStorageGb: [required("Max storage"), min(0)],
    });
    if (hasErrors(found)) {
      setErrors(found as Record<string, string>);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        await axiosInstance.put(`/plans/${id}`, formData);
      } else {
        await axiosInstance.post("/plans", formData);
      }
      navigate("/plans");
    } catch (err: any) {
      toast.error(err.response?.data?.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <FormSkeleton />
    );
  }

  if (isError) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <ErrorState title="Couldn't load plan" message={apiErrorText(error)} onRetry={() => refetch()} />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <FormHeader
        title={isEdit ? t("plans.editPlan", "Edit Plan") : t("plans.addPlan", "Add Plan")}
        onBack={() => navigate("/plans")}
      />
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
                fullWidth
                label={t("plans.planName", "Plan Name")}
                name="planName"
                value={formData.planName}
                onChange={handleChange}
                required
                error={!!errors.planName}
                helperText={errors.planName}
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
                error={!!errors.monthlyPrice}
                helperText={errors.monthlyPrice}
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
                error={!!errors.annualPrice}
                helperText={errors.annualPrice}
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
                error={!!errors.maxDoctors}
                helperText={errors.maxDoctors}
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
                error={!!errors.maxBranches}
                helperText={errors.maxBranches}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                type="number"
                label={t("plans.maxStorageGb", "Max Storage (GB)")}
                name="maxStorageGb"
                error={!!errors.maxStorageGb}
                helperText={errors.maxStorageGb}
                value={formData.maxStorageGb}
                onChange={handleChange}
                required
                inputProps={{ min: "1" }}
                
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                multiple
                options={moduleKeys}
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
                        sx={{ color: "#059669", borderColor: "rgba(16, 185, 129, 0.4)", bgcolor: "rgba(16, 185, 129, 0.1)" }}
                      />
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t("plans.features", "Included Modules/Features")}
                    placeholder="Select modules"
                    
                  />
                )}
                slotProps={{
                  paper: {
                    sx: {
                      bgcolor: "background.paper",
                      color: "text.primary",
                      border: "1px solid", borderColor: "divider",
                      borderRadius: "12px",
                      mt: 1,
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)"
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
                        backgroundColor: "rgba(16, 185, 129, 0.15) !important",
                        color: "#059669",
                      },
                      '&.Mui-focused': {
                        backgroundColor: "action.hover",
                      }
                    }
                  }
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
    color: "text.primary",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    "& fieldset": { borderColor: "divider", borderRadius: "12px" },
    "&:hover fieldset": { borderColor: "divider" },
    "&.Mui-focused fieldset": { borderColor: "#10b981" },
  },
  "& .MuiInputLabel-root": { color: "text.secondary" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#10b981" },
  "& input[type=number]::-webkit-inner-spin-button, & input[type=number]::-webkit-outer-spin-button": {
    WebkitAppearance: "none",
    margin: 0,
  },
  "& input[type=number]": {
    MozAppearance: "textfield",
  },
};
