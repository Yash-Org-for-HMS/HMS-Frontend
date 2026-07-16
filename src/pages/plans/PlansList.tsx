import { useState } from "react";
import { getApiErrorMessage } from "../../utils/apiError";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import ErrorState from "../../components/ErrorState";
import { useToast } from "../../contexts/ToastContext";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/layout/PageHeader";
import ActionButton from "../../components/layout/ActionButton";
import FilterBar from "../../components/layout/FilterBar";
import { TableRowsSkeleton } from "../../components/TableRowsSkeleton";
import { useTableSort } from "../../components/table/useTableSort";
import SortableHeadCell from "../../components/table/SortableHeadCell";

const headSx = { color: "text.secondary", fontWeight: 600, textTransform: "none", letterSpacing: "normal", fontSize: "0.875rem", bgcolor: "background.paper" } as const;

export default function PlansList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Dialogs & Menus
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const qc = useQueryClient();
  const toast = useToast();

  const { data: plans = [], isLoading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["plans"],
    queryFn: async () => (await axiosInstance.get("/plans")).data.data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axiosInstance.delete(`/plans/${id}`),
    onSuccess: () => {
      toast.success("Plan deleted");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (err: any) => toast.error(getApiErrorMessage(err, "Failed to delete plan")),
  });

  const { sorted, orderBy, order, onSort } = useTableSort(plans, {
    planName: (p) => p.planName,
    monthlyPrice: (p) => p.monthlyPrice,
    maxDoctors: (p) => p.maxDoctors,
    activeHospitals: (p) => p._count?.branches ?? 0,
  });

  const handleDelete = () => {
    if (deleteId) deleteMutation.mutate(deleteId);
  };

  const openActionMenu = (e: React.MouseEvent<HTMLElement>, planId: string) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setSelectedPlanId(planId);
  };

  return (
    <PageContainer>
      <PageHeader
        title={t("plans.title", "Subscription Plans")}
        subtitle={t("plans.subtitle", "Manage hospital subscription tiers and features")}
        actions={
          <ActionButton
            accentFrom="#10b981"
            accentTo="#059669"
            startIcon={<AddRounded />}
            onClick={() => navigate("/plans/new")}
          >
            {t("plans.addPlan", "Add Plan")}
          </ActionButton>
        }
      />

      <Paper
        elevation={2}
        sx={{
          bgcolor: "background.paper",
          backdropFilter: "blur(10px)",
          border: "1px solid", borderColor: "divider",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <TableContainer sx={{ maxHeight: "calc(100vh - 300px)" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow sx={{ bgcolor: "background.paper" }}>
                <SortableHeadCell label={t("plans.planName", "Plan Name")} sortKey="planName" orderBy={orderBy} order={order} onSort={onSort} sx={headSx} />
                <SortableHeadCell label={t("plans.price", "Price (Mo/Yr)")} sortKey="monthlyPrice" orderBy={orderBy} order={order} onSort={onSort} sx={headSx} />
                <SortableHeadCell label={t("plans.limits", "Limits (Doc/Br/GB)")} sortKey="maxDoctors" orderBy={orderBy} order={order} onSort={onSort} sx={headSx} />
                <TableCell sx={{ color: "text.secondary", fontWeight: 600, bgcolor: "background.paper" }}>{t("plans.features", "Features")}</TableCell>
                <SortableHeadCell label={t("plans.activeHospitals", "Active Hospitals")} sortKey="activeHospitals" orderBy={orderBy} order={order} onSort={onSort} sx={headSx} />
                <TableCell align="right" sx={{ color: "text.secondary", fontWeight: 600, bgcolor: "background.paper" }}>{t("common.actions", "Actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={6} columns={6} />
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 4, border: 0 }}>
                    <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
                  </TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8, color: "text.secondary" }}>
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((plan) => (
                  <TableRow key={plan.planId} hover sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                    <TableCell sx={{ color: "text.primary", fontWeight: 600 }}>
                      {plan.planName}
                    </TableCell>
                    <TableCell sx={{ color: "text.primary" }}>
                      <Typography variant="body2">₹{plan.monthlyPrice} / mo</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>₹{plan.annualPrice} / yr</Typography>
                    </TableCell>
                    <TableCell sx={{ color: "text.primary" }}>
                      <Typography variant="body2">Docs: {plan.maxDoctors}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>Branches: {plan.maxBranches}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>Storage: {plan.maxStorageGb}GB</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", maxWidth: 200 }}>
                        {Array.isArray(plan.featuresJson) ? (
                          plan.featuresJson.slice(0, 3).map((f: string) => (
                            <Chip key={f} label={f} size="small" sx={{ bgcolor: "rgba(16, 185, 129, 0.1)", color: "#34d399", height: 20, fontSize: "0.75rem" }} />
                          ))
                        ) : null}
                        {Array.isArray(plan.featuresJson) && plan.featuresJson.length > 3 && (
                          <Chip label={`+${plan.featuresJson.length - 3}`} size="small" sx={{ bgcolor: "rgba(255, 255, 255, 0.1)", color: "text.primary", height: 20, fontSize: "0.75rem" }} />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={plan._count?.branches || 0} size="small" color="primary" />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton onClick={(e) => openActionMenu(e, plan.planId)} sx={{ color: "text.secondary" }}>
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
        PaperProps={{ sx: { bgcolor: "background.paper", border: "1px solid", borderColor: "divider", color: "text.primary" } }}
      >
        <MenuItem onClick={() => { navigate(`/plans/${selectedPlanId}/edit`); setAnchorEl(null); }}>
          <EditRounded sx={{ mr: 1.5, fontSize: 20, color: "text.secondary" }} /> {t("common.edit", "Edit")}
        </MenuItem>
        <MenuItem onClick={() => { setDeleteId(selectedPlanId); setAnchorEl(null); }}>
          <DeleteRounded sx={{ mr: 1.5, fontSize: 20, color: "#ef4444" }} /> {t("common.delete", "Delete")}
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)} PaperProps={{ sx: { bgcolor: "background.paper", color: "text.primary", borderRadius: 3 } }}>
        <DialogTitle>{t("plans.deletePlan", "Delete Plan")}</DialogTitle>
        <DialogContent sx={{ color: "text.primary" }}>
          {t("plans.deleteConfirm", "Are you sure you want to delete this subscription plan? You cannot delete a plan that is in use by active hospitals.")}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteId(null)} sx={{ color: "text.secondary" }}>{t("common.cancel", "Cancel")}</Button>
          <Button onClick={handleDelete} color="error" variant="contained">{t("common.delete", "Delete")}</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
