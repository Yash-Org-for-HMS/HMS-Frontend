import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Box, Typography, Grid, Paper, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow, alpha, useTheme,
  Tabs, Tab, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, Select, MenuItem, TextField, Chip, Tooltip
} from "@mui/material";
import { 
  MedicationRounded, LocalShippingRounded, WarningRounded, PointOfSaleRounded
} from "@mui/icons-material";
import { axiosInstance } from "../../api/axios";

export default function PharmacyDashboard() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  
  const [medicines, setMedicines] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [medRes, invRes, poRes, salesRes] = await Promise.all([
          axiosInstance.get("/pharmacy/medicines"),
          axiosInstance.get("/pharmacy/inventory"),
          axiosInstance.get("/pharmacy/purchase-orders"),
          axiosInstance.get("/pharmacy/orders")
        ]);
        setMedicines(medRes.data.data || []);
        setInventory(invRes.data.data || []);
        setPurchaseOrders(poRes.data.data || []);
        setSales(salesRes.data.data || []);
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  const lowStockItems = inventory.filter(inv => inv.availableQuantity <= inv.reorderLevel);
  const pendingPOs = purchaseOrders.filter(po => po.status === 'pending');
  const totalSalesValue = sales.reduce((sum, order) => sum + parseFloat(order.totalAmount || 0), 0);

  const getMedicineName = (id: string) => medicines.find(m => m.medicineId === id)?.medicineName || 'Unknown';

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

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: "auto" }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ 
          fontWeight: 800, 
          background: 'linear-gradient(135deg, #4F46E5 0%, #EC4899 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5
        }}>
          Dashboard Overview
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5 }}>
          Pharmacy summary, low stock alerts, and recent activities.
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 8 }}>
          <CircularProgress size={48} thickness={4} />
        </Box>
      ) : (
        <>
          <Grid container spacing={3} mb={4}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard 
                    title="Total Medicines" 
                    value={medicines.length} 
                    icon={<MedicationRounded sx={{ fontSize: 32, color: '#4F46E5' }} />} 
                    color="#4F46E5"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard 
                    title="Low Stock Alerts" 
                    value={lowStockItems.length} 
                    icon={<WarningRounded sx={{ fontSize: 32, color: '#EF4444' }} />} 
                    color="#EF4444"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard 
                    title="Pending POs" 
                    value={pendingPOs.length} 
                    icon={<LocalShippingRounded sx={{ fontSize: 32, color: '#F59E0B' }} />} 
                    color="#F59E0B"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard 
                    title="Total Sales" 
                    value={`$${totalSalesValue.toFixed(2)}`} 
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
                        {lowStockItems.length === 0 ? (
                          <TableRow><TableCell colSpan={3} align="center" sx={{ py: 3 }}>No low stock items</TableCell></TableRow>
                        ) : lowStockItems.map(item => (
                          <TableRow key={item.inventoryId}>
                            <TableCell sx={{ fontWeight: 600 }}>{getMedicineName(item.medicineId)}</TableCell>
                            <TableCell sx={{ color: 'error.main', fontWeight: 700 }}>{item.availableQuantity}</TableCell>
                            <TableCell>{item.reorderLevel}</TableCell>
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
                          <TableRow><TableCell colSpan={3} align="center" sx={{ py: 3 }}>No recent sales</TableCell></TableRow>
                        ) : sales.filter(s => s.status !== "cancelled").slice(0, 5).map(sale => (
                          <TableRow key={sale.pharmacyOrderId}>
                            <TableCell sx={{ fontFamily: 'monospace' }}>{sale.pharmacyOrderId.split('-')[0].toUpperCase()}</TableCell>
                            <TableCell>{new Date(sale.createdAt).toLocaleString()}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: '#10B981' }}>${parseFloat(sale.totalAmount).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                </Grid>
              </Grid>
            </>
      )}
    </Box>
  );
}
