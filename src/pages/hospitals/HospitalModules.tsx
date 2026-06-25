import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Switch, Chip, Button, CircularProgress, Grid, Tooltip,
} from "@mui/material";
import { ArrowBackRounded, SaveRounded, WidgetsRounded, LockOpenRounded } from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import { useToast } from "../../contexts/ToastContext";

interface ModuleRow {
  key: string;
  label: string;
  inPlan: boolean;
  overridden: boolean;
  enabled: boolean;
}

export default function HospitalModules() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [draft, setDraft] = useState<Record<string, boolean>>({});

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["hospital-modules", id],
    queryFn: async () => (await axiosInstance.get(`/hospitals/${id}/modules`)).data.data as { hospitalName: string; modules: ModuleRow[] },
    enabled: !!id,
  });

  // Seed the local toggle state from the fetched effective state.
  useEffect(() => {
    if (data?.modules) {
      const seed: Record<string, boolean> = {};
      data.modules.forEach((m) => (seed[m.key] = m.enabled));
      setDraft(seed);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => (await axiosInstance.put(`/hospitals/${id}/modules`, { modules: draft })).data,
    onSuccess: () => { toast.success("Modules updated"); refetch(); },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to update modules"),
  });

  const modules = data?.modules || [];
  const dirty = modules.some((m) => draft[m.key] !== m.enabled);

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Button startIcon={<ArrowBackRounded />} onClick={() => navigate("/hospitals")} sx={{ color: "text.secondary", textTransform: "none" }}>
          Hospitals
        </Button>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, display: "flex", alignItems: "center", gap: 1.5 }}>
            <WidgetsRounded sx={{ color: "#3b82f6", fontSize: 32 }} /> Module Access
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {data?.hospitalName ? `${data.hospitalName} — ` : ""}enable or disable modules for this hospital. Overrides take precedence over the plan.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={save.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveRounded />}
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate()}
          sx={{ bgcolor: "#3b82f6", "&:hover": { bgcolor: "#2563eb" }, textTransform: "none", fontWeight: 600 }}
        >
          Save changes
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress sx={{ color: "#3b82f6" }} /></Box>
      ) : isError ? (
        <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
      ) : (
        <Grid container spacing={2}>
          {modules.map((m) => {
            const on = draft[m.key] ?? m.enabled;
            const beyondPlan = on && !m.inPlan;
            return (
              <Grid key={m.key} size={{ xs: 12, sm: 6 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5, borderRadius: 3, border: "1px solid",
                    borderColor: on ? "rgba(59,130,246,0.4)" : "divider",
                    bgcolor: on ? "rgba(59,130,246,0.04)" : "background.paper",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>{m.label}</Typography>
                    <Box sx={{ display: "flex", gap: 0.75, mt: 0.75, flexWrap: "wrap" }}>
                      <Chip
                        size="small"
                        label={m.inPlan ? "In plan" : "Not in plan"}
                        sx={{
                          height: 20, fontSize: "0.68rem", fontWeight: 600,
                          bgcolor: m.inPlan ? "rgba(16,185,129,0.12)" : "rgba(148,163,184,0.15)",
                          color: m.inPlan ? "#16a34a" : "text.secondary",
                        }}
                      />
                      {beyondPlan && (
                        <Tooltip title="Granted to this hospital beyond its subscription plan">
                          <Chip
                            size="small" icon={<LockOpenRounded sx={{ fontSize: "14px !important" }} />} label="Beyond plan"
                            sx={{ height: 20, fontSize: "0.68rem", fontWeight: 600, bgcolor: "rgba(245,158,11,0.15)", color: "#d97706" }}
                          />
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                  <Switch
                    checked={on}
                    onChange={(e) => setDraft((d) => ({ ...d, [m.key]: e.target.checked }))}
                    color="primary"
                  />
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
