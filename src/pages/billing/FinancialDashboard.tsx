import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, useTheme, Grid
} from "@mui/material";
import {
  AccountBalanceRounded, TrendingUpRounded, ReceiptRounded, WarningRounded
} from "@mui/icons-material";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { axiosInstance } from "../../api/axios";
import ErrorState from "../../components/ErrorState";
import DashboardSkeleton from "../../components/skeletons/DashboardSkeleton";
import PageHeader from "../../components/layout/PageHeader";
import StatCard from "../../components/StatCard";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
const PAYMENT_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b"];

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
        <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Financial Overview"
        subtitle="Real-time insights and revenue analytics"
      />

      <Grid container spacing={4} sx={{ mb: 6 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Total Revenue Collected"
            value={`₹${(analytics.totalCollected || 0).toLocaleString()}`}
            icon={<AccountBalanceRounded />}
            color="#10B981"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Expected Revenue (Gross)"
            value={`₹${(analytics.expectedRevenue || 0).toLocaleString()}`}
            icon={<TrendingUpRounded />}
            color="#3B82F6"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Outstanding Dues"
            value={`₹${(analytics.outstandingDues || 0).toLocaleString()}`}
            icon={<WarningRounded />}
            color="#EF4444"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Total Invoices Generated"
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
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748B" 
                    tick={{ fill: "#64748B", fontSize: 13, fontWeight: 500 }} 
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }}
                  />
                  <YAxis 
                    stroke="#64748B" 
                    tick={{ fill: "#64748B", fontSize: 13, fontWeight: 500 }} 
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
                    itemStyle={{ color: "#10B981", fontWeight: 800, fontSize: "1.1rem" }}
                    labelStyle={{ color: theme.palette.text.secondary, marginBottom: 8, fontWeight: 600 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#10B981" 
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

        {/* Revenue By Department */}
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
                <PieChart>
                  <Pie
                    data={analytics.departmentRevenue}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="amount"
                    nameKey="name"
                    stroke="none"
                    animationDuration={1500}
                  >
                    {analytics.departmentRevenue.map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ 
                      backgroundColor: theme.palette.background.paper, 
                      border: "none", 
                      borderRadius: 12, 
                      boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
                      padding: "12px 16px"
                    }}
                    itemStyle={{ fontWeight: 800, fontSize: "1.1rem" }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={48} 
                    iconType="circle"
                    wrapperStyle={{ paddingTop: "20px", fontWeight: 600 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Payment Methods */}
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
                <PieChart>
                  <Pie
                    data={analytics.paymentMethods}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="amount"
                    nameKey="name"
                    stroke={theme.palette.background.paper}
                    strokeWidth={3}
                    animationDuration={1500}
                  >
                    {analytics.paymentMethods.map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ 
                      backgroundColor: theme.palette.background.paper, 
                      border: "none", 
                      borderRadius: 12, 
                      boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
                      padding: "12px 16px"
                    }}
                    itemStyle={{ fontWeight: 800, fontSize: "1.1rem" }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={48} 
                    iconType="circle"
                    wrapperStyle={{ paddingTop: "20px", fontWeight: 600 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
