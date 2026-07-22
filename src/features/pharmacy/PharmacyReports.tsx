import { useState } from "react";
import { ACCENTS, SEMANTIC } from "@/styles/accents";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Box, Typography, Paper, TextField, Button, ButtonGroup,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from "@mui/material";
import {
  ReceiptLongRounded, CurrencyRupeeRounded, TrendingUpRounded,
  WarningAmberRounded, EventBusyRounded, FileDownloadRounded, LocalPharmacyRounded,
} from "@mui/icons-material";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  BarChart, Bar, Legend,
} from "recharts";
import { axiosInstance } from "@/api/axios";
import { exportTableToExcel } from "@/utils/exportExcel";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import ReportSkeleton from "@/components/skeletons/ReportSkeleton";
import PageHeader from "@/components/layout/PageHeader";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { apiErrorText } from "@/utils/apiError";
import { formatINRAuto } from "@/utils/format";

const ACCENT = ACCENTS.pharmacy;
const inr = formatINRAuto;

const PRESETS = [
  { key: "today", label: "Today", from: () => dayjs(), to: () => dayjs() },
  { key: "7d", label: "7 days", from: () => dayjs().subtract(6, "day"), to: () => dayjs() },
  { key: "30d", label: "30 days", from: () => dayjs().subtract(29, "day"), to: () => dayjs() },
];

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${color}1a`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }} noWrap>{value}</Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>{label}</Typography>
      </Box>
    </Paper>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>{title}</Typography>
      {children}
    </Paper>
  );
}

function DataTable({ title, head, rows }: { title: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", px: 2.5, py: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
        <Box sx={{ flex: 1 }} />
        {rows.length > 0 && (
          <Button size="small" startIcon={<FileDownloadRounded fontSize="small" />} onClick={() => exportTableToExcel(title, head, rows)} sx={{ textTransform: "none", color: ACCENT }}>Excel</Button>
        )}
      </Box>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>No data in this range.</Typography>
      ) : (
        <TableContainer sx={{ maxHeight: 320 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>{head.map((h, i) => <TableCell key={h} align={i === 0 ? "left" : "right"} sx={{ fontWeight: 700, fontSize: "0.72rem", textTransform: "uppercase", color: "text.secondary", bgcolor: "background.paper" }}>{h}</TableCell>)}</TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, ri) => (
                <TableRow key={ri} hover>{r.map((c, ci) => <TableCell key={ci} align={ci === 0 ? "left" : "right"} sx={{ color: ci === 0 ? "text.primary" : "text.secondary", fontWeight: ci === 0 ? 600 : 500 }}>{c}</TableCell>)}</TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}

export default function PharmacyReports() {
  const [preset, setPreset] = useState("30d");
  const [from, setFrom] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));

  const applyPreset = (p: typeof PRESETS[number]) => {
    setPreset(p.key);
    setFrom(p.from().format("YYYY-MM-DD"));
    setTo(p.to().format("YYYY-MM-DD"));
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["pharmacy-reports", from, to],
    queryFn: async () => (await axiosInstance.get("/pharmacy/reports", { params: { from, to } })).data.data,
    placeholderData: keepPreviousData,
  });

  const s = data?.summary;
  const trend: any[] = data?.trend || [];
  const topMedicines: any[] = data?.topMedicines || [];
  const topIpdMedicines: any[] = data?.topIpdMedicines || [];
  const lowStock: any[] = data?.lowStock || [];
  const expiringSoon: any[] = data?.expiringSoon || [];
  const supplierWise: any[] = data?.supplierWise || [];

  return (
    <Box sx={{ p: { xs: 0, md: 1 } }}>
      <PageHeader
        title="Pharmacy Reports"
        subtitle="Dispensary sales over a date range, plus current stock health."
        actions={isFetching ? <HeartbeatLoader size={22} /> : undefined}
      />

      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2, display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
        <ButtonGroup size="small" variant="outlined">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              onClick={() => applyPreset(p)}
              variant={preset === p.key ? "contained" : "outlined"}
              sx={preset === p.key ? { bgcolor: ACCENT } : undefined}
            >
              {p.label}
            </Button>
          ))}
        </ButtonGroup>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => { setFrom(e.target.value); setPreset(""); }} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => { setTo(e.target.value); setPreset(""); }} />
        </Box>
      </Paper>

      {isLoading ? (
        <ReportSkeleton />
      ) : isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* KPIs */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(3,1fr)", md: "repeat(6,1fr)" }, gap: 1.5 }}>
            <Kpi icon={<ReceiptLongRounded />} label="Orders dispensed" value={s?.totalOrders || 0} color={ACCENTS.pharmacy} />
            <Kpi icon={<CurrencyRupeeRounded />} label="Total sales" value={inr(s?.totalSales)} color={SEMANTIC.success} />
            <Kpi icon={<TrendingUpRounded />} label="Avg order value" value={inr(s?.avgOrderValue)} color={SEMANTIC.info} />
            <Kpi icon={<LocalPharmacyRounded />} label="IPD meds issued" value={inr(s?.ipdMedicationValue)} color="#8b5cf6" />
            <Kpi icon={<WarningAmberRounded />} label="Low stock items" value={s?.lowStockCount || 0} color={SEMANTIC.warning} />
            <Kpi icon={<EventBusyRounded />} label="Expiring in 30 days" value={s?.expiringSoonCount || 0} color={SEMANTIC.danger} />
          </Box>

          {/* Trend */}
          <Panel title="Sales over time">
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pharmTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ACCENT} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => dayjs(d).format("DD MMM")} minTickGap={24} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <RTooltip labelFormatter={(d) => dayjs(d as string).format("DD MMM YYYY")} formatter={(v: any, name: any) => (name === "Sales (₹)" ? inr(v) : v)} />
                  <Area type="monotone" dataKey="sales" name="Sales (₹)" stroke={ACCENT} strokeWidth={2} fill="url(#pharmTrend)" />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Panel>

          {/* Top medicines */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.6fr 1fr" }, gap: 2 }}>
            <Panel title="Top-selling medicines">
              {topMedicines.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>No sales in this range.</Typography>
              ) : (
                <Box sx={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topMedicines} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="medicineName" width={160} tick={{ fontSize: 11 }} tickFormatter={(v) => (v.length > 24 ? v.slice(0, 23) + "…" : v)} />
                      <RTooltip formatter={(v: any, name: any) => (name === "Revenue" ? inr(v) : v)} />
                      <Legend />
                      <Bar dataKey="qty" name="Units sold" fill={SEMANTIC.info} radius={[0, 4, 4, 0]} barSize={14} />
                      <Bar dataKey="revenue" name="Revenue" fill={ACCENT} radius={[0, 4, 4, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Panel>

            <DataTable title="Top-selling medicines" head={["Medicine", "Units sold", "Revenue"]} rows={topMedicines.map((m) => [m.medicineName, m.qty, inr(m.revenue)])} />
          </Box>

          {/* IPD medication issues — confirmed via the ward-request queue, billed at discharge (not a Dispensary sale) */}
          <DataTable title="IPD medication issues (confirmed, this range)" head={["Medicine", "Units issued", "Value"]} rows={topIpdMedicines.map((m) => [m.medicineName, m.qty, inr(m.revenue)])} />

          {/* Stock health */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
            <DataTable title="Low stock (current)" head={["Medicine", "Available", "Reorder level"]} rows={lowStock.map((r) => [r.medicineName, r.availableQuantity, r.reorderLevel])} />
            <DataTable title="Expiring within 30 days" head={["Medicine", "Batch", "Qty", "Expiry"]} rows={expiringSoon.map((r) => [r.medicineName, r.batchNumber, r.availableQuantity, dayjs(r.expiryDate).format("DD MMM YYYY")])} />
          </Box>

          {/* Supplier-wise purchasing */}
          <DataTable title="Supplier-wise purchasing (this range)" head={["Supplier", "Purchase orders", "Total value"]} rows={supplierWise.map((r) => [r.supplierName, r.poCount, inr(r.totalPurchaseValue)])} />
        </Box>
      )}
    </Box>
  );
}
