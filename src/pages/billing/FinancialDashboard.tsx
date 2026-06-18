import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Paper, CircularProgress, alpha, useTheme, Grid
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
      <Box sx={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={60} thickness={4} />
      </Box>
    );
  }

  if (isError || !analytics) {
    return (
      <Box sx={{ p: 4, maxWidth: 1400, mx: "auto" }}>
        <ErrorState message={(error as any)?.response?.data?.message} onRetry={() => refetch()} />
      </Box>
    );
  }

  const StatCard = ({ title, value, icon, colorHex }: any) => (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        borderRadius: 5,
        bgcolor: "background.paper",
        border: "1px solid", 
        borderColor: alpha(colorHex, 0.2),
        boxShadow: `0 8px 32px ${alpha(colorHex, 0.05)}`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 140,
        height: "100%",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: `0 12px 48px ${alpha(colorHex, 0.15)}`,
        }
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 3,
            bgcolor: alpha(colorHex, 0.1),
            color: colorHex,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            "& > svg": {
              fontSize: 28
            }
          }}
        >
          {icon}
        </Box>
      </Box>
      <Box>
        <Typography 
          sx={{ 
            fontWeight: 800, 
            color: "text.primary",
            fontSize: "clamp(1.2rem, 3vw, 1.8rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            wordBreak: "break-word",
          }}
        >
          {title.includes("Invoices") ? value.toLocaleString() : `₹${value.toLocaleString()}`}
        </Typography>
        <Typography 
          variant="subtitle1" 
          sx={{ 
            color: "text.secondary", 
            fontWeight: 700, 
            textTransform: "uppercase", 
            letterSpacing: 1, 
            mt: 1.5, 
            display: "block",
            lineHeight: 1.4
          }}
        >
          {title}
        </Typography>
      </Box>
    </Paper>
  );

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: "auto", bgcolor: alpha(theme.palette.background.default, 0.5), minHeight: '100vh' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="900" sx={{ color: "text.primary", letterSpacing: "-0.02em" }}>
          Financial Overview
        </Typography>
        <Typography variant="body1" color="text.secondary" fontWeight="500" sx={{ mt: 1 }}>
          Real-time insights and revenue analytics
        </Typography>
      </Box>

      <Grid container spacing={4} sx={{ mb: 6 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard 
            title="Total Revenue Collected" 
            value={analytics.totalCollected || 0} 
            icon={<AccountBalanceRounded />} 
            colorHex="#10B981" 
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard 
            title="Expected Revenue (Gross)" 
            value={analytics.expectedRevenue || 0} 
            icon={<TrendingUpRounded />} 
            colorHex="#3B82F6" 
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard 
            title="Outstanding Dues" 
            value={analytics.outstandingDues || 0} 
            icon={<WarningRounded />} 
            colorHex="#EF4444" 
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard 
            title="Total Invoices Generated" 
            value={analytics.totalInvoices || 0} 
            icon={<ReceiptRounded />} 
            colorHex="#8B5CF6" 
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
            <Typography variant="h5" sx={{ color: "text.primary", mb: 4, fontWeight: 800 }}>
              Revenue Trend (Last 30 Days)
            </Typography>
            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                    dy={15} 
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
              borderRadius: 5, 
              border: "1px solid", 
              borderColor: "divider", 
              height: 350, 
              display: "flex", 
              flexDirection: "column",
              boxShadow: "0 4px 24px rgba(0,0,0,0.02)"
            }}
          >
            <Typography variant="h6" sx={{ color: "text.primary", mb: 3, fontWeight: 700 }}>
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
              borderRadius: 5, 
              border: "1px solid", 
              borderColor: "divider", 
              height: 350, 
              display: "flex", 
              flexDirection: "column",
              boxShadow: "0 4px 24px rgba(0,0,0,0.02)"
            }}
          >
            <Typography variant="h6" sx={{ color: "text.primary", mb: 3, fontWeight: 700 }}>
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
