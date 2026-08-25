import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Chip, Divider, Alert, Link, Tooltip,
} from "@mui/material";
import { PersonSearchRounded, FileDownloadRounded, WarningAmberRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { formatDate, formatDateTime } from "@/utils/format";
import { SEMANTIC, NEUTRAL } from "@/styles/accents";
import { exportTableToExcel } from "@/utils/exportExcel";
import ErrorState from "@/components/ErrorState";
import { apiErrorText } from "@/utils/apiError";
import { ListSkeleton } from "@/components/TableRowsSkeleton";

interface Recipient {
  patientId: string;
  patientName: string;
  uhid: string;
  phone: string | null;
  email: string | null;
  quantity: number;
  dispensed: number;
  returned: number;
  lastReceivedAt: string;
  sources: string[];
}

interface Untraced {
  reason: string;
  quantity: number;
  events: number;
  lastAt: string | null;
}

interface TraceResponse {
  batch: { batchNumber: string; expiryDate: string; availableQuantity: number; medicineName: string };
  totals: { withPatients: number; untraced: number; onShelf: number; patients: number };
  recipients: Recipient[];
  untraced: Untraced[];
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 120, p: 1.5, borderRadius: 2, bgcolor: `${color}14`, border: "1px solid", borderColor: `${color}44` }}>
      <Typography variant="h5" sx={{ fontWeight: 800, color, lineHeight: 1.1 }}>{value}</Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{label}</Typography>
    </Box>
  );
}

/**
 * Who is holding medicine from this batch — the question a recall asks.
 *
 * The stock ledger records which batch every dispense drew from and against
 * which document, so this can be assembled from what already happened. Nothing
 * had ever asked it: a bad batch could be pulled off the shelf but not followed
 * to the people who already have it.
 *
 * Ordered by units still held, because that is the order a call list is worked.
 */
export default function BatchRecipientsDialog({
  inventoryId, open, onClose,
}: {
  inventoryId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading, isError, error, refetch } = useQuery<TraceResponse>({
    queryKey: ["batch-recipients", inventoryId],
    queryFn: async () => (await axiosInstance.get(`/pharmacy/inventory/${inventoryId}/recipients`)).data.data,
    enabled: open,
  });

  const exportList = () => {
    if (!data) return;
    exportTableToExcel(
      `recall_${data.batch.batchNumber}`,
      ["Patient", "UHID", "Phone", "Email", "Units held", "Dispensed", "Returned", "Last received", "Source"],
      data.recipients.map((r) => [
        r.patientName, r.uhid, r.phone ?? "", r.email ?? "",
        r.quantity, r.dispensed, r.returned,
        formatDateTime(r.lastReceivedAt), r.sources.join(", "),
      ]),
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <PersonSearchRounded sx={{ color: SEMANTIC.danger }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Who has this batch</Typography>
          {data && (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {data.batch.medicineName} · Batch {data.batch.batchNumber} · expires {formatDate(data.batch.expiryDate)}
            </Typography>
          )}
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {isError ? (
          <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <ListSkeleton rows={4} />
        ) : (
          <>
            <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, flexWrap: "wrap" }}>
              <Stat label="Still on the shelf" value={data.totals.onShelf} color={SEMANTIC.info} />
              <Stat label="Held by patients" value={data.totals.withPatients} color={SEMANTIC.danger} />
              <Stat label="Cannot be traced" value={data.totals.untraced} color={SEMANTIC.warning} />
            </Box>

            {/* Stated plainly. A call list that silently omits what it could not
                account for reads as complete when it is not. */}
            {data.totals.untraced > 0 && (
              <Alert severity="warning" icon={<WarningAmberRounded />} sx={{ mb: 2 }}>
                {data.totals.untraced} unit{data.totals.untraced === 1 ? "" : "s"} left the shelf without anyone
                attached. This list cannot be complete for that portion.
                {data.untraced.map((u) => (
                  <Typography key={u.reason} variant="caption" sx={{ display: "block", mt: 0.5 }}>
                    · {u.quantity} across {u.events} movement{u.events === 1 ? "" : "s"} — {u.reason.toLowerCase()}
                  </Typography>
                ))}
              </Alert>
            )}

            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 1 }}>
              PATIENTS TO CONTACT{data.recipients.length ? ` · ${data.recipients.length}` : ""}
            </Typography>

            {data.recipients.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary", py: 3, textAlign: "center" }}>
                No traceable patient received units from this batch.
              </Typography>
            ) : (
              <Box>
                {data.recipients.map((r) => (
                  <Box key={r.patientId}
                    sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.1, borderBottom: "1px solid", borderColor: "divider" }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{r.patientName}</Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
                        {r.uhid}
                        {r.phone ? " · " : ""}
                        {/* Tapping the number is the whole point of the screen. */}
                        {r.phone && <Link href={`tel:${r.phone}`} underline="hover" sx={{ fontWeight: 600 }}>{r.phone}</Link>}
                        {` · ${r.sources.join(", ")} · last ${formatDate(r.lastReceivedAt)}`}
                      </Typography>
                    </Box>
                    {r.returned > 0 && (
                      <Tooltip title={`${r.dispensed} dispensed, ${r.returned} already returned`}>
                        <Chip size="small" label={`${r.returned} back`}
                          sx={{ height: 20, fontWeight: 700, bgcolor: `${NEUTRAL.muted}22`, color: NEUTRAL.muted }} />
                      </Tooltip>
                    )}
                    <Typography variant="body2" sx={{ width: 92, textAlign: "right", fontWeight: 800, fontVariantNumeric: "tabular-nums",
                      color: r.quantity > 0 ? SEMANTIC.danger : "text.disabled" }}>
                      {r.quantity} unit{r.quantity === 1 ? "" : "s"}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            <Divider sx={{ mt: 2.5 }} />
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1.5 }}>
              Units a patient has already handed back are netted off, so nobody is chased for
              medicine they have returned.
            </Typography>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" sx={{ textTransform: "none" }}>Close</Button>
        <Button variant="outlined" startIcon={<FileDownloadRounded />} onClick={exportList}
          disabled={!data?.recipients.length} sx={{ textTransform: "none" }}>
          Export call list
        </Button>
      </DialogActions>
    </Dialog>
  );
}
