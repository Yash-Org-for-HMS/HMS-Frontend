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
  CircularProgress
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { ArrowBackRounded, SaveRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function LeadForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    hospitalName: "",
    contactPersonName: "",
    email: "",
    phone: "",
    leadStatus: "new",
    assignedSalesAdminId: "",
  });

  const [admins, setAdmins] = useState<any[]>([]);

  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const response = await axiosInstance.get("/super-admins", { params: { limit: 100 } });
        setAdmins(response.data.data);
      } catch (err) {
        console.error("Failed to fetch super admins", err);
      }
    };
    fetchAdmins();

    if (isEdit) {
      const fetchLead = async () => {
        try {
          const response = await axiosInstance.get(`/leads/${id}`);
          setFormData({
            hospitalName: response.data.data.hospitalName || "",
            contactPersonName: response.data.data.contactPersonName || "",
            email: response.data.data.email || "",
            phone: response.data.data.phone || "",
            leadStatus: response.data.data.leadStatus || "new",
            assignedSalesAdminId: response.data.data.assignedSalesAdminId || "",
          });
        } catch (err) {
          setError(t("common.error"));
        } finally {
          setInitialLoading(false);
        }
      };
      fetchLead();
    }
  }, [id, isEdit, t]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isEdit) {
        await axiosInstance.put(`/leads/${id}`, {
          hospitalName: formData.hospitalName,
          contactPersonName: formData.contactPersonName,
          email: formData.email,
          phone: formData.phone,
        });
        if (formData.assignedSalesAdminId) {
          await axiosInstance.patch(`/leads/${id}/assign`, { assignedToUserId: formData.assignedSalesAdminId });
        }
      } else {
        const response = await axiosInstance.post("/leads", formData);
        const newLeadId = response.data.data?.hospitalLeadId;
        if (formData.assignedSalesAdminId && newLeadId) {
          await axiosInstance.patch(`/leads/${newLeadId}/assign`, { assignedToUserId: formData.assignedSalesAdminId });
        }
      }
      navigate("/leads");
    } catch (err: any) {
      setError(err.response?.data?.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: "#6366f1" }} />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 4, gap: 2 }}>
        <IconButton
          onClick={() => navigate("/leads")}
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
            {isEdit ? t("leads.editLead") : t("leads.addLead")}
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
          animation: "fadeInUp 0.6s ease-out both",
        }}
      >
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={t("leads.hospitalName")}
                name="hospitalName"
                value={formData.hospitalName}
                onChange={handleChange}
                required
                
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={t("leads.contactPerson")}
                name="contactPersonName"
                value={formData.contactPersonName}
                onChange={handleChange}
                required
                
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={t("leads.email")}
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={t("leads.phone")}
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                select
                fullWidth
                label={t("leads.status")}
                name="leadStatus"
                value={formData.leadStatus}
                onChange={handleChange}
                
              >
                <MenuItem value="new">{t("leads.statusNew")}</MenuItem>
                <MenuItem value="contacted">{t("leads.statusContacted")}</MenuItem>
                <MenuItem value="qualified">{t("leads.statusQualified")}</MenuItem>
                <MenuItem value="demo_done">{t("leads.statusDemoDone")}</MenuItem>
                <MenuItem value="converted">{t("leads.statusConverted")}</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                select
                fullWidth
                label="Assign To (Super Admin)"
                name="assignedSalesAdminId"
                value={formData.assignedSalesAdminId}
                onChange={handleChange}
                
                SelectProps={{ MenuProps: { sx: { "& .MuiPaper-root": { bgcolor: "background.paper", color: "text.primary", border: "1px solid", borderColor: "divider" } } } }}
              >
                <MenuItem value="">Unassigned</MenuItem>
                {admins.map((admin) => (
                  <MenuItem key={admin.superAdminId} value={admin.superAdminId}>
                    {admin.firstName} {admin.lastName} ({admin.email})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 3 }}>
                <Button 
                  variant="outlined" 
                  onClick={() => navigate("/leads")} 
                  disabled={loading} 
                  sx={{ 
                    borderColor: "divider", 
                    color: "text.primary",
                    "&:hover": { borderColor: "divider" }
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <Button 
                  type="submit" 
                  variant="contained" 
                  disabled={loading} 
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveRounded />} 
                  sx={{ 
                    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                    boxShadow: "0 4px 14px 0 rgba(99, 102, 241, 0.39)",
                  }}
                >
                  {loading ? t("common.saving") : t("common.save")}
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
    "&.Mui-focused fieldset": { borderColor: "#6366f1" },
  },
  "& .MuiInputLabel-root": { color: "text.secondary" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#6366f1" },
};
