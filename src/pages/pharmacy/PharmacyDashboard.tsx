import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { 
  Box, Typography, Grid, Paper, Table, TableBody, TableCell, TableHead, TableRow, alpha, useTheme,
  Tabs, Tab, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, Select, MenuItem, TextField, Chip, Tooltip
} from "@mui/material";
import {
  MedicationRounded, LocalShippingRounded, WarningRounded, PointOfSaleRounded, DashboardRounded
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";
import Mascot from "../../components/Mascot";
import DashboardSkeleton from "../../components/skeletons/DashboardSkeleton";
import ErrorState from "../../components/ErrorState";
import StatCard from "../../components/StatCard";
import PharmacyPage from "./components/PharmacyPage";
import type { Medicine, LowStockAlert, PharmacyOrder, PurchaseOrder } from "../../types";
import { apiErrorText } from "../../utils/apiError";

export default function PharmacyDashboard() {
  const theme = useTheme();
  const { data, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ["pharmacy-dashboard"],
    queryFn: async () => {
      const [medRes, invRes, poRes, salesRes, alertsRes] = await Promise.all([
        axiosInstance.get("/pharmacy/medicines"),
        axiosInstance.get("/pharmacy/inventory"),
        axiosInstance.get("/pharmacy/purchase-orders"),
        axiosInstance.get("/pharmacy/orders"),
        axiosInstance.get("/pharmacy/low-stock-alerts"),
      ]);
      return {
        medicines: medRes.data.data || [],
        inventory: invRes.data.data || [],
        purchaseOrders: poRes.data.data || [],
        sales: salesRes.data.data || [],
        lowStockAlerts: alertsRes.data.data || [],
      };
    },
  });
  const medicines: Medicine[] = data?.medicines ?? [];
  const purchaseOrders: PurchaseOrder[] = data?.purchaseOrders ?? [];
  const sales: PharmacyOrder[] = data?.sales ?? [];
  const lowStockAlerts: LowStockAlert[] = data?.lowStockAlerts ?? [];

  const pendingPOs = purchaseOrders.filter(po => po.status === 'pending');
  const totalSalesValue = sales.reduce((sum, order) => sum + parseFloat(String(order.totalAmount || 0)), 0);

  const getMedicineName = (id: string) => medicines.find(m => m.medicineId === id)?.medicineName || 'Unknown';

  return (
    <PharmacyPage
      title="Dashboard Overview"
      subtitle="Pharmacy summary, low stock alerts, and recent activities."
      icon={<DashboardRounded fontSize="large" sx={{ color: '#4F46E5' }} />}
    >
      {loading ? (
        <DashboardSkeleton />
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : (
        <>
          <Grid container spacing={3} mb={4}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard 
                    label="Total Medicines"
                    value={medicines.length} 
                    icon={<MedicationRounded sx={{ fontSize: 32, color: '#4F46E5' }} />} 
                    color="#4F46E5"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard 
                    label="Low Stock Alerts"
                    value={lowStockAlerts.length} 
                    icon={<WarningRounded sx={{ fontSize: 32, color: '#EF4444' }} />} 
                    color="#EF4444"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard 
                    label="Pending POs"
                    value={pendingPOs.length} 
                    icon={<LocalShippingRounded sx={{ fontSize: 32, color: '#F59E0B' }} />} 
                    color="#F59E0B"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard 
                    label="Total Sales"
                    value={`₹${totalSalesValue.toFixed(2)}`}
                    icon={<PointOfSaleRounded sx={{ fontSize: 32, color: '#10B981' }} />} 
                    color="#10B981"
                  />
                </Grid>
              </Grid>

              <Grid container spacing={4}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ p: 2, bgcolor: alpha(theme.palette.error.main, 0.04), borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="h6" fontWeight="700" color="error.main" display="flex" alignItems="center" gap={1}>
                        <WarningRounded /> Low Stock Alerts
                      </Typography>
                    </Box>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Medicine</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Available</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Reorder Level</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {lowStockAlerts.length === 0 ? (
                          <TableRow><TableCell colSpan={3} sx={{ py: 3, border: 0 }}><Mascot pose="all-caught-up" subtitle="No low stock items — inventory looks healthy." size={110} /></TableCell></TableRow>
                        ) : lowStockAlerts.map(item => (
                          <TableRow key={item.medicineId}>
                            <TableCell sx={{ fontWeight: 600 }}>{item.medicineName}</TableCell>
                            <TableCell sx={{ color: 'error.main', fontWeight: 700 }}>{item.currentStock}</TableCell>
                            <TableCell>{item.minStockLevel}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                </Grid>
                
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.04), borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="h6" fontWeight="700" color="success.main" display="flex" alignItems="center" gap={1}>
                        <PointOfSaleRounded /> Recent Sales
                      </Typography>
                    </Box>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Order ID</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Amount</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sales.filter(s => s.status !== "cancelled").slice(0, 5).length === 0 ? (
                          <TableRow><TableCell colSpan={3} sx={{ py: 3, border: 0 }}><Mascot pose="nothing-here-yet" subtitle="No recent sales." size={110} /></TableCell></TableRow>
                        ) : sales.filter(s => s.status !== "cancelled").slice(0, 5).map(sale => (
                          <TableRow key={sale.pharmacyOrderId}>
                            <TableCell sx={{ fontFamily: 'monospace' }}>{sale.pharmacyOrderId.split('-')[0].toUpperCase()}</TableCell>
                            <TableCell>{new Date(sale.createdAt).toLocaleString()}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: '#10B981' }}>₹{parseFloat(sale.totalAmount).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                </Grid>
              </Grid>
            </>
      )}
    </PharmacyPage>
  );
}
