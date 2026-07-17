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
  MenuItem,
  IconButton,
  Alert,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { ArrowBackRounded, SaveRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import FormSkeleton from "../../components/skeletons/FormSkeleton";
import { useToast } from "../../contexts/ToastContext";
import FormHeader from "../../components/layout/FormHeader";
import { validate, hasErrors, required, isEmail, isPhone, minLen, type Errors } from "../../utils/validation";
import { apiErrorText } from "../../utils/apiError";

export default function SuperAdminForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    status: "active",
  });
  const [errors, setErrors] = useState<Errors<typeof formData>>({});

  const { data: adminData, isLoading: initialLoading, isError, error, refetch } = useQuery({
    queryKey: ["super-admin", id],
    queryFn: async () => (await axiosInstance.get(`/super-admins/${id}`)).data.data,
    enabled: isEdit,
  });

  // Seed the form with the existing admin when editing.
  useEffect(() => {
    if (!adminData) return;
    const d = adminData;
    setFormData({
      firstName: d.firstName || "",
      lastName: d.lastName || "",
      email: d.email || "",
      phone: d.phone || "",
      password: "",
      status: d.status || "active",
    });
  }, [adminData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors((prev) => (prev[name as keyof typeof formData] ? { ...prev, [name]: undefined } : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const found = validate(formData, {
      firstName: [required("First name")],
      lastName: [required("Last name")],
      email: [required("Email"), isEmail],
      phone: [isPhone],
      // Password required on create (min 8); on edit, blank keeps the current one.
      password: isEdit ? [] : [required("Password"), minLen(8, "Password")],
    });
    if (hasErrors(found)) {
      setErrors(found);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setLoading(true);
    try {
      const dataToSubmit = { ...formData };
      if (isEdit && !dataToSubmit.password) {
        delete (dataToSubmit as any).password;
      }
      
      if (isEdit) {
        await axiosInstance.put(`/super-admins/${id}`, dataToSubmit);
      } else {
        await axiosInstance.post("/super-admins", dataToSubmit);
      }
      navigate("/super-admins");
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
        <ErrorState title="Couldn't load admin" message={apiErrorText(error)} onRetry={() => refetch()} />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <FormHeader
        title={isEdit ? t("superAdmins.editAdmin", "Edit Super Admin") : t("superAdmins.addAdmin", "Add Super Admin")}
        onBack={() => navigate("/super-admins")}
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
                label={t("superAdmins.firstName", "First Name")}
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                error={!!errors.firstName}
                helperText={errors.firstName}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={t("superAdmins.lastName", "Last Name")}
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                error={!!errors.lastName}
                helperText={errors.lastName}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                type="email"
                label={t("superAdmins.email", "Email Address")}
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                error={!!errors.email}
                helperText={errors.email}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={t("superAdmins.phone", "Phone Number")}
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                error={!!errors.phone}
                helperText={errors.phone}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                type="password"
                label={isEdit ? t("superAdmins.newPassword", "New Password (Optional)") : t("superAdmins.password", "Password")}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required={!isEdit}
                error={!!errors.password}
                helperText={errors.password || (isEdit ? "Leave blank to keep current password" : "At least 8 characters")}
                FormHelperTextProps={{ sx: { color: "text.secondary" } }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                select
                fullWidth
                label={t("superAdmins.status", "Status")}
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
                
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: {
                        bgcolor: "background.paper",
                        color: "text.primary",
                        border: "1px solid", borderColor: "divider",
                        "& .MuiMenuItem-root": { py: 1.8, px: 2 }
                      }
                    }
                  }
                }}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="suspended">Suspended</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </TextField>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 3 }}>
                <Button 
                  variant="outlined" 
                  onClick={() => navigate("/super-admins")} 
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
                    background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
                    boxShadow: "0 4px 14px 0 rgba(139, 92, 246, 0.39)",
                  }}
                >
                  {loading ? t("common.saving", "Saving...") : t("common.save", "Save Admin")}
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
    "&.Mui-focused fieldset": { borderColor: "#8b5cf6" },
  },
  "& .MuiInputLabel-root": { color: "text.secondary" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#8b5cf6" },
};
