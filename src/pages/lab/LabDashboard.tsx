import { Box, Typography, Grid, Paper, CircularProgress, Chip, Table, TableBody, TableCell, TableHead, TableRow, Button, alpha } from "@mui/material";
import { ScienceRounded, CheckCircleRounded, PendingActionsRounded, BiotechRounded, AttachMoneyRounded, TrendingUpRounded } from "@mui/icons-material";
import { useState, useEffect } from "react";
import { axiosInstance } from "../../api/axios";
import Mascot from "../../components/Mascot";
import { useNavigate } from "react-router-dom";

export default function LabDashboard() {
  const [loading, setLoading] = useState(true);
  const [labStats, setLabStats] = useState({ total: 0, pending: 0, completed: 0, todayRevenue: 0 });
  const [radStats, setRadStats] = useState({ total: 0, pending: 0, completed: 0, todayRevenue: 0 });
  
  const [recentLabOrders, setRecentLabOrders] = useState<any[]>([]);
  const [recentRadOrders, setRecentRadOrders] = useState<any[]>([]);

  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const isToday = (dateString: string) => {
    const today = new Date();
    const date = new Date(dateString);
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [labRes, radRes] = await Promise.all([
        axiosInstance.get("/lab/orders"),
        axiosInstance.get("/lab/radiology-orders")
      ]);

      const labOrders = labRes.data.data || [];
      const radOrders = radRes.data.data || [];

      // Calculate Lab Stats
      let labRev = 0;
      labOrders.forEach((o: any) => {
        if (isToday(o.createdAt)) {
          const orderTotal = o.reports?.reduce((sum: number, r: any) => sum + Number(r.labTest?.price || 0), 0) || 0;
          if (o.paymentStatus === 'PAID') labRev += orderTotal;
        }
      });

      setLabStats({
        total: labOrders.length,
        pending: labOrders.filter((o: any) => o.status !== "COMPLETED").length,
        completed: labOrders.filter((o: any) => o.status === "COMPLETED").length,
        todayRevenue: labRev
      });

      // Calculate Rad Stats
      let radRev = 0;
      radOrders.forEach((o: any) => {
        if (isToday(o.orderDate)) {
          if (o.paymentStatus === 'PAID') radRev += 1000; 
        }
      });

      setRadStats({
        total: radOrders.length,
        pending: radOrders.filter((o: any) => o.status !== "COMPLETED").length,
        completed: radOrders.filter((o: any) => o.status === "COMPLETED").length,
        todayRevenue: radRev
      });

      // Recent pending orders
      const pendingLabs = labOrders.filter((o: any) => o.status !== "COMPLETED").sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
      setRecentLabOrders(pendingLabs);

      const pendingRads = radOrders.filter((o: any) => o.status !== "COMPLETED").sort((a: any, b: any) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()).slice(0, 5);
      setRecentRadOrders(pendingRads);

    } catch (err) {
      console.error("Failed to load dashboard stats", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "success";
      case "SAMPLE_COLLECTED": return "info";
      case "IN_PROGRESS": return "warning";
      case "PENDING": return "default";
      default: return "default";
    }
  };

  const StatCard = ({ title, value, icon, color }: any) => (
    <Paper sx={{ p: 3, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(color, 0.1) }}>
        {icon}
      </Box>
      <Box>
        <Typography variant="body2" color="text.secondary" fontWeight={600} mb={0.5}>{title}</Typography>
        <Typography variant="h4" fontWeight={800} color={color}>{value}</Typography>
      </Box>
    </Paper>
  );

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", p: 10 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ 
            fontWeight: 800, 
            background: 'linear-gradient(135deg, #4F46E5 0%, #EC4899 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}>
            Lab & Radiology Overview
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5 }}>
            Pending orders and recent activity across the laboratory and radiology departments.
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => navigate("/lab/orders")} startIcon={<ScienceRounded />} sx={{ borderRadius: 2 }}>
          View Worklist
        </Button>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            title="Total Pending Lab Tests" 
            value={labStats.pending} 
            icon={<ScienceRounded sx={{ fontSize: 32, color: '#3b82f6' }} />} 
            color="#3b82f6"
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            title="Total Pending Radiology" 
            value={radStats.pending} 
            icon={<BiotechRounded sx={{ fontSize: 32, color: '#f59e0b' }} />} 
            color="#f59e0b"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            title="Completed Today" 
            value={labStats.completed + radStats.completed} 
            icon={<CheckCircleRounded sx={{ fontSize: 32, color: '#10b981' }} />} 
            color="#10b981"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            title="Est. Daily Revenue" 
            value={`₹${(labStats.todayRevenue + radStats.todayRevenue).toLocaleString()}`} 
            icon={<AttachMoneyRounded sx={{ fontSize: 32, color: '#8b5cf6' }} />} 
            color="#8b5cf6"
          />
        </Grid>
      </Grid>

      <Grid container spacing={4}>
        {/* Action Center */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, borderRadius: 4, height: "100%", display: "flex", flexDirection: "column", border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Quick Actions</Typography>
            
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
              <Button variant="outlined" color="primary" onClick={() => navigate("/lab/orders")} sx={{ justifyContent: "flex-start", py: 1.5, borderRadius: 2, fontWeight: 600 }}>
                <PendingActionsRounded sx={{ mr: 1.5 }} /> Process Lab Samples
              </Button>
              <Button variant="outlined" color="warning" onClick={() => navigate("/lab/radiology")} sx={{ justifyContent: "flex-start", py: 1.5, borderRadius: 2, fontWeight: 600 }}>
                <BiotechRounded sx={{ mr: 1.5 }} /> Upload Radiology Reports
              </Button>
              
              <Box sx={{ mt: 'auto', pt: 3, borderTop: '1px dashed', borderColor: 'divider' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  <strong>Need Help?</strong> Check out the Lab Equipment manuals or contact IT Support for integration issues.
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Recent Lab Orders */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, borderRadius: 4, height: "100%", border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Recent Pending Lab Orders</Typography>
              <Button size="small" onClick={() => navigate("/lab/orders")}>View All</Button>
            </Box>
            
            {recentLabOrders.length === 0 ? (
              <Mascot pose="all-caught-up" subtitle="No pending lab orders." size={110} />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Patient</TableCell>
                    <TableCell>Barcode</TableCell>
                    <TableCell align="right">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentLabOrders.map((order) => (
                    <TableRow key={order.labOrderId}>
                      <TableCell sx={{ fontWeight: 600 }}>{order.patient?.firstName} {order.patient?.lastName}</TableCell>
                      <TableCell>{order.sampleBarcode || "N/A"}</TableCell>
                      <TableCell align="right">
                        <Chip label={order.status || "PENDING"} color={getStatusColor(order.status) as any} size="small" sx={{ fontSize: "0.7rem", height: 20 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>

        {/* Recent Rad Orders */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, borderRadius: 4, height: "100%", border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Recent Pending Radiology</Typography>
              <Button size="small" onClick={() => navigate("/lab/radiology")}>View All</Button>
            </Box>
            
            {recentRadOrders.length === 0 ? (
              <Mascot pose="all-caught-up" subtitle="No pending radiology orders." size={110} />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Patient</TableCell>
                    <TableCell>Scan Type</TableCell>
                    <TableCell align="right">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentRadOrders.map((order) => (
                    <TableRow key={order.radiologyOrderId}>
                      <TableCell sx={{ fontWeight: 600 }}>{order.patient?.firstName} {order.patient?.lastName}</TableCell>
                      <TableCell>{order.scanType}</TableCell>
                      <TableCell align="right">
                        <Chip label={order.status || "PENDING"} color={getStatusColor(order.status) as any} size="small" sx={{ fontSize: "0.7rem", height: 20 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
