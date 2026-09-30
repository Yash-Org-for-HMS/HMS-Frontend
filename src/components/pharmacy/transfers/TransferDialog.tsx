import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { ArrowForwardRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import { formatDate, formatDateTime } from "@/utils/format";
import { SEMANTIC } from "@/styles/accents";
import ErrorState from "@/components/ErrorState";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { TRANSFER_STATUS, type TransferDetail, type TransferItem } from "./transfers.types";

const HEAD = { fontWeight: 700, color: "text.secondary", whiteSpace: "nowrap" } as const;
const NUM = { fontVariantNumeric: "tabular-nums" } as const;

/** Soonest expiry first, up to what was asked for — the order stock should leave in. */
function firstExpiryFirst(item: TransferItem): Record<string, string> {
  let left = item.requestedQuantity;
  const out: Record<string, string> = {};
  for (const b of item.available) {
    const take = Math.min(left, b.availableQuantity);
    out[b.inventoryId] = take > 0 ? String(take) : "";
    left -= take;
  }
  return out;
}

const n = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : 0);

/**
 * One transfer: read it, and — for whichever end the user is at — act on it.
 * The sending branch picks the batches and dispatches; the receiving branch
 * says how many of each arrived. Either can call off one that has not left;
 * only the sender can call back one on the road.
 */
export default function TransferDialog({ stockTransferId, shortReasons, onClose, onChanged }: {
  stockTransferId: string;
  shortReasons: string[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data: t, isLoading, isError, error, refetch } = useQuery<TransferDetail>({
    queryKey: ["stock-transfer", stockTransferId],
    queryFn: async () => (await axiosInstance.get(`/pharmacy/stock-transfers/${stockTransferId}`)).data.data,
  });
  // What the user typed, over the prefilled numbers: the soonest-expiring
  // batches for a dispatch, "everything arrived" for a receipt.
  const [sendEdits, setSend] = useState<Record<string, string>>({});
  const [arrivedEdits, setArrived] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [otherReason, setOtherReason] = useState<Record<string, string>>({});
  const [cancelling, setCancelling] = useState(false);
  const [cancelWhy, setCancelWhy] = useState("");
  const [busy, setBusy] = useState(false);

  const send = useMemo<Record<string, string>>(
    () => ({ ...(t?.canDispatch ? Object.assign({}, ...t.items.map(firstExpiryFirst)) : {}), ...sendEdits }),
    [t, sendEdits],
  );
  const arrived = useMemo<Record<string, string>>(
    () => ({
      ...(t?.canReceive ? Object.fromEntries(t.items.flatMap((i) => i.batches.map((b) => [b.stockTransferBatchId, String(b.quantitySent)]))) : {}),
      ...arrivedEdits,
    }),
    [t, arrivedEdits],
  );

  const picking = useMemo(() => (t?.items ?? []).map((i) => i.available.reduce((s, b) => s + n(send[b.inventoryId]), 0)), [t, send]);
  const totalPicked = picking.reduce((a, b) => a + b, 0);

  // Every action answers with the transfer as it now stands: shown at once, so
  // the form just submitted is never left on screen looking unsent.
  const done = (msg: string, next: TransferDetail) => {
    qc.setQueryData(["stock-transfer", stockTransferId], next);
    toast.success(msg);
    onChanged();
  };

  const dispatch = async () => {
    if (!t) return;
    const over = t.items.findIndex((i, k) => picking[k] > i.requestedQuantity);
    if (over >= 0) { toast.error(`${t.items[over].medicineName}: more picked than was asked for.`); return; }
    const lines = t.items.flatMap((i) => i.available.map((b) => ({ inventoryId: b.inventoryId, quantity: n(send[b.inventoryId]) }))).filter((l) => l.quantity > 0);
    if (!lines.length) { toast.error("Pick at least one unit to send."); return; }
    setBusy(true);
    try {
      const r = await axiosInstance.post(`/pharmacy/stock-transfers/${t.stockTransferId}/dispatch`, { lines });
      done(`Dispatched ${totalPicked} units to ${t.toBranchName}`, r.data.data);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Couldn't dispatch the transfer"));
    } finally { setBusy(false); }
  };

  const receive = async () => {
    if (!t) return;
    const batches = t.items.flatMap((i) => i.batches);
    const lines = batches.map((b) => {
      const got = n(arrived[b.stockTransferBatchId]);
      const why = reason[b.stockTransferBatchId] === "Other" ? (otherReason[b.stockTransferBatchId] ?? "").trim() : reason[b.stockTransferBatchId] ?? "";
      return { stockTransferBatchId: b.stockTransferBatchId, quantityReceived: got, shortReason: got < b.quantitySent ? why : null, b };
    });
    const bad = lines.find((l) => l.quantityReceived > l.b.quantitySent);
    if (bad) { toast.error(`Batch ${bad.b.batchNumber}: no more than ${bad.b.quantitySent} can arrive.`); return; }
    const noWhy = lines.find((l) => l.quantityReceived < l.b.quantitySent && (l.shortReason ?? "").length < 3);
    if (noWhy) { toast.error(`Batch ${noWhy.b.batchNumber} is short — say why.`); return; }
    setBusy(true);
    try {
      const r = await axiosInstance.post(`/pharmacy/stock-transfers/${t.stockTransferId}/receive`, {
        lines: lines.map(({ stockTransferBatchId, quantityReceived, shortReason }) => ({ stockTransferBatchId, quantityReceived, shortReason })),
      });
      done("Received — the stock is on your shelf", r.data.data);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Couldn't receive the transfer"));
    } finally { setBusy(false); }
  };

  const cancel = async () => {
    if (!t) return;
    if (cancelWhy.trim().length < 3) { toast.error("Say why the transfer is being cancelled."); return; }
    setBusy(true);
    try {
      const r = await axiosInstance.post(`/pharmacy/stock-transfers/${t.stockTransferId}/cancel`, { reason: cancelWhy.trim() });
      setCancelling(false);
      done(t.status === "DISPATCHED" ? "Called back — the stock is back on your shelf" : "Transfer cancelled", r.data.data);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Couldn't cancel the transfer"));
    } finally { setBusy(false); }
  };

  const st = t ? TRANSFER_STATUS[t.status] : null;

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        {t ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Box component="span" sx={{ fontFamily: "monospace", fontWeight: 800 }}>{t.transferNumber}</Box>
            {st && <Chip size="small" label={st.label} sx={{ height: 22, fontWeight: 700, bgcolor: `${st.color}22`, color: st.color }} />}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "text.secondary", fontSize: "0.95rem", fontWeight: 600 }}>
              {t.fromBranchName} <ArrowForwardRounded sx={{ fontSize: 18 }} /> {t.toBranchName}
            </Box>
          </Box>
        ) : "Transfer"}
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 6 }}><HeartbeatLoader size={48} /></Box>
        ) : isError || !t ? (
          <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {t.gstNote && <Alert severity="warning">{t.gstNote}</Alert>}

            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Asked for {formatDateTime(t.createdAt)}{t.requestedBy ? ` by ${t.requestedBy}` : ""}
              {t.dispatchedAt && <> · dispatched {formatDateTime(t.dispatchedAt)}{t.dispatchedBy ? ` by ${t.dispatchedBy}` : ""}</>}
              {t.receivedAt && <> · received {formatDateTime(t.receivedAt)}{t.receivedBy ? ` by ${t.receivedBy}` : ""}</>}
              {t.cancelledAt && <> · cancelled {formatDateTime(t.cancelledAt)}{t.cancelledBy ? ` by ${t.cancelledBy}` : ""}{t.cancelReason ? ` — ${t.cancelReason}` : ""}</>}
            </Typography>
            {t.notes && <Typography variant="body2">Note: {t.notes}</Typography>}

            {t.canDispatch && (
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Pick the batches to send. They are filled soonest-expiry first; change any number to match what goes in the box.
              </Typography>
            )}
            {t.canReceive && (
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Count what arrived. Anything short needs a reason; the rest goes onto your shelf as the same batch and expiry.
              </Typography>
            )}

            {t.items.map((item, k) => (
              <Box key={item.stockTransferItemId} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
                <Box sx={{ px: 2, py: 1.25, display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap", bgcolor: "action.hover" }}>
                  <Typography sx={{ fontWeight: 700 }}>{item.medicineName}</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary", ...NUM }}>
                    Asked for {item.requestedQuantity}
                    {t.status !== "REQUESTED" && ` · sent ${item.sentQuantity}`}
                    {item.receivedQuantity !== null && ` · arrived ${item.receivedQuantity}`}
                    {item.onHandAtReceiver !== null && t.status !== "RECEIVED" && ` · ${t.toBranchName} holds ${item.onHandAtReceiver}`}
                  </Typography>
                </Box>

                {t.canDispatch ? (
                  item.available.length === 0 ? (
                    <Typography variant="body2" sx={{ px: 2, py: 1.5, color: SEMANTIC.danger }}>
                      Nothing in date on {t.fromBranchName}'s shelf for this medicine.
                    </Typography>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead><TableRow>
                          <TableCell sx={HEAD}>Batch</TableCell><TableCell sx={HEAD}>Expiry</TableCell>
                          <TableCell sx={HEAD} align="right">On the shelf</TableCell><TableCell sx={HEAD} align="right">Send</TableCell>
                        </TableRow></TableHead>
                        <TableBody>
                          {item.available.map((b) => (
                            <TableRow key={b.inventoryId}>
                              <TableCell sx={{ fontFamily: "monospace" }}>{b.batchNumber}</TableCell>
                              <TableCell>{formatDate(b.expiryDate)}</TableCell>
                              <TableCell align="right" sx={NUM}>{b.availableQuantity}</TableCell>
                              <TableCell align="right">
                                <TextField
                                  id={`send-${b.inventoryId}`} size="small" value={send[b.inventoryId] ?? ""}
                                  onChange={(e) => setSend((s) => ({ ...s, [b.inventoryId]: e.target.value.replace(/\D/g, "") }))}
                                  error={n(send[b.inventoryId]) > b.availableQuantity}
                                  inputProps={{ inputMode: "numeric", style: { textAlign: "right" }, "aria-label": `Send from batch ${b.batchNumber}` }}
                                  sx={{ width: 90 }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={3} align="right" sx={{ color: picking[k] > item.requestedQuantity ? SEMANTIC.danger : "text.secondary", fontWeight: 600, border: 0 }}>
                              Picking {picking[k]} of {item.requestedQuantity}
                            </TableCell>
                            <TableCell sx={{ border: 0 }} />
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )
                ) : item.batches.length > 0 ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead><TableRow>
                        <TableCell sx={HEAD}>Batch</TableCell><TableCell sx={HEAD}>Expiry</TableCell>
                        <TableCell sx={HEAD} align="right">Sent</TableCell><TableCell sx={HEAD} align="right">Arrived</TableCell>
                        {(t.canReceive || t.status === "RECEIVED") && <TableCell sx={HEAD}>{t.canReceive ? "If short, why" : "Short"}</TableCell>}
                      </TableRow></TableHead>
                      <TableBody>
                        {item.batches.map((b) => {
                          const got = n(arrived[b.stockTransferBatchId]);
                          const short = t.canReceive && got < b.quantitySent;
                          return (
                            <TableRow key={b.stockTransferBatchId}>
                              <TableCell sx={{ fontFamily: "monospace" }}>{b.batchNumber}</TableCell>
                              <TableCell>{formatDate(b.expiryDate)}</TableCell>
                              <TableCell align="right" sx={NUM}>{b.quantitySent}</TableCell>
                              <TableCell align="right" sx={NUM}>
                                {t.canReceive ? (
                                  <TextField
                                    id={`arrived-${b.stockTransferBatchId}`} size="small" value={arrived[b.stockTransferBatchId] ?? ""}
                                    onChange={(e) => setArrived((s) => ({ ...s, [b.stockTransferBatchId]: e.target.value.replace(/\D/g, "") }))}
                                    error={got > b.quantitySent}
                                    inputProps={{ inputMode: "numeric", style: { textAlign: "right" }, "aria-label": `Arrived of batch ${b.batchNumber}` }}
                                    sx={{ width: 90 }}
                                  />
                                ) : b.quantityReceived ?? "—"}
                              </TableCell>
                              {t.canReceive ? (
                                <TableCell sx={{ minWidth: 220 }}>
                                  {short && (
                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                      <TextField
                                        id={`short-${b.stockTransferBatchId}`} select size="small" label={`${b.quantitySent - got} short`}
                                        value={reason[b.stockTransferBatchId] ?? ""}
                                        onChange={(e) => setReason((s) => ({ ...s, [b.stockTransferBatchId]: e.target.value }))}
                                      >
                                        {shortReasons.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                                      </TextField>
                                      {reason[b.stockTransferBatchId] === "Other" && (
                                        <TextField
                                          id={`short-other-${b.stockTransferBatchId}`} size="small" placeholder="What happened"
                                          value={otherReason[b.stockTransferBatchId] ?? ""}
                                          onChange={(e) => setOtherReason((s) => ({ ...s, [b.stockTransferBatchId]: e.target.value }))}
                                        />
                                      )}
                                    </Box>
                                  )}
                                </TableCell>
                              ) : t.status === "RECEIVED" ? (
                                <TableCell sx={{ color: (b.quantityReceived ?? 0) < b.quantitySent ? SEMANTIC.danger : "text.secondary" }}>
                                  {(b.quantityReceived ?? 0) < b.quantitySent ? `${b.quantitySent - (b.quantityReceived ?? 0)} — ${b.shortReason ?? ""}` : "—"}
                                </TableCell>
                              ) : null}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : null}
              </Box>
            ))}

            {cancelling && (
              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
                <TextField
                  id="transfer-cancel-reason" size="small" autoFocus sx={{ flex: 1, minWidth: 240 }}
                  label={t.status === "DISPATCHED" ? "Why is it being called back?" : "Why is it being cancelled?"}
                  helperText={t.status === "DISPATCHED" ? "The stock goes back onto the batches it left. Do this once the box is back on your shelf." : " "}
                  value={cancelWhy} onChange={(e) => setCancelWhy(e.target.value)}
                />
                <Button color="error" variant="outlined" onClick={cancel} disabled={busy}>
                  {t.status === "DISPATCHED" ? "Call back" : "Cancel transfer"}
                </Button>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between" }}>
        <Box>
          {t?.canCancel && !cancelling && (
            <Button color="error" onClick={() => setCancelling(true)} disabled={busy}>
              {t.status === "DISPATCHED" ? "Call back…" : "Cancel transfer…"}
            </Button>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={onClose} disabled={busy}>Close</Button>
          {t?.canDispatch && (
            <Button variant="contained" onClick={dispatch} disabled={busy || totalPicked === 0}>
              {busy ? "Dispatching…" : `Dispatch ${totalPicked} units`}
            </Button>
          )}
          {t?.canReceive && (
            <Button variant="contained" onClick={receive} disabled={busy}>{busy ? "Receiving…" : "Receive"}</Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
