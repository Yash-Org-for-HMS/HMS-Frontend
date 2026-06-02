import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

export default function TrialForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    leadId: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString().split("T")[0], // 14 days from now
    notes: "",
  });

  useEffect(() => {
    // Fetch non-converted leads for the dropdown
    const fetchLeads = async () => {
      try {
        const response = await axiosInstance.get("/leads", { params: { limit: 1000 } });
        // Filter out leads that are already converted
        setLeads(response.data.data.filter((l: any) => l.leadStatus !== "converted"));
      } catch (err) {
        console.error(err);
        setError("Failed to load leads");
      } finally {
        setInitialLoading(false);
      }
    };
    fetchLeads();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await axiosInstance.post("/trials", {
        leadId: formData.leadId,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
      });
      navigate("/trials");
    } catch (err: any) {
      setError(err.response?.data?.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: "#ec4899" }} />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 4, gap: 2 }}>
        <IconButton
          onClick={() => navigate("/trials")}
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
            {t("trials.addTrial")}
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
                select
                fullWidth
                label={t("trials.selectLead")}
                name="leadId"
                value={formData.leadId}
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
                        "& .MuiMenuItem-root": {
                          py: 1.5,
                          px: 2,
                          "&:hover": {
                            bgcolor: "rgba(255, 255, 255, 0.05)"
                          },
                          "&.Mui-selected": {
                            bgcolor: "rgba(236, 72, 153, 0.2)",
                            color: "#f472b6",
                            "&:hover": {
                              bgcolor: "rgba(236, 72, 153, 0.25)"
                            }
                          }
                        }
                      }
                    }
                  }
                }}
              >
                {leads.map(lead => (
                  <MenuItem key={lead.hospitalLeadId} value={lead.hospitalLeadId}>
                    {lead.hospitalName} ({lead.contactPersonName || "No Contact Person"})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                type="date"
                label={t("trials.startDate")}
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                required
                InputLabelProps={{ shrink: true }}
                sx={textFieldSx}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                type="date"
                label={t("trials.endDate")}
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                required
                InputLabelProps={{ shrink: true }}
                sx={textFieldSx}
              />
            </Grid>
            
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 3 }}>
                <Button 
                  variant="outlined" 
                  onClick={() => navigate("/trials")} 
                  disabled={loading} 
                  sx={{ 
                    borderColor: "rgba(255,255,255,0.2)", 
                    color: "#cbd5e1",
                    "&:hover": { borderColor: "rgba(255,255,255,0.4)" }
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
                    background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
                    boxShadow: "0 4px 14px 0 rgba(236, 72, 153, 0.39)",
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
    color: "#f1f5f9",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)", borderRadius: "12px" },
    "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
    "&.Mui-focused fieldset": { borderColor: "#ec4899" },
  },
  "& .MuiInputLabel-root": { color: "#94a3b8" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#ec4899" },
};
