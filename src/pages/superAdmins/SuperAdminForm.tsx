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
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { ArrowBackRounded, SaveRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function SuperAdminForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    status: "active",
  });

  useEffect(() => {
    if (isEdit) {
      const fetchAdmin = async () => {
        try {
          const response = await axiosInstance.get(`/super-admins/${id}`);
          const d = response.data.data;
          setFormData({
            firstName: d.firstName || "",
            lastName: d.lastName || "",
            email: d.email || "",
            phone: d.phone || "",
            password: "",
            status: d.status || "active",
          });
        } catch (err) {
          setError(t("common.error"));
        } finally {
          setInitialLoading(false);
        }
      };
      fetchAdmin();
    }
  }, [id, isEdit, t]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
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
      setError(err.response?.data?.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: "#8b5cf6" }} />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 4, gap: 2 }}>
        <IconButton
          onClick={() => navigate("/super-admins")}
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
            {isEdit ? t("superAdmins.editAdmin", "Edit Super Admin") : t("superAdmins.addAdmin", "Add Super Admin")}
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
                label={t("superAdmins.firstName", "First Name")}
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                sx={textFieldSx}
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
                sx={textFieldSx}
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
                sx={textFieldSx}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={t("superAdmins.phone", "Phone Number")}
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                sx={textFieldSx}
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
                sx={textFieldSx}
                helperText={isEdit ? "Leave blank to keep current password" : "At least 8 characters"}
                FormHelperTextProps={{ sx: { color: "#94a3b8" } }}
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
                sx={textFieldSx}
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: {
                        bgcolor: "#1e293b",
                        color: "#f8fafc",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
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
    color: "#f1f5f9",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)", borderRadius: "12px" },
    "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
    "&.Mui-focused fieldset": { borderColor: "#8b5cf6" },
  },
  "& .MuiInputLabel-root": { color: "#94a3b8" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#8b5cf6" },
};
