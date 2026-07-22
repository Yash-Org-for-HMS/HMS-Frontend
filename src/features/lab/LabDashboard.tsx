import { Box, Typography, Grid, Paper, Chip, Table, TableBody, TableCell, TableHead, TableRow, Button } from "@mui/material";
import { SEMANTIC } from "@/styles/accents";
import { orderStatusColor } from "@/utils/statusColors";
import { ScienceRounded, CheckCircleRounded, PendingActionsRounded, BiotechRounded, AttachMoneyRounded, TrendingUpRounded } from "@mui/icons-material";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import Mascot from "@/components/Mascot";
import ErrorState from "@/components/ErrorState";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/StatCard";
import { apiErrorText } from "@/utils/apiError";

export default function LabDashboard() {
  const navigate = useNavigate();

  const isToday = (dateString: string) => {
    const today = new Date();
    const date = new Date(dateString);
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const { data, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ["lab-dashboard"],
    queryFn: async () => {
      const [labRes, radRes] = await Promise.all([
        axiosInstance.get("/lab/orders"),
        axiosInstance.get("/lab/radiology-orders"),
      ]);

      const labOrders = labRes.data.data || [];
      const radOrders = radRes.data.data || [];

      let labRev = 0;
      labOrders.forEach((o: any) => {
        if (isToday(o.createdAt)) {
          const orderTotal = o.reports?.reduce((sum: number, r: any) => sum + Number(r.labTest?.price || 0), 0) || 0;
          if (o.paymentStatus === 'PAID') labRev += orderTotal;
        }
      });
      const labStats = {
        total: labOrders.length,
        pending: labOrders.filter((o: any) => o.status !== "COMPLETED").length,
        completed: labOrders.filter((o: any) => o.status === "COMPLETED").length,
        todayRevenue: labRev,
      };

      let radRev = 0;
      radOrders.forEach((o: any) => {
        if (isToday(o.orderDate) && o.paymentStatus === 'PAID') radRev += 1000;
      });
      const radStats = {
        total: radOrders.length,
        pending: radOrders.filter((o: any) => o.status !== "COMPLETED").length,
        completed: radOrders.filter((o: any) => o.status === "COMPLETED").length,
        todayRevenue: radRev,
      };

      const recentLabOrders = labOrders.filter((o: any) => o.status !== "COMPLETED")
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
      const recentRadOrders = radOrders.filter((o: any) => o.status !== "COMPLETED")
        .sort((a: any, b: any) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()).slice(0, 5);

      return { labStats, radStats, recentLabOrders, recentRadOrders };
    },
  });

  const labStats = data?.labStats ?? { total: 0, pending: 0, completed: 0, todayRevenue: 0 };
  const radStats = data?.radStats ?? { total: 0, pending: 0, completed: 0, todayRevenue: 0 };
  const recentLabOrders: any[] = data?.recentLabOrders ?? [];
  const recentRadOrders: any[] = data?.recentRadOrders ?? [];


  if (loading) {
    return <DashboardSkeleton />;
  }

  if (isError) {
    return (
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <PageHeader
        title="Lab & Radiology Overview"
        subtitle="Pending orders and recent activity across the laboratory and radiology departments."
        actions={
          <Button variant="contained" onClick={() => navigate("/lab/orders")} startIcon={<ScienceRounded />} sx={{ borderRadius: 2 }}>
            View Worklist
          </Button>
        }
      />

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            label="Total Pending Lab Tests"
            value={labStats.pending} 
            icon={<ScienceRounded sx={{ fontSize: 32, color: SEMANTIC.info }} />} 
            color={SEMANTIC.info}
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            label="Total Pending Radiology"
            value={radStats.pending} 
            icon={<BiotechRounded sx={{ fontSize: 32, color: SEMANTIC.warning }} />} 
            color={SEMANTIC.warning}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            label="Completed Today"
            value={labStats.completed + radStats.completed} 
            icon={<CheckCircleRounded sx={{ fontSize: 32, color: SEMANTIC.success }} />} 
            color={SEMANTIC.success}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard 
            label="Est. Daily Revenue"
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
                        <Chip label={order.status || "PENDING"} color={orderStatusColor(order.status) as any} size="small" sx={{ fontSize: "0.75rem", height: 20 }} />
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
                        <Chip label={order.status || "PENDING"} color={orderStatusColor(order.status) as any} size="small" sx={{ fontSize: "0.75rem", height: 20 }} />
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
