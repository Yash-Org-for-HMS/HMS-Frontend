import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { ArrowBackRounded, SaveRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import { useToast } from "../../contexts/ToastContext";
import PageHeader from "../../components/layout/PageHeader";

export default function TrialForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [trialCreds, setTrialCreds] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const toast = useToast();

  // A trial is for a PROSPECT, so only not-yet-converted leads can start one.
  const { data: leads = [], isLoading: initialLoading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["leads", "trial-options"],
    queryFn: async () =>
      ((await axiosInstance.get("/leads", { params: { limit: 1000 } })).data.data as any[]).filter(
        (l: any) => l.leadStatus !== "converted" && l.leadStatus !== "trialing"
      ),
  });

  // Plans define what the trial includes (modules / limits).
  const { data: plans = [] } = useQuery<any[]>({
    queryKey: ["plans", "trial-options"],
    queryFn: async () => (await axiosInstance.get("/plans", { params: { limit: 1000 } })).data.data ?? [],
  });

  const [formData, setFormData] = useState({
    leadId: "",
    planId: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString().split("T")[0], // 14 days from now
    notes: "",
    autoExpire: true,
  });

  const [duration, setDuration] = useState<number | "custom">(14);

  useEffect(() => {
    if (duration !== "custom" && formData.startDate) {
      const start = new Date(formData.startDate);
      if (!isNaN(start.getTime())) {
        const end = new Date(start.getTime());
        end.setDate(end.getDate() + duration);
        setFormData(prev => ({ ...prev, endDate: end.toISOString().split("T")[0] }));
      }
    }
  }, [duration, formData.startDate]);

  const calculateDaysRemaining = () => {
    if (!formData.endDate) return 0;
    const end = new Date(formData.endDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const endNormalized = new Date(end.getTime());
    endNormalized.setHours(0, 0, 0, 0);
    const diffTime = endNormalized.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axiosInstance.post("/trials", {
        leadId: formData.leadId,
        planId: formData.planId,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        autoExpire: formData.autoExpire,
      });
      const admin = res.data?.data?.admin;
      if (admin?.temporaryPassword) {
        // Trial provisioned a live hospital + admin login — surface the credentials.
        setTrialCreds({ email: admin.email, temporaryPassword: admin.temporaryPassword });
      } else {
        toast.success("Trial started");
        navigate("/trials");
      }
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
        <ErrorState title="Couldn't load leads" message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 4, gap: 2 }}>
        <IconButton
          onClick={() => navigate("/trials")}
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
          <PageHeader title={t("trials.addTrial")} />
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
                label={t("trials.selectLead")}
                name="leadId"
                value={formData.leadId}
                onChange={handleChange}
                required
                
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: {
                        bgcolor: "background.paper",
                        color: "text.primary",
                        border: "1px solid", borderColor: "divider",
                        "& .MuiMenuItem-root": {
                          py: 1.5,
                          px: 2,
                          "&:hover": { bgcolor: "action.hover" },
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
                select
                fullWidth
                label="Trial plan (defines what's included)"
                name="planId"
                value={formData.planId}
                onChange={handleChange}
                required
                helperText="The prospect's trial includes this plan's modules and limits."
              >
                {plans.length === 0 ? (
                  <MenuItem value="" disabled>No plans available — create one under Plans first</MenuItem>
                ) : (
                  plans.map((p: any) => (
                    <MenuItem key={p.planId} value={p.planId}>
                      {p.planName}
                      {p.monthlyPrice != null ? ` — ₹${Number(p.monthlyPrice).toLocaleString("en-IN")}/mo` : ""}
                    </MenuItem>
                  ))
                )}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="date"
                label={t("trials.startDate")}
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                required
                InputLabelProps={{ shrink: true }}
                
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                fullWidth
                label="Duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value as any)}
                
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      sx: {
                        bgcolor: "background.paper",
                        color: "text.primary",
                        border: "1px solid", borderColor: "divider",
                        "& .MuiMenuItem-root": {
                          py: 1.5,
                          px: 2,
                          "&:hover": { bgcolor: "action.hover" },
                          "&.Mui-selected": { bgcolor: "rgba(236, 72, 153, 0.2)", color: "#f472b6" }
                        }
                      }
                    }
                  }
                }}
              >
                <MenuItem value={7}>7 Days</MenuItem>
                <MenuItem value={14}>14 Days</MenuItem>
                <MenuItem value={30}>30 Days</MenuItem>
                <MenuItem value="custom">Custom Date</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                type="date"
                label={t("trials.endDate")}
                name="endDate"
                value={formData.endDate}
                onChange={(e) => {
                  setDuration("custom");
                  handleChange(e);
                }}
                disabled={duration !== "custom"}
                required
                InputLabelProps={{ shrink: true }}
                sx={{
                  "& .Mui-disabled": {
                    WebkitTextFillColor: "#94a3b8 !important",
                  }
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ height: "100%", display: "flex", alignItems: "center", p: 2, bgcolor: "background.paper", borderRadius: "12px", border: "1px solid", borderColor: "divider" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <Typography sx={{ color: "text.secondary" }}>Days Remaining:</Typography>
                  <Typography sx={{ color: "#ec4899", fontWeight: 800, fontSize: "1.2rem" }}>
                    {calculateDaysRemaining()} Days
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.autoExpire}
                    onChange={(e) => setFormData(prev => ({ ...prev, autoExpire: e.target.checked }))}
                  />
                }
                label="Automatically expire this trial after its end date"
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 3 }}>
                <Button 
                  variant="outlined" 
                  onClick={() => navigate("/trials")} 
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

      {/* Trial admin credentials — the trial provisions a live hospital + login */}
      <Dialog open={!!trialCreds} onClose={() => { setTrialCreds(null); navigate("/trials"); }} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: "background.paper", borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Trial started</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            A live hospital was created for this trial. Share these one-time login credentials with the hospital admin — they'll set a new password on first login.
          </Typography>
          <Alert severity="info">
            <Box sx={{ mb: 0.5 }}><b>Login email:</b> {trialCreds?.email}</Box>
            <Box><b>Temp password:</b> <Box component="code" sx={{ fontFamily: "monospace" }}>{trialCreds?.temporaryPassword}</Box></Box>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setTrialCreds(null); navigate("/trials"); }} variant="contained">Done</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    color: "text.primary",
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    "& fieldset": { borderColor: "divider", borderRadius: "12px" },
    "&:hover fieldset": { borderColor: "divider" },
    "&.Mui-focused fieldset": { borderColor: "#ec4899" },
  },
  "& .MuiInputLabel-root": { color: "text.secondary" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#ec4899" },
};
