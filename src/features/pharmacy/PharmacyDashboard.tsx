import { useQuery } from "@tanstack/react-query";
import { SEMANTIC, BRAND } from "@/styles/accents";
import { useNavigate } from "react-router-dom";
import { 
  Box, Typography, Grid, Paper, Table, TableBody, TableCell, TableHead, TableRow, alpha, useTheme
} from "@mui/material";
import {
  MedicationRounded, VaccinesRounded, WarningRounded, PointOfSaleRounded, EventBusyRounded
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import Mascot from "@/components/Mascot";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import ErrorState from "@/components/ErrorState";
import StatCard from "@/components/StatCard";
import AttentionList from "@/components/dashboard/AttentionList";
import PharmacyPage from "./components/PharmacyPage";
import type { LowStockAlert } from "@/types";
import { apiErrorText } from "@/utils/apiError";
import { formatINR } from "@/utils/format";

interface ExpiringBatch {
  inventoryId: string;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  availableQuantity: number;
  /** Negative once the batch is already past its expiry date. */
  daysLeft: number;
}
interface RecentSale {
  pharmacyOrderId: string;
  createdAt: string;
  totalAmount: string | number;
  patientName: string;
  itemCount: number;
}

const inr = (v: number | null | undefined) => formatINR(v, 0);

export default function PharmacyDashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { data, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ["pharmacy-dashboard"],
    queryFn: async () => {
      // Counts/aggregates + a small recent list come from one stats endpoint, so
      // the dashboard never pulls the full catalog / inventory / sales history.
      const [statsRes, alertsRes] = await Promise.all([
        axiosInstance.get("/pharmacy/dashboard-stats"),
        axiosInstance.get("/pharmacy/low-stock-alerts"),
      ]);
      return {
        stats: statsRes.data.data || {},
        lowStockAlerts: alertsRes.data.data || [],
      };
    },
  });
  const stats = data?.stats ?? {};
  const lowStockAlerts: LowStockAlert[] = data?.lowStockAlerts ?? [];

  const medicineCount: number = stats.medicineCount ?? 0;
  const pendingPOCount: number = stats.pendingPOCount ?? 0;
  const ipdRequestsPending: number = stats.ipdRequestsPending ?? 0;
  const salesToday: number = Number(stats.salesToday ?? 0);
  const salesPrevious: number = Number(stats.salesPrevious ?? 0);
  const expiring: ExpiringBatch[] = stats.expiring ?? [];
  const expiringCount: number = stats.expiringCount ?? 0;
  const expiryHorizonDays: number = stats.expiryHorizonDays ?? 90;
  const recentSales: RecentSale[] = stats.recentSales ?? [];

  return (
    <PharmacyPage
      title="Dashboard Overview"
      subtitle="Pharmacy summary, low stock alerts, and recent activities."
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
                    label="Medicines in catalog"
                    value={medicineCount}
                    icon={<MedicationRounded sx={{ color: BRAND.action }} />} 
                    color={BRAND.action}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard 
                    label="Low Stock Alerts"
                    value={lowStockAlerts.length}
                    sub={pendingPOCount ? `${pendingPOCount} purchase order${pendingPOCount === 1 ? "" : "s"} open` : "No open purchase orders"}
                    icon={<WarningRounded sx={{ color: SEMANTIC.danger }} />} 
                    color={SEMANTIC.danger}
                    onClick={() => navigate("/pharmacy/inventory")}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  {/* Ward requests waiting on this desk. There was no sign of
                      them here at all — the only way to know was to open the
                      IPD Medication Requests page and look. */}
                  <StatCard
                    label="IPD requests waiting"
                    value={ipdRequestsPending}
                    sub={ipdRequestsPending ? "Ward medicines not yet dispensed" : "Nothing waiting from the wards"}
                    icon={<VaccinesRounded sx={{ color: SEMANTIC.warning }} />}
                    color={SEMANTIC.warning}
                    onClick={() => navigate("/pharmacy/ipd-requests")}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  {/* Was "Total Sales" — the sum of every order ever placed,
                      with no period stated. A lifetime figure only goes up, so
                      it could never say whether today was any good. */}
                  <StatCard
                    label="Sales today"
                    value={inr(salesToday)}
                    current={salesToday} previous={salesPrevious}
                    deltaLabel="vs the same weekday last week"
                    icon={<PointOfSaleRounded sx={{ color: SEMANTIC.success }} />}
                    color={SEMANTIC.success}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={4}>
                <Grid size={{ xs: 12, md: 6 }}>
                  {/* Ranked worst-first, so the medicine closest to running out
                      is the one you read. The old table was in whatever order
                      the API returned and gave every row equal weight. */}
                  <AttentionList
                    title="Low stock"
                    subtitle="Furthest below its reorder level first"
                    emptyText="No low stock items — inventory looks healthy."
                    items={lowStockAlerts
                      .map((item) => ({
                        item,
                        shortBy: Number(item.minStockLevel ?? 0) - Number(item.currentStock ?? 0),
                        out: Number(item.currentStock ?? 0) <= 0,
                      }))
                      // Out of stock outranks everything: a medicine you cannot
                      // dispense at all is more urgent than one that is merely
                      // further below its reorder level.
                      .sort((a, b) => Number(b.out) - Number(a.out) || b.shortBy - a.shortBy)
                      .map(({ item, shortBy }) => ({
                        id: item.medicineId,
                        primary: item.medicineName,
                        secondary: `${item.currentStock} in stock · reorder at ${item.minStockLevel}`,
                        meta: Number(item.currentStock ?? 0) <= 0 ? "Out of stock" : `${shortBy} short`,
                        severity: (Number(item.currentStock ?? 0) <= 0 ? "critical" : "warning") as "critical" | "warning",
                        icon: <WarningRounded sx={{ fontSize: 18 }} />,
                        onClick: () => navigate("/pharmacy/inventory"),
                      }))}
                    actionLabel="Inventory & POs"
                    onAction={() => navigate("/pharmacy/inventory")}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  {/* The other way a pharmacy loses money, and unlike low stock
                      it is silent until it's too late — nothing on this screen
                      mentioned expiry at all. Soonest first; already-expired
                      batches lead. */}
                  <AttentionList
                    title="Expiring soon"
                    subtitle={`Batches within ${expiryHorizonDays} days of expiry, soonest first`}
                    emptyText={`Nothing expiring in the next ${expiryHorizonDays} days.`}
                    items={expiring.map((b) => ({
                      id: b.inventoryId,
                      primary: b.medicineName,
                      secondary: `Batch ${b.batchNumber} · ${b.availableQuantity} in stock · expires ${new Date(b.expiryDate).toLocaleDateString()}`,
                      meta: b.daysLeft < 0 ? "Expired" : b.daysLeft === 0 ? "Today" : `${b.daysLeft}d`,
                      severity: (b.daysLeft < 0 ? "critical" : b.daysLeft <= 30 ? "warning" : "info") as "critical" | "warning" | "info",
                      icon: <EventBusyRounded sx={{ fontSize: 18 }} />,
                      onClick: () => navigate("/pharmacy/inventory"),
                    }))}
                    maxRows={5}
                    totalCount={expiringCount}
                    actionLabel="Inventory & POs"
                    onAction={() => navigate("/pharmacy/inventory")}
                  />
                </Grid>

                {/* Full width: the two attention lists above already fill a
                    two-column row, so a half-width third panel just leaves a
                    hole beside it. */}
                <Grid size={{ xs: 12 }}>
                  <Paper sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.04), borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="h6" fontWeight="700" color="success.main" display="flex" alignItems="center" gap={1}>
                        <PointOfSaleRounded /> Recent Sales
                      </Typography>
                    </Box>
                    {/* Was a column of order-ID fragments (6D5CFAB3, 0FDA7C50).
                        Nobody recognises a sale by its id — they recognise the
                        patient and what was dispensed. */}
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Patient</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>When</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Amount</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {recentSales.length === 0 ? (
                          <TableRow><TableCell colSpan={3} sx={{ py: 3, border: 0 }}><Mascot pose="nothing-here-yet" subtitle="No recent sales." size={110} /></TableCell></TableRow>
                        ) : recentSales.map(sale => (
                          <TableRow key={sale.pharmacyOrderId}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>{sale.patientName}</Typography>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                {sale.itemCount} item{sale.itemCount === 1 ? "" : "s"}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ color: "text.secondary" }}>{new Date(sale.createdAt).toLocaleString()}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, color: SEMANTIC.success }}>{inr(Number(sale.totalAmount))}</TableCell>
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
