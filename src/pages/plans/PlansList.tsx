import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  AddRounded,
  MoreVertRounded,
  EditRounded,
  DeleteRounded,
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function PlansList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs & Menus
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get("/plans");
      setPlans(response.data.data);
    } catch (error) {
      console.error("Failed to fetch plans", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await axiosInstance.delete(`/plans/${deleteId}`);
      setDeleteId(null);
      fetchPlans();
    } catch (error) {
      console.error("Failed to delete plan", error);
    }
  };

  const openActionMenu = (e: React.MouseEvent<HTMLElement>, planId: string) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setSelectedPlanId(planId);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight="800" sx={{ color: "#f8fafc", mb: 1 }}>
            {t("plans.title", "Subscription Plans")}
          </Typography>
          <Typography variant="body1" sx={{ color: "#94a3b8" }}>
            {t("plans.subtitle", "Manage hospital subscription tiers and features")}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => navigate("/plans/new")}
          sx={{
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            boxShadow: "0 4px 14px 0 rgba(16, 185, 129, 0.39)",
            borderRadius: 2,
          }}
        >
          {t("plans.addPlan", "Add Plan")}
        </Button>
      </Box>

      <Paper
        elevation={0}
        sx={{
          bgcolor: "rgba(30, 41, 59, 0.7)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "rgba(15, 23, 42, 0.6)" }}>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("plans.planName", "Plan Name")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("plans.price", "Price (Mo/Yr)")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("plans.limits", "Limits (Doc/Br/GB)")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("plans.features", "Features")}</TableCell>
                <TableCell sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("plans.activeHospitals", "Active Hospitals")}</TableCell>
                <TableCell align="right" sx={{ color: "#94a3b8", fontWeight: 600 }}>{t("common.actions", "Actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <CircularProgress sx={{ color: "#10b981" }} />
                  </TableCell>
                </TableRow>
              ) : plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8, color: "#94a3b8" }}>
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((plan) => (
                  <TableRow key={plan.planId} hover sx={{ "&:hover": { bgcolor: "rgba(255, 255, 255, 0.02)" } }}>
                    <TableCell sx={{ color: "#f8fafc", fontWeight: 600 }}>
                      {plan.planName}
                    </TableCell>
                    <TableCell sx={{ color: "#cbd5e1" }}>
                      <Typography variant="body2">₹{plan.monthlyPrice} / mo</Typography>
                      <Typography variant="caption" sx={{ color: "#94a3b8" }}>₹{plan.annualPrice} / yr</Typography>
                    </TableCell>
                    <TableCell sx={{ color: "#cbd5e1" }}>
                      <Typography variant="body2">Docs: {plan.maxDoctors}</Typography>
                      <Typography variant="caption" sx={{ color: "#94a3b8", display: "block" }}>Branches: {plan.maxBranches}</Typography>
                      <Typography variant="caption" sx={{ color: "#94a3b8" }}>Storage: {plan.maxStorageGb}GB</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", maxWidth: 200 }}>
                        {Array.isArray(plan.featuresJson) ? (
                          plan.featuresJson.slice(0, 3).map((f: string) => (
                            <Chip key={f} label={f} size="small" sx={{ bgcolor: "rgba(16, 185, 129, 0.1)", color: "#34d399", height: 20, fontSize: "0.7rem" }} />
                          ))
                        ) : null}
                        {Array.isArray(plan.featuresJson) && plan.featuresJson.length > 3 && (
                          <Chip label={`+${plan.featuresJson.length - 3}`} size="small" sx={{ bgcolor: "rgba(255, 255, 255, 0.1)", color: "#cbd5e1", height: 20, fontSize: "0.7rem" }} />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={plan._count?.hospitals || 0} size="small" color="primary" />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton onClick={(e) => openActionMenu(e, plan.planId)} sx={{ color: "#94a3b8" }}>
                        <MoreVertRounded />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{ sx: { bgcolor: "#1e293b", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#f8fafc" } }}
      >
        <MenuItem onClick={() => { navigate(`/plans/${selectedPlanId}/edit`); setAnchorEl(null); }}>
          <EditRounded sx={{ mr: 1.5, fontSize: 20, color: "#94a3b8" }} /> {t("common.edit", "Edit")}
        </MenuItem>
        <MenuItem onClick={() => { setDeleteId(selectedPlanId); setAnchorEl(null); }}>
          <DeleteRounded sx={{ mr: 1.5, fontSize: 20, color: "#ef4444" }} /> {t("common.delete", "Delete")}
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)} PaperProps={{ sx: { bgcolor: "#1e293b", color: "#f8fafc", borderRadius: 3 } }}>
        <DialogTitle>{t("plans.deletePlan", "Delete Plan")}</DialogTitle>
        <DialogContent sx={{ color: "#cbd5e1" }}>
          {t("plans.deleteConfirm", "Are you sure you want to delete this subscription plan? You cannot delete a plan that is in use by active hospitals.")}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteId(null)} sx={{ color: "#94a3b8" }}>{t("common.cancel", "Cancel")}</Button>
          <Button onClick={handleDelete} color="error" variant="contained">{t("common.delete", "Delete")}</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
