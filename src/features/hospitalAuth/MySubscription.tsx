import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Paper, Stack, Typography, Button, CircularProgress, Alert, AlertTitle,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from "@mui/material";
import { OpenInNewRounded } from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import SoftChip from "@/components/SoftChip";
import { formatINR } from "@/utils/format";
import { SEMANTIC, NEUTRAL, alpha } from "@/styles/accents";

/**
 * What this hospital owes, and how to pay it.
 *
 * Before this screen the billing system was visible only to the platform, so a
 * tenant's first signal that payment was due was a 403 at login — for an
 * invoice they had never been shown, of an amount they had never seen. The
 * money could move (Razorpay emails a link) but nobody could go and look.
 */

type Health = "NO_PLAN" | "CURRENT" | "DUE" | "OVERDUE" | "SUSPENDED";

interface Invoice {
  subscriptionInvoiceId: string;
  invoiceNumber: string;
  planName: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  paymentLinkUrl: string | null;
  isOverdue: boolean;
}
interface Subscription {
  plan: { name: string; price: number | null } | null;
  billingCycle: string;
  health: Health;
  outstanding: number;
  unpaidCount: number;
  suspendsOn: string | null;
  daysUntilSuspended: number | null;
  graceDays: number;
  invoices: Invoice[];
}

const money = (n: number) => formatINR(n, 0);
const day = (s: string) => new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const period = (a: string, b: string) =>
  `${new Date(a).toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${day(b)}`;

/** What the banner says, in the tenant's terms rather than the system's. */
function headline(d: Subscription): { severity: "success" | "info" | "warning" | "error"; title: string; body: string } | null {
  switch (d.health) {
    case "NO_PLAN":
      return { severity: "info", title: "No plan assigned", body: "Your provider has not put this hospital on a subscription plan, so nothing is being invoiced." };
    case "CURRENT":
      return null;
    case "DUE":
      return {
        severity: "info",
        title: `${money(d.outstanding)} due`,
        body: `${d.unpaidCount} invoice${d.unpaidCount === 1 ? "" : "s"} awaiting payment. Access continues as normal.`,
      };
    case "OVERDUE":
      return {
        severity: "warning",
        title: `${money(d.outstanding)} overdue`,
        body: d.daysUntilSuspended != null && d.daysUntilSuspended > 0
          ? `Access will be suspended in ${d.daysUntilSuspended} day${d.daysUntilSuspended === 1 ? "" : "s"} if this is not paid.`
          : "Access will be suspended shortly if this is not paid.",
      };
    case "SUSPENDED":
      return {
        severity: "error",
        title: "Access suspended",
        body: `${money(d.outstanding)} is outstanding. Paying it restores access for everyone at this hospital immediately.`,
      };
  }
}

export default function MySubscription() {
  const toast = useToast();
  const qc = useQueryClient();
  const [opening, setOpening] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<Subscription>({
    queryKey: ["my-subscription"],
    queryFn: async () => (await axiosInstance.get("/hospital/subscription")).data.data,
  });

  const pay = useMutation({
    mutationFn: async (id: string) =>
      (await axiosInstance.post(`/hospital/subscription/invoices/${id}/link`)).data,
    onSuccess: (res) => {
      const url = res?.data?.url;
      if (!url) { toast.error("No payment link came back. Contact your provider."); return; }
      // A new tab, not a redirect: losing the page you were on to a payment
      // provider is how people end up unsure whether they paid.
      window.open(url, "_blank", "noopener");
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not start the payment.")),
    onSettled: () => setOpening(null),
  });

  if (isLoading) {
    return <PageContainer><Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box></PageContainer>;
  }
  if (error || !data) {
    return <PageContainer><Alert severity="error">{getApiErrorMessage(error)}</Alert></PageContainer>;
  }

  const note = headline(data);

  return (
    <PageContainer>
      <PageHeader title="Subscription" subtitle="Your plan, invoices and payments" />

      {note && (
        <Alert severity={note.severity} sx={{ mb: 2.5 }}>
          <AlertTitle>{note.title}</AlertTitle>
          {note.body}
          {data.suspendsOn && data.health !== "SUSPENDED" && (
            <Typography variant="caption" sx={{ display: "block", mt: 0.5 }}>
              Suspension date: {day(data.suspendsOn)} ({data.graceDays} days after the due date).
            </Typography>
          )}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 2.5 }}>
        <Stack direction="row" spacing={4} flexWrap="wrap" useFlexGap>
          <Box>
            <Typography variant="caption" sx={{ color: NEUTRAL.muted, fontWeight: 700, display: "block" }}>PLAN</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: "1rem" }}>{data.plan?.name ?? "—"}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: NEUTRAL.muted, fontWeight: 700, display: "block" }}>BILLED</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: "1rem" }}>
              {data.billingCycle === "ANNUAL" ? "Annually" : "Monthly"}
              {data.plan?.price != null && (
                <Typography component="span" sx={{ color: NEUTRAL.muted, fontWeight: 500, ml: 0.75 }}>
                  · {money(data.plan.price)}
                </Typography>
              )}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: NEUTRAL.muted, fontWeight: 700, display: "block" }}>OUTSTANDING</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: "1rem", color: data.outstanding > 0 ? SEMANTIC.danger : SEMANTIC.success }}>
              {money(data.outstanding)}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper sx={{ p: 0, overflow: "hidden" }}>
        <Typography sx={{ fontWeight: 700, p: 2.5, pb: 1.5 }}>Invoices</Typography>
        {data.invoices.length === 0 ? (
          <Typography variant="body2" sx={{ color: NEUTRAL.muted, px: 2.5, pb: 2.5 }}>
            Nothing has been invoiced yet.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Invoice</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>Due</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">&nbsp;</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.invoices.map((inv) => {
                  const unpaid = inv.status === "UNPAID";
                  return (
                    <TableRow key={inv.subscriptionInvoiceId} hover>
                      <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{inv.invoiceNumber}</TableCell>
                      <TableCell sx={{ color: NEUTRAL.muted, whiteSpace: "nowrap" }}>
                        {period(inv.periodStart, inv.periodEnd)}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap", color: inv.isOverdue ? SEMANTIC.danger : "text.primary" }}>
                        {day(inv.dueDate)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                        {money(inv.amount)}
                      </TableCell>
                      <TableCell>
                        <SoftChip
                          label={inv.status === "PAID" ? "Paid" : inv.isOverdue ? "Overdue" : "Unpaid"}
                          color={inv.status === "PAID" ? SEMANTIC.success : inv.isOverdue ? SEMANTIC.danger : SEMANTIC.warning}
                          bg={alpha(inv.status === "PAID" ? SEMANTIC.success : inv.isOverdue ? SEMANTIC.danger : SEMANTIC.warning, 0.12)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {unpaid && (
                          <Button
                            size="small"
                            variant={inv.isOverdue ? "contained" : "outlined"}
                            endIcon={<OpenInNewRounded sx={{ fontSize: 16 }} />}
                            disabled={pay.isPending}
                            onClick={() => { setOpening(inv.subscriptionInvoiceId); pay.mutate(inv.subscriptionInvoiceId); }}
                          >
                            {opening === inv.subscriptionInvoiceId && pay.isPending ? "Opening…" : "Pay now"}
                          </Button>
                        )}
                        {inv.paidAt && (
                          <Typography variant="caption" sx={{ color: NEUTRAL.muted, whiteSpace: "nowrap" }}>
                            {day(inv.paidAt)}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Typography variant="caption" sx={{ color: NEUTRAL.muted, display: "block", mt: 2 }}>
        Payments are handled by Razorpay. If online payment is not switched on, pay by bank transfer
        and your provider will record it against the invoice.
      </Typography>
    </PageContainer>
  );
}
