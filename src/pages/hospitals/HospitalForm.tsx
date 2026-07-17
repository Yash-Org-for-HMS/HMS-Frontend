import { useState, useEffect } from "react";
import { getApiErrorMessage, apiErrorText } from "../../utils/apiError";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Autocomplete,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { ArrowBackRounded, SaveRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import FormSkeleton from "../../components/skeletons/FormSkeleton";
import { useToast } from "../../providers/ToastContext";
import { useConfirm } from "../../providers/ConfirmContext";
import FormHeader from "../../components/layout/FormHeader";
import BranchDialog from "../../components/hospitals/BranchDialog";
import { validate, hasErrors, required, isEmail, isPhone, type Errors } from "../../utils/validation";

export default function HospitalForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [searchParams] = useSearchParams();
  const trialId = searchParams.get("trialId");
  const isConvert = Boolean(trialId);

  const [loading, setLoading] = useState(false);
  const [convertResult, setConvertResult] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const toast = useToast();
  const confirm = useConfirm();
  const [branches, setBranches] = useState<any[]>([]);
  const [reload, setReload] = useState(0);

  const { data: plans = [] } = useQuery<any[]>({
    queryKey: ["plans", "hospital-form-options"],
    queryFn: async () => (await axiosInstance.get("/plans", { params: { limit: 100 } })).data.data,
  });
  const { data: convertedTrials = [] } = useQuery<any[]>({
    queryKey: ["trials", "available"],
    queryFn: async () =>
      ((await axiosInstance.get("/trials", { params: { limit: 1000 } })).data.data as any[]).filter(
        (t: any) => t.trialStatus !== "converted"
      ),
  });

  const { data: hospitalData, isLoading: initialLoading, isError, error, refetch } = useQuery({
    queryKey: ["hospital", id, reload],
    queryFn: async () => (await axiosInstance.get(`/hospitals/${id}`)).data.data,
    enabled: isEdit,
  });

  // When converting a trial, load it so we can prefill from its lead + plan.
  const { data: trialData } = useQuery({
    queryKey: ["trial", trialId],
    queryFn: async () => (await axiosInstance.get(`/trials/${trialId}`)).data.data,
    enabled: isConvert,
  });

  // Branch dialog target: null = closed, { editing } = open (editing null => add).
  const [branchDialog, setBranchDialog] = useState<{ editing: any | null } | null>(null);

  const [formData, setFormData] = useState({
    hospitalName: "",
    hospitalCode: "",
    officialEmail: "",
    officialPhone: "",
    legalBusinessName: "",
    status: "active",
    planId: "",
  });
  const [errors, setErrors] = useState<Errors<typeof formData>>({});

  // Prefill from the trial being converted (lead contact + the trial's plan).
  useEffect(() => {
    if (!trialData) return;
    setFormData(prev => ({
      ...prev,
      hospitalName: trialData.lead?.hospitalName || prev.hospitalName,
      officialEmail: trialData.lead?.email || prev.officialEmail,
      officialPhone: trialData.lead?.phone || prev.officialPhone,
      planId: trialData.subscriptionPlanId || prev.planId,
    }));
  }, [trialData]);

  // Seed the form + branches with the existing hospital when editing.
  useEffect(() => {
    if (!hospitalData) return;
    const d = hospitalData;
    setFormData({
      hospitalName: d.hospitalName || "",
      hospitalCode: d.hospitalCode || "",
      officialEmail: d.officialEmail || "",
      officialPhone: d.officialPhone || "",
      legalBusinessName: d.legalBusinessName || "",
      status: d.status || "active",
      planId: d.subscriptionPlanId || "",
    });
    setBranches(d.branches || []);
  }, [hospitalData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors((prev) => (prev[name as keyof typeof formData] ? { ...prev, [name]: undefined } : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isConvert && !formData.planId) {
      toast.error("Please choose a subscription plan for this hospital");
      return;
    }

    const found = validate(formData, {
      hospitalName: [required("Hospital name")],
      officialEmail: [isEmail],
      officialPhone: [isPhone],
    });
    if (hasErrors(found)) {
      setErrors(found);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setLoading(true);
    try {
      if (isConvert && trialId) {
        // Single provisioning path: convert the trial → hospital + admin login.
        const res = await axiosInstance.post(`/trials/${trialId}/convert`, {
          hospitalName: formData.hospitalName,
          contactPersonName: trialData?.lead?.contactPersonName || formData.hospitalName || "Admin",
          email: formData.officialEmail,
          phone: formData.officialPhone,
          planId: formData.planId,
        });
        const admin = res.data?.data?.admin;
        if (admin?.temporaryPassword) {
          setConvertResult({ email: admin.email, temporaryPassword: admin.temporaryPassword });
        } else {
          toast.success("Hospital created");
          navigate("/hospitals");
        }
        return;
      }
      if (isEdit) {
        await axiosInstance.put(`/hospitals/${id}`, formData);
      } else {
        await axiosInstance.post("/hospitals", formData);
      }
      navigate("/hospitals");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t("common.error")));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    const ok = await confirm({
      title: "Delete branch",
      message: "Are you sure you want to delete this branch? This cannot be undone.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await axiosInstance.delete(`/hospitals/${id}/branches/${branchId}`);
      setReload(r => r + 1);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to delete branch"));
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
        <ErrorState title="Couldn't load hospital" message={apiErrorText(error)} onRetry={() => refetch()} />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <FormHeader
        title={isConvert ? "Convert Trial → New Hospital" : isEdit ? t("hospitals.editHospital", "Edit Hospital") : t("hospitals.addHospital", "Add Hospital")}
        onBack={() => navigate("/hospitals")}
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
            {isConvert && (
              <Grid size={{ xs: 12 }}>
                <Alert severity="info">
                  Converting the trial for <b>{trialData?.lead?.hospitalName || "this prospect"}</b> — this provisions a live hospital on the selected plan and creates the admin login.
                </Alert>
              </Grid>
            )}
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                freeSolo
                forcePopupIcon={true}
                options={convertedTrials.map((t) => t.lead?.hospitalName).filter(Boolean)}
                value={formData.hospitalName}
                onInputChange={(e, newValue) => {
                  setFormData((prev) => ({ ...prev, hospitalName: newValue || "" }));
                }}
                onChange={(e, newValue) => {
                  if (newValue) {
                    const trial = convertedTrials.find(t => t.lead?.hospitalName === newValue);
                    if (trial && trial.lead) {
                      setFormData(prev => ({
                        ...prev,
                        hospitalName: trial.lead.hospitalName,
                        officialEmail: prev.officialEmail || trial.lead.email || "",
                        officialPhone: prev.officialPhone || trial.lead.phone || ""
                      }));
                    }
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t("hospitals.name", "Hospital Name")}
                    required
                    
                  />
                )}
                PaperComponent={({ children }) => (
                  <Paper sx={{ bgcolor: "background.paper", color: "text.primary", border: "1px solid", borderColor: "divider" }}>
                    {children}
                  </Paper>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={t("hospitals.code", "Hospital Code")}
                name="hospitalCode"
                value={formData.hospitalCode}
                onChange={handleChange}
                disabled={!isEdit}
                placeholder={isEdit ? "" : "Auto-generated"}
                inputProps={{ maxLength: 10, style: { textTransform: "uppercase" } }}
                helperText={isEdit ? "Unique identifier (e.g. CITY01)" : "Auto-generated if left blank"}
                
                FormHelperTextProps={{ sx: { color: "text.secondary" } }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={t("hospitals.legalName", "Legal Business Name")}
                name="legalBusinessName"
                value={formData.legalBusinessName}
                onChange={handleChange}
                
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                type="email"
                label={t("hospitals.email", "Official Email")}
                name="officialEmail"
                value={formData.officialEmail}
                onChange={handleChange}
                error={!!errors.officialEmail}
                helperText={errors.officialEmail}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={t("hospitals.phone", "Official Phone")}
                name="officialPhone"
                value={formData.officialPhone}
                onChange={handleChange}
                error={!!errors.officialPhone}
                helperText={errors.officialPhone}
              />
            </Grid>
            {isConvert && (
              <Grid size={{ xs: 12 }}>
                <TextField
                  select
                  fullWidth
                  required
                  label="Subscription plan"
                  name="planId"
                  value={formData.planId}
                  onChange={handleChange}
                  helperText="The hospital's first branch starts on this plan."
                >
                  {plans.length === 0 ? (
                    <MenuItem value="" disabled>No plans available — create one under Plans first</MenuItem>
                  ) : (
                    plans.map((p: any) => (
                      <MenuItem key={p.planId} value={p.planId}>{p.planName}</MenuItem>
                    ))
                  )}
                </TextField>
              </Grid>
            )}
            {!isConvert && (
            <Grid size={{ xs: 12 }}>
              <TextField
                select
                fullWidth
                label={t("hospitals.status", "Status")}
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
            )}

            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 3 }}>
                <Button 
                  variant="outlined" 
                  onClick={() => navigate("/hospitals")} 
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
                    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                    boxShadow: "0 4px 14px 0 rgba(59, 130, 246, 0.39)",
                  }}
                >
                  {loading ? t("common.saving", "Saving...") : isConvert ? "Convert & create hospital" : t("common.save", "Save Hospital")}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>

      {isEdit && (
        <Paper
          elevation={2}
          sx={{
            mt: 4,
            p: { xs: 3, md: 5 },
            bgcolor: "background.paper",
            backdropFilter: "blur(10px)",
            border: "1px solid", borderColor: "divider",
            borderRadius: 4,
            animation: "fadeInUp 0.8s ease-out both",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
            <Typography variant="h6" fontWeight="700" sx={{ color: "text.primary" }}>
              Hospital Branches
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={() => setBranchDialog({ editing: null })}
              sx={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}
            >
              Add Branch
            </Button>
          </Box>
          {branches.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>No branches found.</Typography>
          ) : (
            <Grid container spacing={2}>
              {branches.map(branch => (
                <Grid size={{ xs: 12 }} key={branch.branchId}>
                  <Box sx={{ p: 2, bgcolor: "background.paper", borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
                    <Typography variant="subtitle2" sx={{ color: "text.primary", fontWeight: 700 }}>
                      {branch.branchName}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 0.5, mb: 1.5, flexWrap: "wrap" }}>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        Code: {branch.branchCode}
                      </Typography>
                      <Chip
                        label={branch.subscriptionPlan?.planName || "No Plan"}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: "0.75rem",
                          bgcolor: "rgba(99, 102, 241, 0.15)",
                          color: "#a5b4fc"
                        }}
                      />
                    </Box>
                    <Box sx={{ display: "flex", gap: 2 }}>
                      <Button size="small" sx={{ minWidth: 0, p: 0, color: "#a5b4fc" }} onClick={() => setBranchDialog({ editing: branch })}>
                        Edit
                      </Button>
                      <Button size="small" color="error" onClick={() => handleDeleteBranch(branch.branchId)} sx={{ minWidth: 0, p: 0 }}>
                        Delete
                      </Button>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      )}

      <BranchDialog
        open={!!branchDialog}
        onClose={() => setBranchDialog(null)}
        hospitalId={id!}
        plans={plans}
        editingBranch={branchDialog?.editing ?? null}
        onSaved={() => setReload(r => r + 1)}
      />

      {/* One-time admin credentials after a trial conversion */}
      <Dialog open={!!convertResult} onClose={() => { setConvertResult(null); navigate("/hospitals"); }} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: "background.paper", borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Hospital created</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            Share these one-time credentials with the hospital admin — they'll set a new password on first login.
          </Typography>
          <Alert severity="info">
            <Box sx={{ mb: 0.5 }}><b>Email:</b> {convertResult?.email}</Box>
            <Box><b>Temp password:</b> <Box component="code" sx={{ fontFamily: "monospace" }}>{convertResult?.temporaryPassword}</Box></Box>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setConvertResult(null); navigate("/hospitals"); }} variant="contained">Done</Button>
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
    "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
  },
  "& .MuiInputLabel-root": { color: "text.secondary" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#3b82f6" },
};
