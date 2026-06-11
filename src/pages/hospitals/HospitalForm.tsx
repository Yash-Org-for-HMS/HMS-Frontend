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
import { useToast } from "../../contexts/ToastContext";

export default function HospitalForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const toast = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [convertedTrials, setConvertedTrials] = useState<any[]>([]);
  const [reload, setReload] = useState(0);

  // Branch Dialog State
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [newBranch, setNewBranch] = useState({ code: "", name: "", subscriptionPlanId: "", status: "active" });
  const [branchLoading, setBranchLoading] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    hospitalName: "",
    hospitalCode: "",
    officialEmail: "",
    officialPhone: "",
    legalBusinessName: "",
    status: "active",
  });

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await axiosInstance.get("/plans", { params: { limit: 100 } });
        setPlans(response.data.data);
      } catch (err) {
        console.error(err);
      }
    };

    const fetchConvertedTrials = async () => {
      try {
        // Fetch all trials that haven't been converted to a hospital yet
        const response = await axiosInstance.get("/trials", { params: { limit: 1000 } });
        // Filter out trials that are already 'converted' to a hospital
        const availableTrials = response.data.data.filter((t: any) => t.trialStatus !== 'converted');
        setConvertedTrials(availableTrials);
      } catch (err) {
        console.error(err);
      }
    };

    fetchPlans();
    fetchConvertedTrials();

    if (isEdit) {
      const fetchHospital = async () => {
        try {
          const response = await axiosInstance.get(`/hospitals/${id}`);
          const d = response.data.data;
          setFormData({
            hospitalName: d.hospitalName || "",
            hospitalCode: d.hospitalCode || "",
            officialEmail: d.officialEmail || "",
            officialPhone: d.officialPhone || "",
            legalBusinessName: d.legalBusinessName || "",
            status: d.status || "active",
          });
          setBranches(d.branches || []);
        } catch (err) {
          toast.error(t("common.error"));
        } finally {
          setInitialLoading(false);
        }
      };
      fetchHospital();
    }
  }, [id, isEdit, t, reload]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await axiosInstance.put(`/hospitals/${id}`, formData);
      } else {
        await axiosInstance.post("/hospitals", formData);
      }
      navigate("/hospitals");
    } catch (err: any) {
      toast.error(err.response?.data?.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleAddBranchSubmit = async () => {
    if (!newBranch.code || !newBranch.name) return;
    setBranchLoading(true);
    try {
      if (editingBranchId) {
        await axiosInstance.put(`/hospitals/${id}/branches/${editingBranchId}`, { 
          branchCode: newBranch.code, 
          branchName: newBranch.name, 
          subscriptionPlanId: newBranch.subscriptionPlanId || undefined,
          status: newBranch.status 
        });
      } else {
        await axiosInstance.post(`/hospitals/${id}/branches`, { 
          branchCode: newBranch.code, 
          branchName: newBranch.name, 
          subscriptionPlanId: newBranch.subscriptionPlanId || undefined,
          status: newBranch.status 
        });
      }
      setReload(r => r + 1);
      setBranchDialogOpen(false);
      setNewBranch({ code: "", name: "", subscriptionPlanId: "", status: "active" });
      setEditingBranchId(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save branch");
    } finally {
      setBranchLoading(false);
    }
  };

  const handleAddBranch = () => {
    setEditingBranchId(null);
    setNewBranch({ code: "", name: "", subscriptionPlanId: "", status: "active" });
    setBranchDialogOpen(true);
  };

  const handleEditBranch = (branch: any) => {
    setEditingBranchId(branch.branchId);
    setNewBranch({
      code: branch.branchCode,
      name: branch.branchName,
      subscriptionPlanId: branch.subscriptionPlanId || "",
      status: branch.status || "active"
    });
    setBranchDialogOpen(true);
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (!window.confirm("Are you sure you want to delete this branch?")) return;
    try {
      await axiosInstance.delete(`/hospitals/${id}/branches/${branchId}`);
      setReload(r => r + 1);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete branch");
    }
  };

  if (initialLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: "#3b82f6" }} />
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 4, gap: 2 }}>
        <IconButton
          onClick={() => navigate("/hospitals")}
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
            {isEdit ? t("hospitals.editHospital", "Edit Hospital") : t("hospitals.addHospital", "Add Hospital")}
          </Typography>
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
                
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={t("hospitals.phone", "Official Phone")}
                name="officialPhone"
                value={formData.officialPhone}
                onChange={handleChange}
                
              />
            </Grid>
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
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveRounded />} 
                  sx={{ 
                    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                    boxShadow: "0 4px 14px 0 rgba(59, 130, 246, 0.39)",
                  }}
                >
                  {loading ? t("common.saving", "Saving...") : t("common.save", "Save Hospital")}
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
              onClick={handleAddBranch}
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
                          fontSize: "0.7rem",
                          bgcolor: "rgba(99, 102, 241, 0.15)",
                          color: "#a5b4fc"
                        }}
                      />
                    </Box>
                    <Box sx={{ display: "flex", gap: 2 }}>
                      <Button size="small" sx={{ minWidth: 0, p: 0, color: "#a5b4fc" }} onClick={() => handleEditBranch(branch)}>
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

      <Dialog 
        open={branchDialogOpen} 
        onClose={() => setBranchDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: "background.paper", color: "text.primary", borderRadius: 3, minWidth: 400 } }}
      >
        <DialogTitle sx={{ borderBottom: "1px solid", borderColor: "divider", mb: 2 }}>
          {editingBranchId ? "Edit Branch" : "Add New Branch"}
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          <TextField
            fullWidth
            label="Branch Code"
            value={newBranch.code}
            onChange={(e) => setNewBranch({ ...newBranch, code: e.target.value })}
            sx={{ mt: 1 }}
            placeholder="e.g. CITY01"
          />
          <TextField
            fullWidth
            label="Branch Name"
            value={newBranch.name}
            onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
            
            placeholder="e.g. Main Hospital"
          />
          <TextField
            select
            fullWidth
            label="Subscription Plan"
            value={newBranch.subscriptionPlanId}
            onChange={(e) => setNewBranch({ ...newBranch, subscriptionPlanId: e.target.value })}
            
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
            <MenuItem value="">No Subscription Plan</MenuItem>
            {plans.map((plan: any) => (
              <MenuItem key={plan.planId} value={plan.planId}>
                {plan.planName}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            fullWidth
            label="Status"
            value={newBranch.status}
            onChange={(e) => setNewBranch({ ...newBranch, status: e.target.value })}
            
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
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="suspended">Suspended</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: "1px solid", borderColor: "divider" }}>
          <Button onClick={() => setBranchDialogOpen(false)} sx={{ color: "text.secondary" }}>Cancel</Button>
          <Button 
            onClick={handleAddBranchSubmit} 
            variant="contained" 
            disabled={!newBranch.code || !newBranch.name || branchLoading}
            sx={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" }}
          >
            {branchLoading ? "Adding..." : "Add Branch"}
          </Button>
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
