import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ErrorState from "../../../components/ErrorState";
import {
  Box, Typography, Paper, CircularProgress, List, ListItem, ListItemText,
  Chip, Switch, Divider, Tooltip,
} from "@mui/material";
import { LockRounded } from "@mui/icons-material";
import { axiosInstance } from "../../../api/axios";
import { useToast } from "../../../contexts/ToastContext";
import PageHeader from "../../../components/layout/PageHeader";

interface ModuleAccessData {
  enabledModules: string[];
  disabledModules: string[];
  planModules: string[];
  planId: string;
  planName?: string;
}

export default function ModuleAccess() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading: loading, isError, error, refetch } = useQuery<ModuleAccessData>({
    queryKey: ["module-access"],
    queryFn: async () => (await axiosInstance.get("/hospital/module-access")).data.data,
  });

  const toggle = useMutation({
    mutationFn: async ({ module, enabled }: { module: string; enabled: boolean }) =>
      (await axiosInstance.put("/hospital/module-access", { module, enabled })).data,
    onSuccess: (res) => {
      toast.success(res?.message || "Updated");
      queryClient.invalidateQueries({ queryKey: ["module-access"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to update module"),
  });

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress sx={{ color: "primary.main" }} /></Box>;
  }
  if (isError) {
    return <ErrorState title="Couldn't load module access" message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />;
  }

  const allModules = [...(data?.enabledModules || []), ...(data?.disabledModules || [])];
  const isEnabled = (m: string) => data?.enabledModules.includes(m) ?? false;
  const inPlan = (m: string) => data?.planModules.includes(m) ?? false;

  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
      <PageHeader
        title="Module Access"
        subtitle="Turn modules your plan includes on or off. Modules outside your plan are locked — contact your provider to upgrade."
      />

      <Paper sx={{ p: 3, mb: 3, bgcolor: "rgba(99, 102, 241, 0.08)", borderRadius: 2, border: "1px solid rgba(99, 102, 241, 0.2)" }}>
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <Chip label={`Plan: ${data?.planName || "Basic"}`} sx={{ bgcolor: "#6366f1", color: "#fff", fontWeight: 600 }} />
          <Typography sx={{ color: "text.secondary", fontWeight: 700 }}>+</Typography>
          <Chip label="Your toggles" sx={{ bgcolor: "#3b82f6", color: "#fff", fontWeight: 600 }} />
          <Typography sx={{ color: "text.secondary", fontWeight: 700 }}>+</Typography>
          <Chip label="RBAC (Roles)" sx={{ bgcolor: "#10b981", color: "#fff", fontWeight: 600 }} />
        </Box>
        <Typography variant="caption" display="block" sx={{ mt: 1.5, color: "text.secondary" }}>
          * Turning a module on here still requires staff to hold the matching Role permission to use it.
        </Typography>
      </Paper>

      <Paper sx={{ bgcolor: "background.paper", backgroundImage: "none", borderRadius: 2, overflow: "hidden", border: "1px solid", borderColor: "divider" }}>
        <List sx={{ p: 0 }}>
          {allModules.map((module, idx) => {
            const enabled = isEnabled(module);
            const toggleable = inPlan(module);
            return (
              <Box key={module}>
                {idx > 0 && <Divider sx={{ borderColor: "divider" }} />}
                <ListItem sx={{ py: 2, px: 3, display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <ListItemText
                    primary={<Typography sx={{ color: "text.primary", fontWeight: 600 }}>{module}</Typography>}
                    secondary={
                      <Typography variant="caption" sx={{ color: enabled ? "#16a34a" : "text.secondary" }}>
                        {toggleable ? (enabled ? "Enabled" : "Disabled") : "Not in your plan"}
                      </Typography>
                    }
                  />
                  {toggleable ? (
                    <Switch
                      checked={enabled}
                      onChange={(e) => toggle.mutate({ module, enabled: e.target.checked })}
                      disabled={toggle.isPending}
                      color="primary"
                    />
                  ) : (
                    <Tooltip title="Upgrade your plan to unlock this module">
                      <Chip icon={<LockRounded sx={{ fontSize: "16px !important" }} />} label="Upgrade" size="small"
                        sx={{ bgcolor: "rgba(148,163,184,0.15)", color: "text.secondary", fontWeight: 600 }} />
                    </Tooltip>
                  )}
                </ListItem>
              </Box>
            );
          })}
        </List>
      </Paper>
    </Box>
  );
}
