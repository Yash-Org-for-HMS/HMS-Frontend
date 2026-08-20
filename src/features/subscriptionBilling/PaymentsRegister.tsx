import { useState } from "react";
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, TextField, MenuItem, Chip, Stack,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { formatINR } from "@/utils/format";
import { SEMANTIC, BRAND } from "@/styles/accents";

/**
 * Every subscription payment taken in a period, across all tenants.
 *
 * This is the list you reconcile against a bank statement, which is why it is
 * one row per PAYMENT rather than per invoice: an invoice tells you what was
 * billed, not what arrived on a given day, and a voided invoice contributes
 * nothing at all. Each row carries the method and the bank/UPI reference,
 * because those are what a statement line can actually be matched to.
 */
interface PaymentRow {
  subscriptionPaymentId: string;
  paidAt: string;
  amount: string;
  method: string;
  reference?: string | null;
  recordedByName?: string | null;
  hospitalName: string;
  invoiceNumber: string;
  planName?: string | null;
  invoiceStatus?: string | null;
}

interface RegisterData {
  rows: PaymentRow[];
  totals: { count: number; amount: string; byMethod: { method: string; count: number; amount: string }[] };
}

const METHODS = ["", "Cash", "Bank Transfer", "UPI", "Card", "Other"];

const dt = (d: string) =>
  new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Default window: this month to date — the period a reconciliation usually covers. */
const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthStart = () => { const d = new Date(); d.setDate(1); return iso(d); };

export default function PaymentsRegister() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(iso(new Date()));
  const [method, setMethod] = useState("");

  const { data, isLoading, isError, error } = useQuery<RegisterData>({
    queryKey: ["subscription-payments", from, to, method],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      if (method) qs.set("method", method);
      return (await axiosInstance.get(`/subscription-billing/payments?${qs.toString()}`)).data?.data;
    },
  });

  const rows = data?.rows ?? [];

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }} alignItems={{ sm: "center" }}>
        <TextField
          type="date" label="From" size="small" value={from}
          onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }}
        />
        <TextField
          type="date" label="To" size="small" value={to}
          onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }}
        />
        <TextField
          select label="Method" size="small" value={method}
          onChange={(e) => setMethod(e.target.value)} sx={{ minWidth: 160 }}
        >
          {METHODS.map((m) => (
            <MenuItem key={m || "all"} value={m}>{m || "All methods"}</MenuItem>
          ))}
        </TextField>
      </Stack>

      {isError ? (
        <ErrorState message={getApiErrorMessage(error, "Failed to load payments")} />
      ) : (
        <>
          {!isLoading && rows.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
              <Box>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 0.4 }}>PAYMENTS</Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>{data?.totals.count}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, letterSpacing: 0.4 }}>TOTAL RECEIVED</Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: SEMANTIC.success }}>{formatINR(Number(data?.totals.amount ?? 0))}</Typography>
              </Box>
              {/* The split a bank statement is reconciled by — cash never appears on
                  one, so separating it from transfers is the first thing you need. */}
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {(data?.totals.byMethod ?? []).map((m) => (
                  <Chip
                    key={m.method} size="small"
                    label={`${m.method}: ${formatINR(Number(m.amount))} (${m.count})`}
                    sx={{ bgcolor: `${BRAND.action}14`, color: BRAND.actionDark, fontWeight: 600 }}
                  />
                ))}
              </Box>
            </Paper>
          )}

          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Received</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Tenant</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Invoice</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Method</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Recorded by</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRowsSkeleton rows={5} columns={7} />
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ border: 0, py: 5 }}>
                      <Mascot
                        pose="nothing-here-yet"
                        title="No payments in this period"
                        subtitle="Nothing was received between these dates."
                        size={120}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.subscriptionPaymentId} hover>
                      <TableCell><Typography variant="body2">{dt(r.paidAt)}</Typography></TableCell>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{r.hospitalName}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="body2">{r.invoiceNumber}</Typography>
                        {/* A payment against a voided invoice still happened — flag the
                            pair rather than let it look like an ordinary receipt. */}
                        {r.invoiceStatus === "VOID" && (
                          <Chip size="small" label="Invoice voided" color="warning" sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }} />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>{formatINR(Number(r.amount))}</Typography>
                      </TableCell>
                      <TableCell><Typography variant="body2">{r.method}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: r.reference ? "text.primary" : "text.disabled" }}>
                          {r.reference || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell><Typography variant="body2">{r.recordedByName || "—"}</Typography></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
