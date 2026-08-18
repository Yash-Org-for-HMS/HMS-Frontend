import { useMemo, useState } from "react";
import { SEMANTIC, BRAND } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Box,
  Typography,
  Button,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  Skeleton,
  Divider,
  alpha,
} from "@mui/material";
import {
  AddRounded,
  MoreVertRounded,
  EditRounded,
  DeleteRounded,
  CheckCircleRounded,
  CancelRounded,
  MedicalServicesRounded,
  ApartmentRounded,
  CloudQueueRounded,
  BusinessRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import { useToast } from "@/providers/ToastContext";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import ActionButton from "@/components/layout/ActionButton";

type Module = { key: string; label: string };

const money = (v: unknown) => `₹${Number(v ?? 0).toLocaleString("en-IN")}`;

export default function PlansList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const qc = useQueryClient();
  const toast = useToast();

  const { data: plans = [], isLoading, isError, error, refetch } = useQuery<any[]>({
    queryKey: ["plans"],
    queryFn: async () => (await axiosInstance.get("/plans")).data.data,
  });

  // The full universe of features = the backend module registry. Each plan's
  // featuresJson is the subset of module keys it includes; a plan shows ✓ for the
  // modules it has and ✗ for the ones it doesn't.
  const { data: modules = [] } = useQuery<Module[]>({
    queryKey: ["modules-registry"],
    queryFn: async () => (await axiosInstance.get("/modules")).data.data,
  });

  // Cheapest tier first, so the progression reads left-to-right.
  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => Number(a.monthlyPrice ?? 0) - Number(b.monthlyPrice ?? 0)),
    [plans],
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axiosInstance.delete(`/plans/${id}`),
    onSuccess: () => {
      toast.success("Plan deleted");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, "Failed to delete plan")),
  });

  const openActionMenu = (e: React.MouseEvent<HTMLElement>, planId: string) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setSelectedPlanId(planId);
  };

  const gridSx = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
    gap: 2.5,
    alignItems: "stretch",
  } as const;

  return (
    <PageContainer>
      <PageHeader
        title={t("plans.title", "Subscription Plans")}
        subtitle={t("plans.subtitle", "Manage hospital subscription tiers and features")}
        actions={
          <ActionButton
            accentFrom={BRAND.action}
            accentTo={BRAND.actionDark}
            startIcon={<AddRounded />}
            onClick={() => navigate("/plans/new")}
          >
            {t("plans.addPlan", "Add Plan")}
          </ActionButton>
        }
      />

      {isLoading ? (
        <Box sx={gridSx}>
          {[0, 1, 2].map((i) => (
            <Paper key={i} variant="outlined" sx={{ borderRadius: 3, p: 3 }}>
              <Skeleton width="55%" height={30} />
              <Skeleton width="40%" height={48} sx={{ mt: 1 }} />
              <Skeleton variant="rounded" height={64} sx={{ my: 2 }} />
              {[...Array(5)].map((_, j) => <Skeleton key={j} height={26} />)}
            </Paper>
          ))}
        </Box>
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : sortedPlans.length === 0 ? (
        <Paper variant="outlined" sx={{ borderRadius: 3, py: 10, textAlign: "center", color: "text.secondary" }}>
          <BusinessRounded sx={{ fontSize: 44, color: "text.disabled", mb: 1 }} />
          <Typography variant="body1" sx={{ fontWeight: 600 }}>{t("plans.noPlans", "No subscription plans yet")}</Typography>
          <Typography variant="body2">{t("plans.noPlansHint", "Create a plan to define tiers, limits, and features.")}</Typography>
        </Paper>
      ) : (
        <Box sx={gridSx}>
          {sortedPlans.map((plan) => (
            <PlanCard
              key={plan.planId}
              plan={plan}
              modules={modules}
              onMenu={(e) => openActionMenu(e, plan.planId)}
            />
          ))}
        </Box>
      )}

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
          <DeleteRounded sx={{ mr: 1.5, fontSize: 20, color: SEMANTIC.danger }} /> {t("common.delete", "Delete")}
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
          <Button onClick={() => deleteId && deleteMutation.mutate(deleteId)} color="error" variant="contained" disabled={deleteMutation.isPending}>{t("common.delete", "Delete")}</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}

function LimitStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ flex: 1, textAlign: "center", minWidth: 0 }}>
      <Box sx={{ color: "text.secondary", display: "flex", justifyContent: "center", mb: 0.25 }}>{icon}</Box>
      <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", lineHeight: 1.1 }}>{value}</Typography>
      <Typography sx={{ color: "text.secondary", fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</Typography>
    </Box>
  );
}

function PlanCard({ plan, modules, onMenu }: { plan: any; modules: Module[]; onMenu: (e: React.MouseEvent<HTMLElement>) => void }) {
  const featureSet = new Set<string>(Array.isArray(plan.featuresJson) ? plan.featuresJson : []);
  // Rank the module registry: included features first, then the missing ones.
  const rows = useMemo(() => {
    const list = modules.map((m) => ({ ...m, on: featureSet.has(m.key) }));
    return list.sort((a, b) => Number(b.on) - Number(a.on) || a.label.localeCompare(b.label));
  }, [modules, plan.featuresJson]);
  const includedCount = rows.filter((r) => r.on).length;

  const monthly = Number(plan.monthlyPrice ?? 0);
  const annual = Number(plan.annualPrice ?? 0);
  const savingsPct = monthly > 0 && annual > 0 ? Math.round((1 - annual / (monthly * 12)) * 100) : 0;
  const activeHospitals = plan._count?.branches ?? 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 3, p: 0, display: "flex", flexDirection: "column", overflow: "hidden",
        transition: "border-color .15s, box-shadow .15s, transform .15s",
        "&:hover": { borderColor: alpha(BRAND.action, 0.5), boxShadow: 3, transform: "translateY(-2px)" },
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2.5, pb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 800, fontSize: "1.15rem" }}>{plan.planName}</Typography>
            <Chip
              size="small"
              icon={<ApartmentRounded sx={{ fontSize: "0.9rem !important" }} />}
              label={`${activeHospitals} hospital${activeHospitals === 1 ? "" : "s"}`}
              sx={{ mt: 0.5, height: 22, fontSize: "0.68rem", fontWeight: 600, bgcolor: "action.hover", color: "text.secondary", "& .MuiChip-icon": { color: "inherit" } }}
            />
          </Box>
          <IconButton size="small" onClick={onMenu} sx={{ color: "text.secondary", flex: "none", mt: -0.5, mr: -0.5 }}>
            <MoreVertRounded fontSize="small" />
          </IconButton>
        </Box>

        {/* Price */}
        <Box sx={{ mt: 1.5, display: "flex", alignItems: "baseline", gap: 0.5 }}>
          <Typography sx={{ fontWeight: 800, fontSize: "1.9rem", lineHeight: 1, color: BRAND.action }}>{money(monthly)}</Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.85rem" }}>/ month</Typography>
        </Box>
        <Box sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>{money(annual)} billed yearly</Typography>
          {savingsPct > 0 && (
            <Chip size="small" label={`Save ${savingsPct}%`} sx={{ height: 18, fontSize: "0.62rem", fontWeight: 700, bgcolor: alpha(SEMANTIC.success, 0.14), color: SEMANTIC.success }} />
          )}
        </Box>
      </Box>

      {/* Limits */}
      <Box sx={{ display: "flex", gap: 1, px: 2, py: 1.5, mx: 2.5, mb: 0.5, borderRadius: 2, bgcolor: "action.hover" }}>
        <LimitStat icon={<MedicalServicesRounded sx={{ fontSize: 18 }} />} label="Doctors" value={plan.maxDoctors ?? "—"} />
        <Divider orientation="vertical" flexItem />
        <LimitStat icon={<BusinessRounded sx={{ fontSize: 18 }} />} label="Branches" value={plan.maxBranches ?? "—"} />
        <Divider orientation="vertical" flexItem />
        <LimitStat icon={<CloudQueueRounded sx={{ fontSize: 18 }} />} label="Storage" value={`${plan.maxStorageGb ?? 0}GB`} />
      </Box>

      {/* Feature checklist */}
      <Box sx={{ px: 2.5, pt: 1.5, pb: 1, flex: 1 }}>
        <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "text.secondary", mb: 0.75 }}>
          Modules
          {modules.length > 0 && (
            <Box component="span" sx={{ ml: 0.75, color: "text.disabled", fontWeight: 600 }}>{includedCount}/{modules.length}</Box>
          )}
        </Typography>
        {rows.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.disabled" }}>No modules configured.</Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            {rows.map((m) => (
              <Box key={m.key} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.4 }}>
                {m.on
                  ? <CheckCircleRounded sx={{ fontSize: 18, color: SEMANTIC.success, flex: "none" }} />
                  : <CancelRounded sx={{ fontSize: 18, color: "text.disabled", flex: "none" }} />}
                <Typography variant="body2" sx={{ color: m.on ? "text.primary" : "text.disabled", textDecoration: m.on ? "none" : "line-through" }}>
                  {m.label}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ px: 2.5, py: 1.5, borderTop: 1, borderColor: "divider" }}>
        <Button fullWidth size="small" variant="outlined" startIcon={<EditRounded />} onClick={onMenu}
          sx={{ textTransform: "none", borderColor: "divider", color: "text.primary", "&:hover": { borderColor: BRAND.action, bgcolor: alpha(BRAND.action, 0.06) } }}>
          Manage plan
        </Button>
      </Box>
    </Paper>
  );
}
