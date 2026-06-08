import { Box, Typography, Grid, Paper } from "@mui/material";
import { ScienceRounded, CheckCircleRounded, PendingActionsRounded } from "@mui/icons-material";
import { useState, useEffect } from "react";
import { axiosInstance } from "../../api/axios";

export default function LabDashboard() {
  const [labStats, setLabStats] = useState({ total: 0, pending: 0, completed: 0 });
  const [radStats, setRadStats] = useState({ total: 0, pending: 0, completed: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [labRes, radRes] = await Promise.all([
          axiosInstance.get("/lab/orders"),
          axiosInstance.get("/lab/radiology-orders")
        ]);

        const labOrders = labRes.data.data || [];
        setLabStats({
          total: labOrders.length,
          pending: labOrders.filter((o: any) => o.status !== "COMPLETED").length,
          completed: labOrders.filter((o: any) => o.status === "COMPLETED").length,
        });

        const radOrders = radRes.data.data || [];
        setRadStats({
          total: radOrders.length,
          pending: radOrders.filter((o: any) => o.status !== "COMPLETED").length,
          completed: radOrders.filter((o: any) => o.status === "COMPLETED").length,
        });
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
      }
    };
    fetchStats();
  }, []);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Lab Dashboard</Typography>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, mt: 4 }}>Lab Test Orders</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, borderRadius: 3, display: "flex", alignItems: "center", gap: 2 }}>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "primary.light", color: "primary.main" }}>
              <ScienceRounded fontSize="large" />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{labStats.total}</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>Total Orders</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, borderRadius: 3, display: "flex", alignItems: "center", gap: 2 }}>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "warning.light", color: "warning.main" }}>
              <PendingActionsRounded fontSize="large" />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{labStats.pending}</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>Pending Orders</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, borderRadius: 3, display: "flex", alignItems: "center", gap: 2 }}>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "success.light", color: "success.main" }}>
              <CheckCircleRounded fontSize="large" />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{labStats.completed}</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>Completed Orders</Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, mt: 4 }}>Radiology Orders</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, borderRadius: 3, display: "flex", alignItems: "center", gap: 2 }}>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "primary.light", color: "primary.main" }}>
              <ScienceRounded fontSize="large" />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{radStats.total}</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>Total Scans</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, borderRadius: 3, display: "flex", alignItems: "center", gap: 2 }}>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "warning.light", color: "warning.main" }}>
              <PendingActionsRounded fontSize="large" />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{radStats.pending}</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>Pending Scans</Typography>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, borderRadius: 3, display: "flex", alignItems: "center", gap: 2 }}>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "success.light", color: "success.main" }}>
              <CheckCircleRounded fontSize="large" />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{radStats.completed}</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>Completed Scans</Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
