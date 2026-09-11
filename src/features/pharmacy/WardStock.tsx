import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Tabs, Tab, Button, IconButton, Chip, Divider, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Tooltip, FormControlLabel, Switch, InputAdornment, CircularProgress,
} from "@mui/material";
import {
  AddRounded, SearchRounded, ArrowBackRounded, LocalShippingRounded,
  AssignmentReturnRounded, InventoryRounded, DeleteOutlineRounded,
  WarningAmberRounded, ChevronRightRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { formatDate, formatDateTime } from "@/utils/format";
import { SEMANTIC, NEUTRAL } from "@/styles/accents";
import { useToast } from "@/providers/ToastContext";
import { useIsNursePanel } from "@/features/ipd/panelBase";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";
import ErrorState from "@/components/ErrorState";
import { ListSkeleton } from "@/components/TableRowsSkeleton";

/**
 * Ward stock: what each ward holds, and how it got there.
 *
 * Two audiences on one screen, told apart by which panel it is mounted under.
 * The store keeper issues and receives; the nurse looks at her own cupboard and
 * sends back what she does not need. Both read the same numbers, because the
 * entire point of the feature is that there is only one set of them.
 */

/* ── types ──────────────────────────────────────────────────────────────── */

interface WardSummary {
  wardId: string; wardName: string; floorNumber: number | null;
  items: number; units: number; belowPar: number; expired: number; outOfStock: number;
}
interface WardStockRow {
  wardStockId: string; stockItemId: string; name: string; unit: string | null;
  source: string; billsToPatient: boolean; quantityOnHand: number; parLevel: number | null;
  belowPar: boolean; batchNumber: string | null; batchExpiry: string | null;
  expired: boolean; updatedAt: string;
}
interface StockItem {
  stockItemId: string; source: "CHARGE_ITEM" | "MEDICINE"; name: string; code: string | null;
  unit: string | null; price: string | null; categoryName: string;
  billsToPatient: boolean; isActive: boolean; sourceRetired: boolean;
  heldInWards: number; inStore: number;
}
interface Batch {
  batchId: string; batchNumber: string | null; expiryDate: string | null; quantityOnHand: number;
}
interface IssueNote {
  stockIssueId: string; wardId: string; wardName: string; direction: string;
  notes: string | null; processedByName: string | null; createdAt: string; units: number;
  items: Array<{ stockIssueItemId: string; itemName: string | null; quantity: number; batchNumber: string | null }>;
}

const get = async <T,>(url: string): Promise<T> => (await axiosInstance.get(url)).data.data;

/** A count with its unit, so "12" never has to be guessed at. */
function units(n: number, unit: string | null): string {
  if (!unit) return `${n}`;
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/* ── small pieces ───────────────────────────────────────────────────────── */

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 110, p: 1.5, borderRadius: 2, bgcolor: `${color}14`, border: "1px solid", borderColor: `${color}44` }}>
      <Typography variant="h5" sx={{ fontWeight: 800, color, lineHeight: 1.1 }}>{value}</Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{label}</Typography>
    </Box>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="body2" sx={{ color: "text.secondary", py: 5, textAlign: "center" }}>
      {children}
    </Typography>
  );
}

/* ── dialogs ────────────────────────────────────────────────────────────── */

/**
 * Issue stock from the store to one ward.
 *
 * Batch is chosen for you unless you say otherwise: the soonest to expire goes
 * first, which is what a store keeper would do anyway and what stops the back
 * of the shelf quietly timing out.
 */
function IssueDialog({ ward, onClose, onDone }: { ward: WardSummary; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [stockItemId, setStockItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [sourceBatchId, setSourceBatchId] = useState("");
  const [notes, setNotes] = useState("");

  const { data: items } = useQuery({
    queryKey: ["ward-stock-items"],
    queryFn: () => get<{ items: StockItem[] }>("/pharmacy/ward-stock/items"),
  });
  const stockable = (items?.items ?? []).filter((i) => i.isActive);
  const chosen = stockable.find((i) => i.stockItemId === stockItemId);

  const { data: batchData, isLoading: batchesLoading } = useQuery({
    queryKey: ["ward-stock-batches", stockItemId],
    queryFn: () => get<{ batches: Batch[]; totalOnHand: number }>(`/pharmacy/ward-stock/items/${stockItemId}/batches`),
    enabled: !!stockItemId,
  });
  const batches = batchData?.batches ?? [];

  const save = useMutation({
    mutationFn: () => axiosInstance.post("/pharmacy/ward-stock/issue", {
      wardId: ward.wardId,
      notes: notes.trim() || undefined,
      lines: [{ stockItemId, quantity: Number(quantity), ...(sourceBatchId ? { sourceBatchId } : {}) }],
    }),
    onSuccess: () => { toast.success(`Issued to ${ward.wardName}`); onDone(); onClose(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const qty = Number(quantity);
  const available = sourceBatchId
    ? batches.find((b) => b.batchId === sourceBatchId)?.quantityOnHand ?? 0
    : batches[0]?.quantityOnHand ?? 0;
  const tooMany = qty > 0 && qty > available;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Issue to {ward.wardName}
      </DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2.5 }}>
        <TextField
          select fullWidth label="Item" size="small" value={stockItemId}
          onChange={(e) => { setStockItemId(e.target.value); setSourceBatchId(""); }}
        >
          {stockable.length === 0 && <MenuItem disabled value="">Nothing is set up as ward stock yet</MenuItem>}
          {stockable.map((i) => (
            <MenuItem key={i.stockItemId} value={i.stockItemId}>
              {i.name}
              <Typography component="span" variant="caption" sx={{ color: "text.secondary", ml: 1 }}>
                {i.inStore} in store
              </Typography>
            </MenuItem>
          ))}
        </TextField>

        {stockItemId && (
          batchesLoading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={16} /><Typography variant="caption" color="text.secondary">Reading the shelf…</Typography>
            </Box>
          ) : batches.length === 0 ? (
            <Alert severity="warning">The store has none of this left.</Alert>
          ) : (
            <TextField
              select fullWidth size="small" label="Batch"
              value={sourceBatchId} onChange={(e) => setSourceBatchId(e.target.value)}
              helperText="Leave as is to take the one expiring soonest."
              // Without displayEmpty the default choice renders as a blank box:
              // the batch about to be issued would be the one thing the issue
              // screen did not show you.
              SelectProps={{ displayEmpty: true }}
              InputLabelProps={{ shrink: true }}
            >
              <MenuItem value="">
                Soonest to expire ({batches[0].batchNumber ?? "unbatched"}, {batches[0].quantityOnHand} left)
              </MenuItem>
              {batches.map((b) => (
                <MenuItem key={b.batchId} value={b.batchId}>
                  {b.batchNumber ?? "Unbatched"}
                  {b.expiryDate ? ` · expires ${formatDate(b.expiryDate)}` : ""}
                  {` · ${b.quantityOnHand} left`}
                </MenuItem>
              ))}
            </TextField>
          )
        )}

        <TextField
          fullWidth size="small" label="Quantity" type="number" value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          error={tooMany}
          helperText={tooMany ? `That batch only has ${available}.` : chosen?.unit ? `Counted in ${chosen.unit}s.` : " "}
          InputProps={{ inputProps: { min: 1 } }}
        />
        <TextField fullWidth size="small" label="Note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

        {/* The rule that trips people up, said before they hit it rather than
            after. A ward holding batch A cannot be given batch B. */}
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          A ward gives out one batch at a time. If it still holds units of a different batch, use or return
          those first — that is what lets a recall tell which batch a patient received.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" sx={{ textTransform: "none" }}>Cancel</Button>
        <Button
          variant="contained" startIcon={<LocalShippingRounded />}
          disabled={!stockItemId || !(qty > 0) || tooMany || save.isPending}
          onClick={() => save.mutate()} sx={{ textTransform: "none" }}
        >
          {save.isPending ? "Issuing…" : "Issue"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Send part or all of a ward's holding back to the store. */
function ReturnDialog({ ward, row, onClose, onDone }: {
  ward: WardSummary; row: WardStockRow; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [quantity, setQuantity] = useState(String(row.quantityOnHand));
  const [reason, setReason] = useState("");

  const save = useMutation({
    mutationFn: () => axiosInstance.post("/pharmacy/ward-stock/return", {
      wardId: ward.wardId, reason: reason.trim(),
      lines: [{ stockItemId: row.stockItemId, quantity: Number(quantity) }],
    }),
    onSuccess: () => { toast.success(`Returned to the store`); onDone(); onClose(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const qty = Number(quantity);
  const tooMany = qty > row.quantityOnHand;

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Return {row.name}</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2.5 }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {ward.wardName} holds {units(row.quantityOnHand, row.unit)}
          {row.batchNumber ? ` from batch ${row.batchNumber}` : ""}.
        </Typography>
        <TextField
          fullWidth size="small" label="Quantity to send back" type="number" value={quantity}
          onChange={(e) => setQuantity(e.target.value)} error={tooMany}
          helperText={tooMany ? `The ward only holds ${row.quantityOnHand}.` : " "}
          InputProps={{ inputProps: { min: 1, max: row.quantityOnHand } }}
        />
        <TextField
          select fullWidth size="small" label="Why is it coming back" value={reason}
          onChange={(e) => setReason(e.target.value)}
          helperText="The store needs this to know whether it goes back on the shelf."
        >
          <MenuItem value="Surplus to requirements">Surplus — not needed</MenuItem>
          <MenuItem value="Nearing expiry">Nearing expiry</MenuItem>
          <MenuItem value="Wrong item issued">Wrong item issued</MenuItem>
          <MenuItem value="Damaged or contaminated">Damaged or contaminated</MenuItem>
          <MenuItem value="Ward closing or reconfigured">Ward closing or reconfigured</MenuItem>
        </TextField>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" sx={{ textTransform: "none" }}>Cancel</Button>
        <Button
          variant="contained" color="warning" startIcon={<AssignmentReturnRounded />}
          disabled={!reason || !(qty > 0) || tooMany || save.isPending}
          onClick={() => save.mutate()} sx={{ textTransform: "none" }}
        >
          {save.isPending ? "Returning…" : "Return to store"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Goods arriving into the central store, for a consumable. */
function ReceiveDialog({ item, onClose, onDone }: { item: StockItem; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [quantity, setQuantity] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const save = useMutation({
    mutationFn: () => axiosInstance.post("/pharmacy/ward-stock/receive", {
      stockItemId: item.stockItemId, quantity: Number(quantity),
      batchNumber: batchNumber.trim() || undefined,
      expiryDate: expiryDate || undefined,
    }),
    onSuccess: () => { toast.success(`${item.name} received`); onDone(); onClose(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Receive {item.name}</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2.5 }}>
        <TextField
          fullWidth size="small" label="Quantity received" type="number" value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          helperText={item.unit ? `Counted in ${item.unit}s.` : " "}
          InputProps={{ inputProps: { min: 1 } }}
        />
        <TextField
          fullWidth size="small" label="Batch number (optional)" value={batchNumber}
          onChange={(e) => setBatchNumber(e.target.value)}
          helperText="Without one, these units cannot be followed in a recall."
        />
        <TextField
          fullWidth size="small" label="Expiry (optional)" type="date" value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)} InputLabelProps={{ shrink: true }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" sx={{ textTransform: "none" }}>Cancel</Button>
        <Button
          variant="contained" disabled={!(Number(quantity) > 0) || save.isPending}
          onClick={() => save.mutate()} sx={{ textTransform: "none" }}
        >
          {save.isPending ? "Receiving…" : "Receive"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Decide that a thing from either catalogue is something wards hold. */
function AddItemDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const search = useDebouncedValue(q, 300);
  const [unit, setUnit] = useState("");
  const [billsToPatient, setBillsToPatient] = useState(true);
  const [picked, setPicked] = useState<{ kind: "CHARGE" | "MED"; id: string; name: string } | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["ward-stock-candidates", search],
    queryFn: () => get<{
      consumables: Array<{ chargeItemId: string; name: string; price: string; categoryName: string }>;
      medicines: Array<{ medicineId: string; name: string }>;
      needsSearch?: boolean;
    }>(`/pharmacy/ward-stock/candidates?q=${encodeURIComponent(search)}`),
    enabled: search.trim().length >= 2,
  });

  const save = useMutation({
    mutationFn: () => axiosInstance.post("/pharmacy/ward-stock/items", {
      ...(picked?.kind === "CHARGE" ? { chargeItemId: picked.id } : { medicineId: picked?.id }),
      stockUnit: unit.trim() || undefined,
      billsToPatient,
    }),
    onSuccess: () => { toast.success(`${picked?.name} is now ward stock`); onDone(); onClose(); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Stock something new</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2.5 }}>
        <TextField
          fullWidth size="small" autoFocus placeholder="Search gloves, syringes, a medicine…"
          value={q} onChange={(e) => setQ(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }}
        />
        {/* The catalogue does not mark which items are physical things, so this
            asks instead of guessing. Listing all 200 would bury the three. */}
        {search.trim().length < 2 ? (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Type at least two letters. The catalogue holds scans and procedures too, so it is searched rather than listed.
          </Typography>
        ) : isFetching ? (
          <ListSkeleton rows={3} />
        ) : (
          <Box sx={{ maxHeight: 240, overflowY: "auto" }}>
            {[
              ...(data?.consumables ?? []).map((c) => ({ kind: "CHARGE" as const, id: c.chargeItemId, name: c.name, sub: `${c.categoryName} · ₹${c.price}` })),
              ...(data?.medicines ?? []).map((m) => ({ kind: "MED" as const, id: m.medicineId, name: m.name, sub: "Medicine" })),
            ].map((o) => (
              <Box
                key={o.id} onClick={() => setPicked({ kind: o.kind, id: o.id, name: o.name })}
                sx={{
                  display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, cursor: "pointer", borderRadius: 1.5,
                  bgcolor: picked?.id === o.id ? `${SEMANTIC.info}18` : "transparent",
                  "&:hover": { bgcolor: `${SEMANTIC.info}10` },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{o.name}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>{o.sub}</Typography>
                </Box>
              </Box>
            ))}
            {!(data?.consumables ?? []).length && !(data?.medicines ?? []).length && (
              <Empty>Nothing matches, or it is stocked already.</Empty>
            )}
          </Box>
        )}

        {picked && (
          <>
            <Divider />
            <TextField
              fullWidth size="small" label="Counted in" value={unit} onChange={(e) => setUnit(e.target.value)}
              placeholder="pair, pack, vial"
              helperText="What the WARD counts — the catalogue unit is often something else entirely."
            />
            <FormControlLabel
              control={<Switch checked={billsToPatient} onChange={(e) => setBillsToPatient(e.target.checked)} />}
              label={billsToPatient ? "Billed to the patient who uses it" : "Floor stock — absorbed, never billed"}
            />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" disabled={!picked || save.isPending} onClick={() => save.mutate()} sx={{ textTransform: "none" }}>
          {save.isPending ? "Adding…" : "Stock it"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ── tabs ───────────────────────────────────────────────────────────────── */

/** One ward opened up: every line it holds, and what can be done to each. */
function WardDetail({ ward, onBack, canIssue }: { ward: WardSummary; onBack: () => void; canIssue: boolean }) {
  const qc = useQueryClient();
  const [issuing, setIssuing] = useState(false);
  const [returning, setReturning] = useState<WardStockRow | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ward-stock-ward", ward.wardId],
    queryFn: () => get<{ stock: WardStockRow[]; summary: { items: number; units: number; belowPar: number; expired: number; outOfStock: number } }>(
      `/pharmacy/ward-stock/wards/${ward.wardId}`),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ward-stock-ward", ward.wardId] });
    qc.invalidateQueries({ queryKey: ["ward-stock-wards"] });
    qc.invalidateQueries({ queryKey: ["ward-stock-items"] });
    qc.invalidateQueries({ queryKey: ["ward-stock-issues"] });
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5, flexWrap: "wrap" }}>
        <IconButton onClick={onBack} size="small"><ArrowBackRounded /></IconButton>
        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }}>{ward.wardName}</Typography>
        {canIssue && (
          <Button variant="contained" startIcon={<LocalShippingRounded />} onClick={() => setIssuing(true)} sx={{ textTransform: "none" }}>
            Issue to this ward
          </Button>
        )}
      </Box>

      {isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <ListSkeleton rows={5} />
      ) : (
        <>
          <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, flexWrap: "wrap" }}>
            <Stat label="Lines held" value={data.summary.items} color={SEMANTIC.info} />
            <Stat label="Units" value={data.summary.units} color={SEMANTIC.success} />
            <Stat label="Out of stock" value={data.summary.outOfStock} color={NEUTRAL.muted} />
            {data.summary.expired > 0 && <Stat label="Expired" value={data.summary.expired} color={SEMANTIC.danger} />}
          </Box>

          {data.stock.length === 0 ? (
            <Empty>This ward has never been issued anything.</Empty>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Batch</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">On hand</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Par</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Last moved</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.stock.map((r) => (
                    <TableRow key={r.wardStockId} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.name}</Typography>
                        {!r.billsToPatient && (
                          <Chip size="small" label="Floor stock" sx={{ height: 18, fontSize: 11, mt: 0.3, bgcolor: `${NEUTRAL.muted}1f`, color: NEUTRAL.muted }} />
                        )}
                      </TableCell>
                      <TableCell>
                        {r.batchNumber ? (
                          <Box>
                            <Typography variant="body2">{r.batchNumber}</Typography>
                            {r.batchExpiry && (
                              <Typography variant="caption" sx={{ color: r.expired ? SEMANTIC.danger : "text.secondary" }}>
                                {r.expired ? "expired " : "expires "}{formatDate(r.batchExpiry)}
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          <Typography variant="caption" sx={{ color: "text.disabled" }}>—</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{
                          fontWeight: 800, fontVariantNumeric: "tabular-nums",
                          color: r.quantityOnHand === 0 ? "text.disabled" : r.belowPar ? SEMANTIC.warning : "text.primary",
                        }}>
                          {units(r.quantityOnHand, r.unit)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>{r.parLevel ?? "—"}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>{formatDate(r.updatedAt)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={r.quantityOnHand === 0 ? "Nothing to send back" : "Send back to the store"}>
                          <span>
                            <IconButton size="small" disabled={r.quantityOnHand === 0} onClick={() => setReturning(r)}>
                              <AssignmentReturnRounded fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {issuing && <IssueDialog ward={ward} onClose={() => setIssuing(false)} onDone={refresh} />}
      {returning && <ReturnDialog ward={ward} row={returning} onClose={() => setReturning(null)} onDone={refresh} />}
    </Box>
  );
}

/** Every ward at a glance, so the one that needs attention is obvious. */
function WardsTab({ canIssue }: { canIssue: boolean }) {
  const [open, setOpen] = useState<WardSummary | null>(null);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ward-stock-wards"],
    queryFn: () => get<{ wards: WardSummary[] }>("/pharmacy/ward-stock/wards"),
  });

  if (open) return <WardDetail ward={open} onBack={() => setOpen(null)} canIssue={canIssue} />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;
  if (isLoading || !data) return <ListSkeleton rows={4} />;
  if (!data.wards.length) return <Empty>No wards are set up yet.</Empty>;

  return (
    <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" } }}>
      {data.wards.map((w) => (
        <Paper
          key={w.wardId} variant="outlined" onClick={() => setOpen(w)}
          sx={{
            p: 2, borderRadius: 2, cursor: "pointer", display: "flex", alignItems: "center", gap: 1.5,
            "&:hover": { borderColor: SEMANTIC.info, bgcolor: `${SEMANTIC.info}08` },
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body1" sx={{ fontWeight: 700 }} noWrap>{w.wardName}</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {w.items === 0 ? "nothing issued yet" : `${w.items} line${w.items === 1 ? "" : "s"} · ${w.units} units`}
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, mt: 0.8, flexWrap: "wrap" }}>
              {w.expired > 0 && (
                <Chip size="small" icon={<WarningAmberRounded sx={{ fontSize: 14 }} />} label={`${w.expired} expired`}
                  sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: `${SEMANTIC.danger}18`, color: SEMANTIC.danger }} />
              )}
              {w.belowPar > 0 && (
                <Chip size="small" label={`${w.belowPar} below par`}
                  sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: `${SEMANTIC.warning}18`, color: SEMANTIC.warning }} />
              )}
              {w.outOfStock > 0 && (
                <Chip size="small" label={`${w.outOfStock} out`}
                  sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: `${NEUTRAL.muted}1f`, color: NEUTRAL.muted }} />
              )}
            </Box>
          </Box>
          <ChevronRightRounded sx={{ color: "text.disabled" }} />
        </Paper>
      ))}
    </Box>
  );
}

/** The central shelf: what is stocked, how much is left, and receiving more. */
function StoreTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const [receiving, setReceiving] = useState<StockItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ward-stock-items"],
    queryFn: () => get<{ items: StockItem[]; summary: Record<string, number> }>("/pharmacy/ward-stock/items"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => axiosInstance.delete(`/pharmacy/ward-stock/items/${id}`),
    onSuccess: () => { toast.success("No longer stocked"); qc.invalidateQueries({ queryKey: ["ward-stock-items"] }); },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ward-stock-items"] });
    qc.invalidateQueries({ queryKey: ["ward-stock-wards"] });
  };

  const rows = useMemo(() => {
    const all = data?.items ?? [];
    const term = q.trim().toLowerCase();
    return term ? all.filter((i) => i.name.toLowerCase().includes(term)) : all;
  }, [data, q]);

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, alignItems: "center", flexWrap: "wrap" }}>
        <TextField
          size="small" placeholder="Find an item" value={q} onChange={(e) => setQ(e.target.value)}
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }}
        />
        <Button variant="contained" startIcon={<AddRounded />} onClick={() => setAdding(true)} sx={{ textTransform: "none" }}>
          Stock something new
        </Button>
      </Box>

      {isError ? (
        <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <Empty>{q ? "Nothing matches that." : "Nothing is set up as ward stock yet."}</Empty>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Where it comes from</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">In store</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">In wards</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((i) => (
                <TableRow key={i.stockItemId} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{i.name}</Typography>
                    <Box sx={{ display: "flex", gap: 0.5, mt: 0.3, flexWrap: "wrap" }}>
                      {!i.billsToPatient && (
                        <Chip size="small" label="Floor stock" sx={{ height: 18, fontSize: 11, bgcolor: `${NEUTRAL.muted}1f`, color: NEUTRAL.muted }} />
                      )}
                      {/* Worth saying plainly: it looks fine until somebody
                          tries to issue it. */}
                      {i.sourceRetired && (
                        <Chip size="small" label="Retired in its catalogue"
                          sx={{ height: 18, fontSize: 11, bgcolor: `${SEMANTIC.warning}1f`, color: SEMANTIC.warning }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {i.source === "MEDICINE" ? "Pharmacy inventory" : i.categoryName}
                      {i.unit ? ` · counted in ${i.unit}s` : ""}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: i.inStore === 0 ? "text.disabled" : "text.primary" }}>
                      {i.inStore}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", color: "text.secondary" }}>
                      {i.heldInWards}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                      {/* A drug is received through pharmacy inventory, which
                          records cost and supplier. No second door here. */}
                      <Tooltip title={i.source === "MEDICINE" ? "Medicines are received in Pharmacy > Inventory" : "Receive stock into the store"}>
                        <span>
                          <IconButton size="small" disabled={i.source === "MEDICINE"} onClick={() => setReceiving(i)}>
                            <InventoryRounded fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={i.heldInWards > 0 ? "Wards still hold some of these" : "Stop stocking it"}>
                        <span>
                          <IconButton size="small" disabled={i.heldInWards > 0 || remove.isPending} onClick={() => remove.mutate(i.stockItemId)}>
                            <DeleteOutlineRounded fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {receiving && <ReceiveDialog item={receiving} onClose={() => setReceiving(null)} onDone={refresh} />}
      {adding && <AddItemDialog onClose={() => setAdding(false)} onDone={refresh} />}
    </Box>
  );
}

/** Every note, newest first: what moved, where, and who did it. */
function LogTab() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ward-stock-issues"],
    queryFn: () => get<{ issues: IssueNote[] }>("/pharmacy/ward-stock/issues?limit=100"),
  });

  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;
  if (isLoading || !data) return <ListSkeleton rows={5} />;
  if (!data.issues.length) return <Empty>Nothing has moved yet.</Empty>;

  return (
    <Box>
      {data.issues.map((n) => {
        const back = n.direction === "RETURN";
        const tone = back ? SEMANTIC.warning : SEMANTIC.info;
        return (
          <Paper key={n.stockIssueId} variant="outlined" sx={{ p: 1.75, mb: 1, borderRadius: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
              <Chip
                size="small" label={back ? "Returned" : "Issued"}
                sx={{ height: 22, fontWeight: 700, bgcolor: `${tone}18`, color: tone }}
              />
              <Typography variant="body2" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
                {back ? `${n.wardName} → store` : `Store → ${n.wardName}`}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {formatDateTime(n.createdAt)}{n.processedByName ? ` · ${n.processedByName}` : ""}
              </Typography>
            </Box>
            <Box sx={{ mt: 0.8, pl: 0.5 }}>
              {n.items.map((it) => (
                <Typography key={it.stockIssueItemId} variant="caption" sx={{ display: "block", color: "text.secondary" }}>
                  · {it.quantity} × {it.itemName ?? "item"}{it.batchNumber ? ` (batch ${it.batchNumber})` : ""}
                </Typography>
              ))}
              {n.notes && (
                <Typography variant="caption" sx={{ display: "block", mt: 0.4, fontStyle: "italic", color: "text.secondary" }}>
                  {n.notes}
                </Typography>
              )}
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}

/* ── page ───────────────────────────────────────────────────────────────── */

export default function WardStock() {
  const isNurse = useIsNursePanel();
  const [tab, setTab] = useState(0);

  // A nurse looks after her own cupboard and sends things back; deciding what
  // the hospital stocks and receiving deliveries belong to the store.
  const tabs = isNurse
    ? [{ label: "Ward cupboards", node: <WardsTab canIssue={false} /> }, { label: "Movement log", node: <LogTab /> }]
    : [
      { label: "Ward cupboards", node: <WardsTab canIssue /> },
      { label: "Central store", node: <StoreTab /> },
      { label: "Movement log", node: <LogTab /> },
    ];

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: "-0.5px" }}>Ward Stock</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
          {isNurse
            ? "What this ward is holding, and sending back what it does not need."
            : "Gloves, syringes and floor-stock drugs: what the store has, and what each ward is holding."}
        </Typography>
      </Box>

      <Tabs
        value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
        sx={{ mb: 2.5, borderBottom: "1px solid", borderColor: "divider" }}
      >
        {tabs.map((t) => <Tab key={t.label} label={t.label} sx={{ textTransform: "none", fontWeight: 700 }} />)}
      </Tabs>

      {tabs[tab]?.node}
    </Box>
  );
}
