import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Chip,
  Divider,
} from "@mui/material";
import { CheckCircleRounded, CancelRounded, UpgradeRounded } from "@mui/icons-material";
import { axiosInstance } from "../../../api/axios";

interface ModuleAccessData {
  enabledModules: string[];
  disabledModules: string[];
  planId: string;
}

export default function ModuleAccess() {
  const [data, setData] = useState<ModuleAccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axiosInstance.get("/hospital/module-access");
        setData(response.data.data);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load module access data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress sx={{ color: "#6366f1" }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 700, mb: 1 }}>
          Module Access Management
        </Typography>
        <Typography variant="body1" sx={{ color: "#94a3b8" }}>
          View which SaaS modules are available to your hospital.
        </Typography>
      </Box>

      {/* Access Source Info Box */}
      <Paper sx={{ p: 3, mb: 4, bgcolor: "rgba(99, 102, 241, 0.1)", borderRadius: 2, border: "1px solid rgba(99, 102, 241, 0.2)" }}>
        <Typography variant="subtitle1" sx={{ color: "#818cf8", fontWeight: 600, mb: 1 }}>
          Access Source Logic
        </Typography>
        <Typography variant="body2" sx={{ color: "#cbd5e1", mb: 2 }}>
          Your hospital's access to modules is dynamically determined by a combination of factors:
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <Chip label="Subscription Plan" sx={{ bgcolor: "#6366f1", color: "#fff", fontWeight: 600 }} />
          <Typography sx={{ color: "#94a3b8", fontWeight: 700 }}>+</Typography>
          <Chip label="Feature Flags" sx={{ bgcolor: "#3b82f6", color: "#fff", fontWeight: 600 }} />
          <Typography sx={{ color: "#94a3b8", fontWeight: 700 }}>+</Typography>
          <Chip label="RBAC (Roles)" sx={{ bgcolor: "#10b981", color: "#fff", fontWeight: 600 }} />
        </Box>
        <Typography variant="caption" display="block" sx={{ mt: 2, color: "#64748b" }}>
          * Even if a module is enabled here, individual staff members can only access it if they have the correct Role permissions.
        </Typography>
      </Paper>

      <Grid container spacing={4}>
        {/* Enabled Modules */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ bgcolor: "#1e293b", backgroundImage: "none", borderRadius: 2, overflow: "hidden", height: "100%" }}>
            <Box sx={{ bgcolor: "rgba(16, 185, 129, 0.1)", p: 2, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <Typography variant="h6" sx={{ color: "#34d399", fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
                <CheckCircleRounded /> Enabled Modules
              </Typography>
            </Box>
            <List sx={{ p: 0 }}>
              {data?.enabledModules.length === 0 ? (
                <ListItem sx={{ py: 3 }}>
                  <ListItemText primary={<Typography sx={{ color: "#94a3b8", textAlign: "center" }}>No modules enabled.</Typography>} />
                </ListItem>
              ) : (
                data?.enabledModules.map((module, idx) => (
                  <Box key={module}>
                    <ListItem sx={{ py: 2, px: 3 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <CheckCircleRounded sx={{ color: "#34d399" }} />
                      </ListItemIcon>
                      <ListItemText 
                        primary={<Typography sx={{ color: "#f8fafc", fontWeight: 500 }}>{module}</Typography>} 
                      />
                    </ListItem>
                    {idx < data.enabledModules.length - 1 && <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />}
                  </Box>
                ))
              )}
            </List>
          </Paper>
        </Grid>

        {/* Disabled Modules */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ bgcolor: "#1e293b", backgroundImage: "none", borderRadius: 2, overflow: "hidden", height: "100%" }}>
            <Box sx={{ bgcolor: "rgba(239, 68, 68, 0.1)", p: 2, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <Typography variant="h6" sx={{ color: "#f87171", fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
                <CancelRounded /> Disabled Modules
              </Typography>
            </Box>
            <List sx={{ p: 0 }}>
              {data?.disabledModules.length === 0 ? (
                <ListItem sx={{ py: 3 }}>
                  <ListItemText primary={<Typography sx={{ color: "#94a3b8", textAlign: "center" }}>No disabled modules.</Typography>} />
                </ListItem>
              ) : (
                data?.disabledModules.map((module, idx) => (
                  <Box key={module}>
                    <ListItem sx={{ py: 2, px: 3, display: "flex", justifyContent: "space-between" }}>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <CancelRounded sx={{ color: "#f87171" }} />
                        </ListItemIcon>
                        <ListItemText 
                          primary={<Typography sx={{ color: "#94a3b8" }}>{module}</Typography>} 
                        />
                      </Box>
                      <Button
                        size="small"
                        startIcon={<UpgradeRounded />}
                        sx={{ 
                          color: "#818cf8", 
                          textTransform: "none", 
                          bgcolor: "rgba(99, 102, 241, 0.1)",
                          "&:hover": { bgcolor: "rgba(99, 102, 241, 0.2)" }
                        }}
                      >
                        Upgrade
                      </Button>
                    </ListItem>
                    {idx < data.disabledModules.length - 1 && <Divider sx={{ borderColor: "rgba(255,255,255,0.05)" }} />}
                  </Box>
                ))
              )}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
