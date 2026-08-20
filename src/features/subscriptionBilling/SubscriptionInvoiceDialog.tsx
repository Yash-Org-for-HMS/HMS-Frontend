import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Table, TableBody, TableCell, TableHead, TableRow, Chip, Divider,
} from "@mui/material";
import { PrintRounded } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import ErrorState from "@/components/ErrorState";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { formatINR } from "@/utils/format";
import { SEMANTIC } from "@/styles/accents";

/**
 * One subscription invoice, and how it was actually paid.
 *
 * The list could only tell you that an invoice was marked Paid — by whom, by
 * what method, against which bank reference was recorded but never shown
 * anywhere. That makes "Paid" a claim rather than something anyone can check,
 * which is the whole point of a payment record.
 */
interface PaymentRow {
  subscriptionPaymentId: string;
  paidAt: string;
  amount: string;
  method: string;
  reference?: string | null;
  recordedByName?: string | null;
}
interface InvoiceDetail {
  subscriptionInvoiceId: string;
  invoiceNumber: string;
  planName?: string | null;
  billingCycle?: string | null;
  amount: string;
  paid?: number;
  status: string;
  issuedAt: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  notes?: string | null;
  hospital?: { hospitalName?: string | null } | null;
  payments?: PaymentRow[];
}

const d = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const dt = (v?: string | null) =>
  v ? new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const Meta = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Box sx={{ minWidth: 150 }}>
    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontWeight: 700, letterSpacing: 0.3 }}>{label}</Typography>
    <Typography variant="body2" sx={{ fontWeight: 600 }}>{value}</Typography>
  </Box>
);

export default function SubscriptionInvoiceDialog({
  invoiceId, open, onClose,
}: { invoiceId: string | null; open: boolean; onClose: () => void }) {
  const { data: inv, isLoading, isError, error } = useQuery<InvoiceDetail>({
    queryKey: ["subscription-invoice", invoiceId],
    enabled: open && !!invoiceId,
    queryFn: async () => (await axiosInstance.get(`/subscription-billing/invoices/${invoiceId}`)).data?.data,
  });

  const payments = inv?.payments ?? [];
  const balance = inv ? Number(inv.amount) - Number(inv.paid ?? 0) : 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {inv?.invoiceNumber ?? "Invoice"}
        {inv && (
          <Chip
            size="small"
            label={inv.status === "PAID" ? "Paid" : inv.status === "VOID" ? "Void" : "Unpaid"}
            color={inv.status === "PAID" ? "success" : inv.status === "VOID" ? "default" : "warning"}
            sx={{ ml: 1.5, fontWeight: 700 }}
          />
        )}
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}><HeartbeatLoader size={56} /></Box>
        ) : isError ? (
          <ErrorState message={getApiErrorMessage(error, "Couldn't load this invoice")} />
        ) : inv ? (
          <>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.5, mb: 2 }}>
              <Meta label="TENANT" value={inv.hospital?.hospitalName || "—"} />
              <Meta label="PLAN" value={`${inv.planName || "—"} · ${inv.billingCycle === "ANNUAL" ? "Annual" : "Monthly"}`} />
              <Meta label="PERIOD" value={`${d(inv.periodStart)} – ${d(inv.periodEnd)}`} />
              <Meta label="ISSUED" value={d(inv.issuedAt)} />
              <Meta label="DUE" value={d(inv.dueDate)} />
              <Meta label="AMOUNT" value={formatINR(Number(inv.amount))} />
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Payments received</Typography>
            {payments.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {inv.status === "VOID"
                  ? "This invoice was voided — nothing was collected against it."
                  : "Nothing has been received against this invoice yet."}
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Received</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Method</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Recorded by</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.subscriptionPaymentId}>
                      <TableCell>{dt(p.paidAt)}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell sx={{ color: p.reference ? "text.primary" : "text.disabled" }}>{p.reference || "—"}</TableCell>
                      <TableCell>{p.recordedByName || "—"}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{formatINR(Number(p.amount))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {balance > 0.005 && inv.status !== "VOID" && (
              <Typography variant="body2" sx={{ mt: 1.5, fontWeight: 700, color: SEMANTIC.warning }}>
                Balance due {formatINR(balance)}
              </Typography>
            )}
            {inv.notes && (
              <Typography variant="caption" sx={{ display: "block", mt: 2, color: "text.secondary" }}>{inv.notes}</Typography>
            )}
          </>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">Close</Button>
        <Button
          variant="outlined" startIcon={<PrintRounded />} disabled={!inv}
          onClick={() => window.open(`/subscription-billing/invoices/${invoiceId}/print`, "_blank")}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          Print invoice
        </Button>
      </DialogActions>
    </Dialog>
  );
}
