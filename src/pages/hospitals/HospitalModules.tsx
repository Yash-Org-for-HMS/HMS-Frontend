import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Button, Grid, Chip, MenuItem, TextField, Tooltip,
} from "@mui/material";
import { ArrowBackRounded, SaveRounded, WidgetsRounded, CheckCircleRounded, AddCircleOutlineRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import HeartbeatLoader from "../../components/HeartbeatLoader";
import PageLoader from "../../components/PageLoader";
import { useToast } from "../../contexts/ToastContext";
import PageHeader from "../../components/layout/PageHeader";

interface ModuleRow { key: string; label: string; entitled: boolean }
interface ModulesResp {
  hospitalName: string;
  planId: string | null;
  planName: string;
  entitlementSource: "hospital" | "plan" | "default";
  modules: ModuleRow[];
}

// A distinct accent per module so the grid reads as colourful cards.
const ACCENTS: Record<string, string> = {
  OPD: "#3b82f6",
  Doctor: "#8b5cf6",
  IPD: "#ec4899",
  Laboratory: "#f59e0b",
  Pharmacy: "#10b981",
  Billing: "#06b6d4",
};

export default function HospitalModules() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [planId, setPlanId] = useState<string>("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["hospital-modules", id],
    queryFn: async () => (await axiosInstance.get(`/hospitals/${id}/modules`)).data.data as ModulesResp,
    enabled: !!id,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["plans-options"],
    queryFn: async () => (await axiosInstance.get(`/plans?limit=100`)).data.data as { planId: string; planName: string }[],
  });

  useEffect(() => {
    if (data) {
      setSelected(new Set(data.modules.filter((m) => m.entitled).map((m) => m.key)));
      setPlanId(data.planId || "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () =>
      (await axiosInstance.put(`/hospitals/${id}/modules`, {
        entitledModules: [...selected],
        planId: planId || null,
      })).data,
    onSuccess: () => { toast.success("Module access updated"); refetch(); },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to save"),
  });

  const modules = data?.modules || [];
  const baselineSel = new Set(modules.filter((m) => m.entitled).map((m) => m.key));
  const dirty =
    selected.size !== baselineSel.size ||
    [...selected].some((k) => !baselineSel.has(k)) ||
    planId !== (data?.planId || "");

  const toggle = (key: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  return (
    <Box sx={{ maxWidth: 1040, mx: "auto", p: { xs: 2, md: 3 } }}>
      <Button startIcon={<ArrowBackRounded />} onClick={() => navigate("/hospitals")} sx={{ color: "text.secondary", textTransform: "none", mb: 1 }}>
        Hospitals
      </Button>
      <PageHeader
        title="Module Access"
        subtitle={`${data?.hospitalName ? `${data.hospitalName} — ` : ""}assign the modules this hospital may use. Its admin can enable/disable within this set; anything else they must request from you.`}
        actions={
          <Button
            variant="contained"
            startIcon={save.isPending ? <HeartbeatLoader size={22} /> : <SaveRounded />}
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
            sx={{ bgcolor: "#3b82f6", "&:hover": { bgcolor: "#2563eb" }, textTransform: "none", fontWeight: 600 }}
          >
            Save changes
          </Button>
        }
      />

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
      ) : (
        <>
          {/* Plan picker */}
          <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <TextField
              select size="small" label="Subscription plan" value={planId}
              onChange={(e) => setPlanId(e.target.value)} sx={{ minWidth: 260 }}
            >
              <MenuItem value="">— No plan —</MenuItem>
              {plans.map((p) => <MenuItem key={p.planId} value={p.planId}>{p.planName}</MenuItem>)}
            </TextField>
            <Chip
              size="small"
              label={data?.entitlementSource === "hospital" ? "Custom module set" : `Following plan (${data?.planName || "—"})`}
              sx={{ fontWeight: 600, bgcolor: data?.entitlementSource === "hospital" ? "rgba(139,92,246,0.12)" : "rgba(148,163,184,0.15)", color: data?.entitlementSource === "hospital" ? "#8b5cf6" : "text.secondary" }}
            />
          </Paper>

          {/* Colourful module cards */}
          <Grid container spacing={2}>
            {modules.map((m) => {
              const on = selected.has(m.key);
              const accent = ACCENTS[m.key] || "#3b82f6";
              return (
                <Grid key={m.key} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Paper
                    onClick={() => toggle(m.key)}
                    elevation={0}
                    sx={{
                      p: 2.5, borderRadius: 4, cursor: "pointer", userSelect: "none",
                      border: "2px solid", borderColor: on ? accent : "divider",
                      background: on ? `linear-gradient(135deg, ${accent}1f, ${accent}0a)` : "background.paper",
                      transition: "all .15s ease", minHeight: 104,
                      display: "flex", flexDirection: "column", justifyContent: "space-between",
                      "&:hover": { borderColor: accent, boxShadow: `0 6px 20px ${accent}22` },
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Box sx={{ width: 40, height: 40, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: on ? accent : `${accent}22`, color: on ? "#fff" : accent }}>
                        <WidgetsRounded />
                      </Box>
                      {on
                        ? <CheckCircleRounded sx={{ color: accent }} />
                        : <AddCircleOutlineRounded sx={{ color: "text.disabled" }} />}
                    </Box>
                    <Box sx={{ mt: 1.5 }}>
                      <Typography sx={{ fontWeight: 700, color: on ? "text.primary" : "text.secondary" }}>{m.label}</Typography>
                      <Typography variant="caption" sx={{ color: on ? accent : "text.disabled", fontWeight: 600 }}>
                        {on ? "Assigned" : "Not assigned"}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>

          <Typography variant="caption" sx={{ display: "block", mt: 3, color: "text.secondary" }}>
            Tip: assigned modules become the hospital's ceiling. To remove access entirely, unassign here; to let the hospital self-manage which of these are active, leave them assigned.
          </Typography>
        </>
      )}
    </Box>
  );
}
