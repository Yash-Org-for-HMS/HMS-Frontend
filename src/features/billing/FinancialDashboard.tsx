import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, useTheme, Grid
} from "@mui/material";
import {
  AccountBalanceRounded, TrendingUpRounded, ReceiptRounded, WarningRounded
} from "@mui/icons-material";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, LabelList
} from "recharts";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/StatCard";
import { apiErrorText } from "@/utils/apiError";
import { SEMANTIC, NEUTRAL } from "@/styles/accents";

// Each bar chart gets its own single hue (magnitude, not identity) — the two
// charts are told apart by their titles, not by cycling colours within either.
const SOURCE_BAR = "#0891b2";
const METHOD_BAR = "#8b5cf6";

export default function FinancialDashboard() {
  const theme = useTheme();
  const { data: analytics, isLoading: loading, isError, error, refetch } = useQuery({
    queryKey: ["financial-analytics", 30],
    queryFn: async () => (await axiosInstance.get("/billing/analytics?days=30")).data.data,
  });

  if (loading) {
    return (
      <DashboardSkeleton />
    );
  }

  if (isError || !analytics) {
    return (
      <Box>
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      </Box>
    );
  }

  const collectionRate = analytics.expectedRevenue > 0
    ? Math.round((analytics.totalCollected / analytics.expectedRevenue) * 100)
    : null;

  return (
    <Box>
      <PageHeader
        title="Financial Overview"
        subtitle="Real-time insights and revenue analytics"
      />

      <Grid container spacing={4} sx={{ mb: 6 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Total Collected (to date)"
            value={`₹${(analytics.totalCollected || 0).toLocaleString()}`}
            icon={<AccountBalanceRounded />}
            color={SEMANTIC.success}
            sub={collectionRate !== null ? `${collectionRate}% of billed value · net of refunds` : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Billed Value (to date)"
            value={`₹${(analytics.expectedRevenue || 0).toLocaleString()}`}
            icon={<TrendingUpRounded />}
            color={SEMANTIC.info}
            sub="Excludes cancelled and draft invoices"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Outstanding Dues (to date)"
            value={`₹${(analytics.outstandingDues || 0).toLocaleString()}`}
            icon={<WarningRounded />}
            color={SEMANTIC.danger}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Invoices Issued (to date)"
            value={analytics.totalInvoices || 0}
            icon={<ReceiptRounded />}
            color="#8B5CF6"
          />
        </Grid>
      </Grid>

      <Grid container spacing={4}>
        {/* Full Width Trend Chart */}
        <Grid size={{ xs: 12 }}>
          <Paper 
            elevation={0} 
            sx={{ 
              p: { xs: 2, md: 3 }, 
              borderRadius: 4, 
              border: "1px solid", 
              borderColor: "divider", 
              height: 350, 
              display: "flex", 
              flexDirection: "column",
              boxShadow: "0 4px 24px rgba(0,0,0,0.02)"
            }}
          >
            <Typography variant="h6" sx={{ color: "text.primary", mb: 2, fontWeight: 700 }}>
              Revenue Trend (Last 30 Days)
            </Typography>
            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SEMANTIC.success} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={SEMANTIC.success} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke={NEUTRAL.muted} 
                    tick={{ fill: NEUTRAL.muted, fontSize: 13, fontWeight: 500 }} 
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }}
                  />
                  <YAxis 
                    stroke={NEUTRAL.muted} 
                    tick={{ fill: NEUTRAL.muted, fontSize: 13, fontWeight: 500 }} 
                    axisLine={false} 
                    tickLine={false}
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <RechartsTooltip
                    contentStyle={{ 
                      backgroundColor: theme.palette.background.paper, 
                      border: "none", 
                      borderRadius: 12, 
                      color: theme.palette.text.primary, 
                      boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
                      padding: "16px"
                    }}
                    itemStyle={{ color: SEMANTIC.success, fontWeight: 800, fontSize: "1.1rem" }}
                    labelStyle={{ color: theme.palette.text.secondary, marginBottom: 8, fontWeight: 600 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke={SEMANTIC.success} 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Revenue By Department — sorted magnitude bars, one hue, direct labels */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 3 },
              borderRadius: 4,
              border: "1px solid",
              borderColor: "divider",
              height: 350,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 4px 24px rgba(0,0,0,0.02)"
            }}
          >
            <Typography variant="h6" sx={{ color: "text.primary", mb: 2, fontWeight: 600 }}>
              Revenue Source
            </Typography>
            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...analytics.departmentRevenue].sort((a: any, b: any) => b.amount - a.amount)}
                  layout="vertical"
                  margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
                >
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fill: NEUTRAL.muted, fontSize: 13 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: `${SOURCE_BAR}14` }}
                    contentStyle={{ backgroundColor: theme.palette.background.paper, border: "none", borderRadius: 12, boxShadow: "0 10px 40px rgba(0,0,0,0.1)", padding: "12px 16px" }}
                    itemStyle={{ fontWeight: 800, fontSize: "1rem", color: SOURCE_BAR }}
                    formatter={(v) => [`₹${Number(v).toLocaleString()}`, "Revenue"]}
                  />
                  <Bar dataKey="amount" fill={SOURCE_BAR} radius={[0, 4, 4, 0]} barSize={22}>
                    <LabelList dataKey="amount" position="right" formatter={(v) => `₹${Number(v).toLocaleString()}`} style={{ fill: "#475569", fontSize: 12, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Payment Methods — same treatment, its own hue so the two charts read
            as distinct without cycling colours within either. */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 3 },
              borderRadius: 4,
              border: "1px solid",
              borderColor: "divider",
              height: 350,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 4px 24px rgba(0,0,0,0.02)"
            }}
          >
            <Typography variant="h6" sx={{ color: "text.primary", mb: 2, fontWeight: 600 }}>
              Payment Methods
            </Typography>
            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...analytics.paymentMethods].sort((a: any, b: any) => b.amount - a.amount)}
                  layout="vertical"
                  margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
                >
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fill: NEUTRAL.muted, fontSize: 13 }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: `${METHOD_BAR}14` }}
                    contentStyle={{ backgroundColor: theme.palette.background.paper, border: "none", borderRadius: 12, boxShadow: "0 10px 40px rgba(0,0,0,0.1)", padding: "12px 16px" }}
                    itemStyle={{ fontWeight: 800, fontSize: "1rem", color: METHOD_BAR }}
                    formatter={(v) => [`₹${Number(v).toLocaleString()}`, "Collected"]}
                  />
                  <Bar dataKey="amount" fill={METHOD_BAR} radius={[0, 4, 4, 0]} barSize={22}>
                    <LabelList dataKey="amount" position="right" formatter={(v) => `₹${Number(v).toLocaleString()}`} style={{ fill: "#475569", fontSize: 12, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
