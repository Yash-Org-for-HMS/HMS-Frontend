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
  Alert
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { ArrowBackRounded, SaveRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import PageLoader from "../../components/PageLoader";
import { useToast } from "../../contexts/ToastContext";
import FormHeader from "../../components/layout/FormHeader";
import { validate, hasErrors, required, isEmail, isPhone, type Errors } from "../../utils/validation";

export default function LeadForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const [formData, setFormData] = useState({
    hospitalName: "",
    contactPersonName: "",
    email: "",
    phone: "",
    leadStatus: "new",
    assignedSalesAdminId: "",
  });
  const [errors, setErrors] = useState<Errors<typeof formData>>({});

  const { data: admins = [] } = useQuery<any[]>({
    queryKey: ["super-admins", "lead-options"],
    queryFn: async () => (await axiosInstance.get("/super-admins", { params: { limit: 100 } })).data.data,
  });

  const { data: leadData, isLoading: initialLoading, isError, error, refetch } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => (await axiosInstance.get(`/leads/${id}`)).data.data,
    enabled: isEdit,
  });

  // Seed the form with the existing lead when editing.
  useEffect(() => {
    if (!leadData) return;
    setFormData({
      hospitalName: leadData.hospitalName || "",
      contactPersonName: leadData.contactPersonName || "",
      email: leadData.email || "",
      phone: leadData.phone || "",
      leadStatus: leadData.leadStatus || "new",
      assignedSalesAdminId: leadData.assignedSalesAdminId || "",
    });
  }, [leadData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors((prev) => (prev[e.target.name as keyof typeof formData] ? { ...prev, [e.target.name]: undefined } : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const found = validate(formData, {
      hospitalName: [required("Hospital name")],
      contactPersonName: [required("Contact person")],
      email: [required("Email"), isEmail],
      phone: [required("Phone"), isPhone],
    });
    if (hasErrors(found)) {
      setErrors(found);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setLoading(true);
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
      toast.error(err.response?.data?.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <PageLoader />
    );
  }

  if (isError) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <ErrorState title="Couldn't load lead" message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <FormHeader
        title={isEdit ? t("leads.editLead") : t("leads.addLead")}
        onBack={() => navigate("/leads")}
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
                label={t("leads.hospitalName")}
                name="hospitalName"
                value={formData.hospitalName}
                onChange={handleChange}
                required
                error={!!errors.hospitalName}
                helperText={errors.hospitalName}
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
                error={!!errors.contactPersonName}
                helperText={errors.contactPersonName}
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
                error={!!errors.email}
                helperText={errors.email}
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
                error={!!errors.phone}
                helperText={errors.phone}
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
                  startIcon={loading ? <HeartbeatLoader size={22} /> : <SaveRounded />}
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
