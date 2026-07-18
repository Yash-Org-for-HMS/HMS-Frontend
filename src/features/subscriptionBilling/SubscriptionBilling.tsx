import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Grid, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Button, TextField, MenuItem, Pagination, Dialog, DialogTitle, DialogContent,
  DialogActions, Tooltip, IconButton,
} from "@mui/material";
import {
  AutorenewRounded, PaymentsRounded, BlockRounded, TrendingUpRounded,
  AccountBalanceWalletRounded, PendingActionsRounded, WarningAmberRounded, PrintRounded, SettingsRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { formatINR, formatDate } from "@/utils/format";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import ActionButton from "@/components/layout/ActionButton";
import StatCard from "@/components/StatCard";
import ErrorState from "@/components/ErrorState";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";

const PAY_METHODS = ["Cash", "Bank Transfer", "UPI", "Card", "Cheque", "Other"];
const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "overdue", label: "Overdue" },
  { value: "PAID", label: "Paid" },
  { value: "VOID", label: "Void" },
];

const PHASE_COLOR: Record<string, "default" | "success" | "warning" | "error" | "secondary"> = {
  PAID: "success", PENDING: "default", OVERDUE: "warning", SUSPENDED: "error", VOID: "secondary",
};
const PHASE_LABEL: Record<string, string> = {
  PAID: "Paid", PENDING: "Pending", OVERDUE: "Overdue", SUSPENDED: "Suspended", VOID: "Void",
};

const headSx = { color: "text.secondary", fontWeight: 600, fontSize: "0.875rem", bgcolor: "background.paper" } as const;

export default function SubscriptionBilling() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [payTarget, setPayTarget] = useState<any | null>(null);
  const [payMethod, setPayMethod] = useState("Cash");
  const [payReference, setPayReference] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});

  const params: Record<string, unknown> = { page, limit: 20 };
  if (statusFilter === "overdue") params.overdue = true;
  else if (statusFilter) params.status = statusFilter;

  const { data: metrics } = useQuery({
    queryKey: ["subscription-metrics"],
    queryFn: async () => (await axiosInstance.get("/subscription-billing/metrics")).data.data,
  });

  const { data: resp, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["subscription-invoices", statusFilter, page],
    queryFn: async () => (await axiosInstance.get("/subscription-billing/invoices", { params })).data,
  });
  const invoices: any[] = resp?.data || [];
  const pagination = resp?.pagination as { totalPages: number } | undefined;

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["subscription-invoices"] });
    qc.invalidateQueries({ queryKey: ["subscription-metrics"] });
  };

  const generateMutation = useMutation({
    mutationFn: () => axiosInstance.post("/subscription-billing/generate"),
    onSuccess: (r) => {
      const d = r.data.data;
      toast.success(d.generated > 0 ? `Generated ${d.generated} invoice(s) for ${d.hospitals} hospital(s).` : "No new invoices were due.");
      refreshAll();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to generate invoices")),
  });

  const payMutation = useMutation({
    mutationFn: (vars: { id: string; method: string; reference: string }) =>
      axiosInstance.post(`/subscription-billing/invoices/${vars.id}/pay`, { method: vars.method, reference: vars.reference || undefined }),
    onSuccess: () => {
      toast.success("Payment recorded");
      setPayTarget(null);
      setPayReference("");
      refreshAll();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to record payment")),
  });

  const voidMutation = useMutation({
    mutationFn: (id: string) => axiosInstance.post(`/subscription-billing/invoices/${id}/void`),
    onSuccess: () => { toast.success("Invoice voided"); refreshAll(); },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to void invoice")),
  });

  const openSettings = async () => {
    setSettingsOpen(true);
    try {
      const s = (await axiosInstance.get("/subscription-billing/settings")).data.data || {};
      setSettingsForm({
        companyName: s.companyName || "", addressLine1: s.addressLine1 || "", addressLine2: s.addressLine2 || "",
        postalCode: s.postalCode || "", email: s.email || "", phone: s.phone || "", gstNumber: s.gstNumber || "",
      });
    } catch { /* dialog still opens with blanks */ }
  };
  const settingsMutation = useMutation({
    mutationFn: () => axiosInstance.put("/subscription-billing/settings", settingsForm),
    onSuccess: () => { toast.success("Billing identity saved"); setSettingsOpen(false); },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to save settings")),
  });

  const handleVoid = async (inv: any) => {
    const yes = await confirm({ title: "Void invoice", message: `Void ${inv.invoiceNumber}? This cannot be undone.`, confirmText: "Void", destructive: true });
    if (yes) voidMutation.mutate(inv.subscriptionInvoiceId);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Subscription Billing"
        subtitle="Bill tenants for their plans, record payments, and track platform revenue."
        actions={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Tooltip title="Billing identity (seller info on invoices)">
              <IconButton onClick={openSettings} sx={{ color: "text.secondary" }}><SettingsRounded /></IconButton>
            </Tooltip>
            <ActionButton
              accentFrom="#6366f1"
              accentTo="#4f46e5"
              startIcon={<AutorenewRounded />}
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? "Generating…" : "Generate Due Invoices"}
            </ActionButton>
          </Box>
        }
      />

      {/* Metrics */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="MRR" value={metrics ? formatINR(metrics.mrr) : "—"} icon={<TrendingUpRounded sx={{ fontSize: 30, color: "#6366f1" }} />} color="#6366f1" sub={metrics ? `${formatINR(metrics.arr)} ARR` : undefined} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Collected" value={metrics ? formatINR(metrics.collected) : "—"} icon={<AccountBalanceWalletRounded sx={{ fontSize: 30, color: "#10b981" }} />} color="#10b981" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Outstanding" value={metrics ? formatINR(metrics.outstanding) : "—"} icon={<PendingActionsRounded sx={{ fontSize: 30, color: "#f59e0b" }} />} color="#f59e0b" sub={metrics ? `${metrics.unpaidCount} unpaid` : undefined} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard label="Overdue" value={metrics ? metrics.overdueCount : "—"} icon={<WarningAmberRounded sx={{ fontSize: 30, color: "#ef4444" }} />} color="#ef4444" />
        </Grid>
      </Grid>

      {/* Filter */}
      <Box sx={{ mb: 2 }}>
        <TextField
          select size="small" label="Status" value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          sx={{ minWidth: 180 }}
        >
          {STATUS_FILTERS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
        </TextField>
      </Box>

      <Paper elevation={2} sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>
        <TableContainer sx={{ maxHeight: "calc(100vh - 420px)" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow sx={{ bgcolor: "background.paper" }}>
                <TableCell sx={headSx}>Invoice #</TableCell>
                <TableCell sx={headSx}>Hospital</TableCell>
                <TableCell sx={headSx}>Plan</TableCell>
                <TableCell sx={headSx}>Period</TableCell>
                <TableCell sx={headSx} align="right">Amount</TableCell>
                <TableCell sx={headSx}>Status</TableCell>
                <TableCell sx={headSx}>Due</TableCell>
                <TableCell sx={headSx} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={6} columns={8} />
              ) : isError ? (
                <TableRow><TableCell colSpan={8} sx={{ py: 4, border: 0 }}><ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /></TableCell></TableRow>
              ) : invoices.length === 0 ? (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 8, color: "text.secondary" }}>No subscription invoices yet. Click “Generate Due Invoices” to bill the current period.</TableCell></TableRow>
              ) : (
                invoices.map((inv) => (
                  <TableRow key={inv.subscriptionInvoiceId} hover>
                    <TableCell sx={{ fontFamily: "monospace", fontWeight: 600 }}>{inv.invoiceNumber}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{inv.hospitalName}</TableCell>
                    <TableCell>{inv.planName} <Chip label={inv.billingCycle === "ANNUAL" ? "Yr" : "Mo"} size="small" sx={{ ml: 0.5, height: 18, fontSize: "0.65rem" }} /></TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: "0.8rem" }}>{formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{formatINR(inv.amount)}</TableCell>
                    <TableCell><Chip label={PHASE_LABEL[inv.phase] || inv.status} color={PHASE_COLOR[inv.phase] || "default"} size="small" /></TableCell>
                    <TableCell sx={{ color: "text.secondary", fontSize: "0.8rem" }}>{formatDate(inv.dueDate)}</TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end", alignItems: "center" }}>
                        <Tooltip title="Print / download invoice">
                          <IconButton size="small" onClick={() => window.open(`/subscription-billing/invoices/${inv.subscriptionInvoiceId}/print`, "_blank")}><PrintRounded fontSize="small" /></IconButton>
                        </Tooltip>
                        {inv.status === "UNPAID" ? (
                          <>
                            <Button size="small" variant="contained" startIcon={<PaymentsRounded />} onClick={() => { setPayTarget(inv); setPayMethod("Cash"); setPayReference(""); }} sx={{ bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" } }}>
                              Pay
                            </Button>
                            <Tooltip title="Void">
                              <IconButton size="small" color="error" onClick={() => handleVoid(inv)}><BlockRounded fontSize="small" /></IconButton>
                            </Tooltip>
                          </>
                        ) : (
                          <Chip label={inv.status === "PAID" ? "Paid" : "Void"} size="small" variant="outlined" color={inv.status === "PAID" ? "success" : "default"} />
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {pagination && pagination.totalPages > 1 && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
            <Pagination count={pagination.totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" shape="rounded" size="small" />
          </Box>
        )}
      </Paper>

      {/* Record payment dialog */}
      <Dialog open={!!payTarget} onClose={() => setPayTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent dividers>
          {payTarget && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                <span>{payTarget.hospitalName}</span><strong>{formatINR(payTarget.amount)}</strong>
              </Box>
              <Box sx={{ color: "text.secondary", fontSize: "0.8rem", fontFamily: "monospace" }}>{payTarget.invoiceNumber}</Box>
            </Box>
          )}
          <TextField select fullWidth size="small" label="Method" value={payMethod} onChange={(e) => setPayMethod(e.target.value)} sx={{ mb: 2 }}>
            {PAY_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
          <TextField fullWidth size="small" label="Reference (optional)" value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="Txn / cheque no." />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPayTarget(null)} color="inherit">Cancel</Button>
          <Button
            variant="contained"
            disabled={payMutation.isPending}
            onClick={() => payTarget && payMutation.mutate({ id: payTarget.subscriptionInvoiceId, method: payMethod, reference: payReference })}
            sx={{ bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" } }}
          >
            {payMutation.isPending ? "Recording…" : `Record ${payTarget ? formatINR(payTarget.amount) : ""}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Billing identity (seller info on invoices) */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Billing identity</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ color: "text.secondary", fontSize: "0.875rem", mb: 2 }}>
            Your company's details — printed as the seller at the top of every subscription invoice.
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            {([
              ["companyName", "Company name", true],
              ["addressLine1", "Address line 1", true],
              ["addressLine2", "Address line 2", true],
              ["postalCode", "Postal code", false],
              ["gstNumber", "GST number", false],
              ["email", "Email", false],
              ["phone", "Phone", false],
            ] as [string, string, boolean][]).map(([key, label, full]) => (
              <TextField
                key={key}
                size="small"
                label={label}
                sx={full ? { gridColumn: "1 / -1" } : undefined}
                value={settingsForm[key] || ""}
                onChange={(e) => setSettingsForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSettingsOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" disabled={settingsMutation.isPending} onClick={() => settingsMutation.mutate()}>
            {settingsMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
