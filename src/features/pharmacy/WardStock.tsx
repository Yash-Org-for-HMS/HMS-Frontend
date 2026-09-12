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
  WarningAmberRounded, ChevronRightRounded, HealingRounded, FactCheckRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { formatDate, formatDateTime, formatINRAuto } from "@/utils/format";
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

interface CountResult {
  stockIssueId: string;
  items: Array<{ stockItemId: string; name: string; unit: string | null; expected: number; counted: number; variance: number }>;
  summary: { counted: number; agreed: number; variances: number; short: number; over: number };
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

/**
 * Record what was used on a patient, out of this ward's cupboard.
 *
 * The same event the patient's chart records, reached from the other end. It
 * posts to one service, so the bill and the cupboard cannot come to different
 * conclusions about it.
 */
function ConsumeDialog({ ward, stock, onClose, onDone }: {
  ward: WardSummary;
  stock: WardStockRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [admissionId, setAdmissionId] = useState("");
  const [stockItemId, setStockItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [basket, setBasket] = useState<Array<{ stockItemId: string; name: string; quantity: number; billsToPatient: boolean }>>([]);

  const { data: patients, isLoading: patientsLoading } = useQuery({
    queryKey: ["ward-stock-patients", ward.wardId],
    queryFn: () => get<{ patients: Array<{ admissionId: string; name: string; uhid: string | null; bed: string | null }> }>(
      `/pharmacy/ward-stock/wards/${ward.wardId}/patients`),
  });

  // Only what the ward actually has. Offering something it holds none of would
  // produce a shortfall warning the picker could have prevented.
  const available = stock.filter((s) => s.quantityOnHand > 0 && !basket.some((b) => b.stockItemId === s.stockItemId));
  const chosen = stock.find((s) => s.stockItemId === stockItemId);
  const qty = Number(quantity);
  const tooMany = !!chosen && qty > chosen.quantityOnHand;

  const add = () => {
    if (!chosen || !(qty > 0) || tooMany) return;
    setBasket((b) => [...b, { stockItemId: chosen.stockItemId, name: chosen.name, quantity: qty, billsToPatient: chosen.billsToPatient }]);
    setStockItemId("");
    setQuantity("1");
  };

  const save = useMutation({
    mutationFn: () => axiosInstance.post("/pharmacy/ward-stock/consume", {
      admissionId, notes: notes.trim() || undefined,
      lines: basket.map((b) => ({ stockItemId: b.stockItemId, quantity: b.quantity })),
    }),
    onSuccess: (res) => {
      const used = res.data?.data?.used ?? [];
      toast.success(`Recorded against ${patients?.patients.find((p) => p.admissionId === admissionId)?.name ?? "the patient"}`);
      // A cupboard that has run out does not block the record, so the screen
      // has to say which lines did not actually come off the shelf.
      for (const u of used as Array<{ itemName: string; stockNote: string | null }>) {
        if (u.stockNote) toast.warning(`${u.itemName}: ${u.stockNote}`);
      }
      onDone();
      onClose();
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const billable = basket.filter((b) => b.billsToPatient).length;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Record use in {ward.wardName}</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2.5 }}>
        <TextField
          select fullWidth size="small" label="Used on" value={admissionId}
          onChange={(e) => setAdmissionId(e.target.value)}
        >
          {patientsLoading && <MenuItem disabled value="">Loading…</MenuItem>}
          {!patientsLoading && !(patients?.patients ?? []).length && (
            <MenuItem disabled value="">Nobody is admitted in this ward</MenuItem>
          )}
          {(patients?.patients ?? []).map((p) => (
            <MenuItem key={p.admissionId} value={p.admissionId}>
              {p.name}
              <Typography component="span" variant="caption" sx={{ color: "text.secondary", ml: 1 }}>
                {p.uhid}{p.bed ? ` · bed ${p.bed}` : ""}
              </Typography>
            </MenuItem>
          ))}
        </TextField>

        <Divider />

        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
          <TextField
            select size="small" label="Item" value={stockItemId} onChange={(e) => setStockItemId(e.target.value)}
            sx={{ flex: 1, minWidth: 180 }}
          >
            {!available.length && <MenuItem disabled value="">This ward holds nothing else</MenuItem>}
            {available.map((s) => (
              <MenuItem key={s.stockItemId} value={s.stockItemId}>
                {s.name}
                <Typography component="span" variant="caption" sx={{ color: "text.secondary", ml: 1 }}>
                  {s.quantityOnHand} on hand
                </Typography>
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small" label="Qty" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}
            sx={{ width: 96 }} error={tooMany}
            helperText={tooMany ? `only ${chosen?.quantityOnHand}` : " "}
            InputProps={{ inputProps: { min: 1 } }}
          />
          <Button onClick={add} disabled={!chosen || !(qty > 0) || tooMany} sx={{ textTransform: "none", mt: 0.4 }}>
            Add
          </Button>
        </Box>

        {basket.length > 0 && (
          <Box>
            {basket.map((b, i) => (
              <Box key={b.stockItemId}
                sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.75, borderBottom: "1px solid", borderColor: "divider" }}>
                <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }} noWrap>{b.name}</Typography>
                {/* Said before it is recorded, not discovered on the bill. */}
                {!b.billsToPatient && (
                  <Chip size="small" label="not billed" sx={{ height: 18, fontSize: 11, bgcolor: `${NEUTRAL.muted}1f`, color: NEUTRAL.muted }} />
                )}
                <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{b.quantity}</Typography>
                <IconButton size="small" onClick={() => setBasket((prev) => prev.filter((_, ix) => ix !== i))}>
                  <DeleteOutlineRounded fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
              {billable === 0
                ? "None of this bills the patient — it is all floor stock."
                : `${billable} of ${basket.length} will be added to the patient's bill.`}
            </Typography>
          </Box>
        )}

        <TextField fullWidth size="small" label="Note (optional)" placeholder="dressing change"
          value={notes} onChange={(e) => setNotes(e.target.value)} />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" sx={{ textTransform: "none" }}>Cancel</Button>
        <Button
          variant="contained" disabled={!admissionId || !basket.length || save.isPending}
          onClick={() => save.mutate()} sx={{ textTransform: "none" }}
        >
          {save.isPending ? "Recording…" : "Record"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** What this ward has used, and on whom. */
function WardUsage({ wardId }: { wardId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ward-stock-used", wardId],
    queryFn: () => get<{
      usage: Array<{
        stockIssueId: string; patientName: string; uhid: string | null; notes: string | null;
        recordedByName: string | null; createdAt: string; units: number;
        items: Array<{ stockIssueItemId: string; itemName: string | null; quantity: number; batchNumber: string | null; billed: boolean }>;
      }>;
    }>(`/pharmacy/ward-stock/wards/${wardId}/used?limit=20`),
  });

  if (isLoading) return <ListSkeleton rows={3} />;
  if (!data?.usage.length) {
    return <Empty>Nothing has been used out of this cupboard yet.</Empty>;
  }

  return (
    <Box>
      {data.usage.map((r) => (
        <Paper key={r.stockIssueId} variant="outlined" sx={{ p: 1.5, mb: 1, borderRadius: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Typography variant="body2" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
              {r.patientName}
              {r.uhid && <Typography component="span" variant="caption" sx={{ color: "text.secondary", ml: 1 }}>{r.uhid}</Typography>}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {formatDateTime(r.createdAt)}{r.recordedByName ? ` · ${r.recordedByName}` : ""}
            </Typography>
          </Box>
          <Box sx={{ mt: 0.6 }}>
            {r.items.map((i) => (
              <Typography key={i.stockIssueItemId} variant="caption" sx={{ display: "block", color: "text.secondary" }}>
                · {i.quantity} × {i.itemName ?? "item"}
                {i.batchNumber ? ` (batch ${i.batchNumber})` : ""}
                {i.billed ? "" : " — floor stock, not billed"}
              </Typography>
            ))}
            {r.notes && (
              <Typography variant="caption" sx={{ display: "block", mt: 0.3, fontStyle: "italic", color: "text.secondary" }}>
                {r.notes}
              </Typography>
            )}
          </Box>
        </Paper>
      ))}
    </Box>
  );
}

/**
 * What this ward should carry, edited where it is read.
 *
 * Blank and zero mean different things and both are kept: blank is "nobody has
 * said", zero is "this ward carries none of these on purpose". Only the first
 * keeps the line off the reorder list for the right reason.
 */
function ParCell({ wardId, row, editable, onSaved }: {
  wardId: string;
  row: WardStockRow;
  editable: boolean;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [value, setValue] = useState(row.parLevel == null ? "" : String(row.parLevel));
  const [saving, setSaving] = useState(false);

  if (!editable) {
    return <Typography variant="caption" sx={{ color: "text.secondary" }}>{row.parLevel ?? "—"}</Typography>;
  }

  const commit = async () => {
    const next = value.trim() === "" ? null : Number(value);
    if (next === (row.parLevel ?? null)) return;
    if (next !== null && (!Number.isInteger(next) || next < 0)) {
      toast.error("A par level must be a whole number, or blank");
      setValue(row.parLevel == null ? "" : String(row.parLevel));
      return;
    }
    setSaving(true);
    try {
      await axiosInstance.put(`/pharmacy/ward-stock/wards/${wardId}/par`, {
        lines: [{ stockItemId: row.stockItemId, parLevel: next }],
      });
      onSaved();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
      setValue(row.parLevel == null ? "" : String(row.parLevel));
    } finally {
      setSaving(false);
    }
  };

  return (
    <TextField
      size="small" type="number" variant="standard" placeholder="—"
      value={value} disabled={saving}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLElement).blur(); }}
      sx={{ width: 64, "& input": { textAlign: "right", fontSize: 13 } }}
      InputProps={{ inputProps: { min: 0, "aria-label": `Par level for ${row.name}` } }}
    />
  );
}

/** Keeps a full-screen count sheet readable on a wide monitor. */
const SHEET = { width: "100%", maxWidth: 720 } as const;

/**
 * Count the cupboard.
 *
 * A BLIND count: the figure the books hold is deliberately not shown while you
 * are typing. A count sheet that prints the expected number beside every line
 * is a sheet that gets ticked down the page, and a stocktake nobody actually
 * performed is worse than none - it converts a guess into a fact with a
 * signature on it. The variances are shown the moment it is submitted, which is
 * when they are useful and no longer able to steer the count.
 */
function CountDialog({ ward, stock, onClose, onDone }: {
  ward: WardSummary;
  stock: WardStockRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<CountResult | null>(null);

  const entered = stock.filter((s) => counts[s.stockItemId] !== undefined && counts[s.stockItemId] !== "");

  const save = useMutation({
    mutationFn: async () => (await axiosInstance.post(`/pharmacy/ward-stock/wards/${ward.wardId}/count`, {
      notes: notes.trim() || undefined,
      lines: entered.map((s) => ({ stockItemId: s.stockItemId, countedQuantity: Number(counts[s.stockItemId]) })),
    })).data.data as CountResult,
    onSuccess: (data) => {
      setResult(data);
      onDone();
      const off = data.summary.variances;
      if (off === 0) toast.success(`All ${data.summary.counted} lines agreed`);
      else toast.warning(`${off} line${off === 1 ? "" : "s"} did not match the books`);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  // Once counted, the dialog becomes the result sheet: what was expected, what
  // was found, and by how much. This is the only place those sit side by side.
  if (result) {
    const off = result.items.filter((i) => i.variance !== 0);
    return (
      <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Counted {ward.wardName}</DialogTitle>
        <DialogContent dividers sx={{ pt: 2.5 }}>
          <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, flexWrap: "wrap" }}>
            <Stat label="Lines counted" value={result.summary.counted} color={SEMANTIC.info} />
            <Stat label="Agreed" value={result.summary.agreed} color={SEMANTIC.success} />
            {result.summary.short > 0 && <Stat label="Units short" value={result.summary.short} color={SEMANTIC.danger} />}
            {result.summary.over > 0 && <Stat label="Units over" value={result.summary.over} color={SEMANTIC.warning} />}
          </Box>

          {off.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary", py: 2, textAlign: "center" }}>
              Every line matched the books. Worth recording: it is what makes the next shortfall
              traceable to a known window rather than to all of history.
            </Typography>
          ) : (
            <>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 1 }}>
                WHAT DID NOT MATCH · {off.length}
              </Typography>
              {off.map((i) => (
                <Box key={i.stockItemId}
                  sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{i.name}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      books said {i.expected}, counted {i.counted}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{
                    fontWeight: 800, fontVariantNumeric: "tabular-nums",
                    color: i.variance < 0 ? SEMANTIC.danger : SEMANTIC.warning,
                  }}>
                    {i.variance > 0 ? "+" : ""}{i.variance}
                  </Typography>
                </Box>
              ))}
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1.5 }}>
                The cupboard now says what was counted. Units found missing are reported against this
                batch as unaccounted for, rather than quietly written off.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="contained" onClick={onClose} sx={{ textTransform: "none" }}>Done</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    /**
     * Full screen, and that is the whole point rather than a style choice.
     *
     * A normal dialog floats over the ward table with a dim backdrop, and the
     * quantities are perfectly readable through it — the "Units" tile and the
     * on-hand column sit right behind the sheet. Hiding the figure inside the
     * dialog while leaving it legible two inches away is not a blind count, it
     * just looks like one. Covering the page is the only version that holds.
     */
    <Dialog
      open onClose={onClose} fullScreen
      PaperProps={{ sx: { alignItems: "center" } }}
      /**
       * No fade. The sheet covers the page, but a fade covers it GRADUALLY, and
       * for a couple of hundred milliseconds the on-hand column is legible
       * straight through the half-drawn dialog. On any other screen that is a
       * pleasant flourish; on this one it hands the counter the answer.
       */
      transitionDuration={0}
    >
      <DialogTitle sx={{ fontWeight: 700, ...SHEET }}>Count {ward.wardName}</DialogTitle>
      <DialogContent dividers sx={{ pt: 2.5, ...SHEET }}>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
          Write down what is actually on the shelf. What the system thinks is there is deliberately
          hidden until you are done — a sheet that shows you the answer is a sheet that gets ticked.
        </Typography>

        {stock.length === 0 ? (
          <Empty>This ward has nothing on its list to count.</Empty>
        ) : stock.map((s) => (
          <Box key={s.stockItemId}
            sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.9, borderBottom: "1px solid", borderColor: "divider" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{s.name}</Typography>
              {s.batchNumber && (
                <Typography variant="caption" sx={{ color: "text.secondary" }}>batch {s.batchNumber}</Typography>
              )}
            </Box>
            <TextField
              size="small" type="number" placeholder="—" sx={{ width: 100 }}
              value={counts[s.stockItemId] ?? ""}
              onChange={(e) => setCounts((c) => ({ ...c, [s.stockItemId]: e.target.value }))}
              InputProps={{ inputProps: { min: 0, "aria-label": `Count of ${s.name}` } }}
            />
            {s.unit && (
              <Typography variant="caption" sx={{ color: "text.secondary", width: 44 }}>{s.unit}s</Typography>
            )}
          </Box>
        ))}

        <TextField
          fullWidth size="small" label="Note (optional)" placeholder="monthly count"
          value={notes} onChange={(e) => setNotes(e.target.value)} sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2, ...SHEET }}>
        <Button onClick={onClose} color="inherit" sx={{ textTransform: "none" }}>Cancel</Button>
        <Button
          variant="contained" disabled={!entered.length || save.isPending}
          onClick={() => save.mutate()} sx={{ textTransform: "none" }}
        >
          {save.isPending ? "Recording…" : `Record count of ${entered.length}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * What the store owes the wards, in the order it would be walked.
 *
 * The reason par levels are worth setting at all: without this the number sits
 * in a column and somebody still has to go and look.
 */
function ReorderTab() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ward-stock-reorder"],
    queryFn: () => get<{
      lines: Array<{
        wardId: string; wardName: string; stockItemId: string; name: string; unit: string | null;
        onHand: number; parLevel: number; shortBy: number; inStore: number; canCover: boolean;
      }>;
      summary: { lines: number; wards: number; unitsShort: number; cannotCover: number };
    }>("/pharmacy/ward-stock/reorder"),
  });

  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;
  if (isLoading || !data) return <ListSkeleton rows={4} />;
  if (!data.lines.length) {
    return <Empty>Every ward with a par level is at or above it.</Empty>;
  }

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, flexWrap: "wrap" }}>
        <Stat label="Lines to fill" value={data.summary.lines} color={SEMANTIC.warning} />
        <Stat label="Wards waiting" value={data.summary.wards} color={SEMANTIC.info} />
        <Stat label="Units short" value={data.summary.unitsShort} color={SEMANTIC.warning} />
        {data.summary.cannotCover > 0 && (
          <Stat label="Store cannot cover" value={data.summary.cannotCover} color={SEMANTIC.danger} />
        )}
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Ward</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">On hand</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Par</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Send</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">In store</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.lines.map((l) => (
              <TableRow key={`${l.wardId}-${l.stockItemId}`} hover>
                <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{l.wardName}</Typography></TableCell>
                <TableCell>{l.name}</TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{
                    fontVariantNumeric: "tabular-nums",
                    color: l.onHand === 0 ? SEMANTIC.danger : "text.primary",
                    fontWeight: l.onHand === 0 ? 800 : 400,
                  }}>
                    {l.onHand}
                  </Typography>
                </TableCell>
                <TableCell align="right"><Typography variant="body2" sx={{ color: "text.secondary" }}>{l.parLevel}</Typography></TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                    {l.shortBy}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {/* Said on the same line, so nobody builds a picking list the
                      shelf cannot actually fill. */}
                  <Typography variant="body2" sx={{
                    fontVariantNumeric: "tabular-nums",
                    color: l.canCover ? "text.secondary" : SEMANTIC.danger,
                    fontWeight: l.canCover ? 400 : 700,
                  }}>
                    {l.inStore}{l.canCover ? "" : " — short"}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

/* ── tabs ───────────────────────────────────────────────────────────────── */

/** One ward opened up: every line it holds, and what can be done to each. */
function WardDetail({ ward, onBack, canIssue }: { ward: WardSummary; onBack: () => void; canIssue: boolean }) {
  const qc = useQueryClient();
  const [issuing, setIssuing] = useState(false);
  const [returning, setReturning] = useState<WardStockRow | null>(null);
  const [consuming, setConsuming] = useState(false);
  const [counting, setCounting] = useState(false);
  const [view, setView] = useState<"holding" | "used">("holding");

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
    qc.invalidateQueries({ queryKey: ["ward-stock-used", ward.wardId] });
    qc.invalidateQueries({ queryKey: ["ward-stock-reorder"] });
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5, flexWrap: "wrap" }}>
        <IconButton onClick={onBack} size="small"><ArrowBackRounded /></IconButton>
        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }}>{ward.wardName}</Typography>
        {/* The nursing action, and the one this whole module exists to make
            possible: it bills the patient and empties the cupboard at once. */}
        <Button variant="contained" startIcon={<HealingRounded />} onClick={() => setConsuming(true)} sx={{ textTransform: "none" }}>
          Record use
        </Button>
        {/* Counting is the ward's own work: the people who can see the shelf are
            the ones who know what is on it. */}
        <Button variant="outlined" startIcon={<FactCheckRounded />} onClick={() => setCounting(true)} sx={{ textTransform: "none" }}>
          Count stock
        </Button>
        {canIssue && (
          <Button variant="outlined" startIcon={<LocalShippingRounded />} onClick={() => setIssuing(true)} sx={{ textTransform: "none" }}>
            Issue to this ward
          </Button>
        )}
      </Box>

      <Tabs
        value={view} onChange={(_, v) => setView(v)}
        sx={{ mb: 2, minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0 } }}
      >
        <Tab value="holding" label="Holding" sx={{ textTransform: "none", fontWeight: 700 }} />
        <Tab value="used" label="Used on patients" sx={{ textTransform: "none", fontWeight: 700 }} />
      </Tabs>

      {view === "used" && <WardUsage wardId={ward.wardId} />}

      {view === "holding" && (isError ? (
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
                        {/* Keyed on the saved value so a refetch resyncs the
                            field instead of leaving stale local state in it. */}
                        <ParCell
                          key={`${r.wardStockId}:${r.parLevel ?? "none"}`}
                          wardId={ward.wardId} row={r} editable={canIssue} onSaved={refresh}
                        />
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
      ))}

      {issuing && <IssueDialog ward={ward} onClose={() => setIssuing(false)} onDone={refresh} />}
      {returning && <ReturnDialog ward={ward} row={returning} onClose={() => setReturning(null)} onDone={refresh} />}
      {consuming && (
        <ConsumeDialog ward={ward} stock={data?.stock ?? []} onClose={() => setConsuming(false)} onDone={refresh} />
      )}
      {counting && (
        <CountDialog ward={ward} stock={data?.stock ?? []} onClose={() => setCounting(false)} onDone={refresh} />
      )}
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

/* ── reports ────────────────────────────────────────────────────────────── */

interface PositionReport {
  asAt: string;
  wards: Array<{ wardId: string; wardName: string; lines: number; units: number; listValue: string; expiredUnits: number; expiringUnits: number; belowPar: number }>;
  totals: { wards: number; lines: number; units: number; listValue: string; expiredUnits: number; expiringUnits: number; belowPar: number; medicineUnitsOffValuation: number };
}
interface ConsumptionReport {
  period: { from: string; to: string };
  wards: Array<{ wardId: string; wardName: string; lines: number; units: number; patients: number; billedUnits: number; billedValue: string; absorbedUnits: number; absorbedValue: string }>;
  items: Array<{ stockItemId: string; name: string; unit: string | null; units: number; value: string }>;
  totals: { records: number; lines: number; units: number; billedValue: string; absorbedValue: string };
}
interface VarianceReport {
  period: { from: string; to: string };
  wards: Array<{
    wardId: string; wardName: string; unitsHeld: number; counts: number; lines: number;
    agreed: number; off: number; unitsShort: number; unitsOver: number; shortValue: string;
    lastCountedAt: string | null; neverCounted: boolean;
  }>;
  totals: { counts: number; lines: number; off: number; unitsShort: number; unitsOver: number; shortValue: string; wardsNeverCounted: number };
}

/** The last 30 days, which is the window these reports default to. */
function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

/**
 * What ward stock costs, where it goes, and what goes missing.
 *
 * Three questions kept apart rather than blended into one dashboard, because
 * each is read by a different person for a different reason. Everything is
 * priced at LIST - the charge price for a consumable, the selling price for a
 * drug - and never at cost, because a charge item has no cost field: nobody
 * records what a box of gloves cost. Said on screen as well as in the code,
 * since a number labelled "value" is otherwise read as a balance-sheet figure.
 */
function ReportsTab() {
  const [view, setView] = useState<"position" | "consumption" | "variance">("position");
  const [range, setRange] = useState(defaultRange);
  const qs = `?from=${range.from}&to=${range.to}`;

  const position = useQuery({
    queryKey: ["ws-report-position"],
    queryFn: () => get<PositionReport>("/pharmacy/ward-stock/reports/position"),
    enabled: view === "position",
  });
  const consumption = useQuery({
    queryKey: ["ws-report-consumption", range.from, range.to],
    queryFn: () => get<ConsumptionReport>(`/pharmacy/ward-stock/reports/consumption${qs}`),
    enabled: view === "consumption",
  });
  const variance = useQuery({
    queryKey: ["ws-report-variance", range.from, range.to],
    queryFn: () => get<VarianceReport>(`/pharmacy/ward-stock/reports/variance${qs}`),
    enabled: view === "variance",
  });

  const active = view === "position" ? position : view === "consumption" ? consumption : variance;

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, alignItems: "center", flexWrap: "wrap" }}>
        <Tabs value={view} onChange={(_, v) => setView(v)} sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0 } }}>
          <Tab value="position" label="In the cupboards" sx={{ textTransform: "none", fontWeight: 700 }} />
          <Tab value="consumption" label="What was used" sx={{ textTransform: "none", fontWeight: 700 }} />
          <Tab value="variance" label="What went missing" sx={{ textTransform: "none", fontWeight: 700 }} />
        </Tabs>
        <Box sx={{ flex: 1 }} />
        {/* The position report is "right now" and has no window to choose. */}
        {view !== "position" && (
          <>
            <TextField
              size="small" type="date" label="From" value={range.from} InputLabelProps={{ shrink: true }}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            />
            <TextField
              size="small" type="date" label="To" value={range.to} InputLabelProps={{ shrink: true }}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            />
          </>
        )}
      </Box>

      {active.isError ? (
        <ErrorState message={apiErrorText(active.error)} onRetry={() => active.refetch()} />
      ) : active.isLoading || !active.data ? (
        <ListSkeleton rows={5} />
      ) : view === "position" ? (
        <PositionView data={position.data as PositionReport} />
      ) : view === "consumption" ? (
        <ConsumptionView data={consumption.data as ConsumptionReport} />
      ) : (
        <VarianceView data={variance.data as VarianceReport} />
      )}
    </Box>
  );
}

function PositionView({ data }: { data: PositionReport }) {
  if (!data.wards.length) return <Empty>No ward is holding any stock.</Empty>;
  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <Stat label="Units in cupboards" value={data.totals.units} color={SEMANTIC.info} />
        <Stat label="List value" value={formatINRAuto(data.totals.listValue)} color={SEMANTIC.success} />
        {data.totals.expiredUnits > 0 && <Stat label="Expired units" value={data.totals.expiredUnits} color={SEMANTIC.danger} />}
        {data.totals.expiringUnits > 0 && <Stat label="Expiring in 30 days" value={data.totals.expiringUnits} color={SEMANTIC.warning} />}
        {data.totals.belowPar > 0 && <Stat label="Lines below par" value={data.totals.belowPar} color={SEMANTIC.warning} />}
      </Box>

      {/* The one thing this report knows that no other report does. */}
      {data.totals.medicineUnitsOffValuation > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {data.totals.medicineUnitsOffValuation} drug unit{data.totals.medicineUnitsOffValuation === 1 ? "" : "s"} sit
          in ward cupboards. Issuing to a ward takes them out of pharmacy inventory, so they are not in the
          Stock Valuation report — the hospital's stock is that report plus this one.
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Ward</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Lines</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Units</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">List value</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Expired</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Expiring</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Below par</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.wards.map((w) => (
              <TableRow key={w.wardId} hover>
                <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{w.wardName}</Typography></TableCell>
                <TableCell align="right">{w.lines}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{w.units}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{formatINRAuto(w.listValue)}</TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: w.expiredUnits ? 800 : 400, color: w.expiredUnits ? SEMANTIC.danger : "text.disabled" }}>
                    {w.expiredUnits || "—"}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ color: w.expiringUnits ? SEMANTIC.warning : "text.disabled" }}>
                    {w.expiringUnits || "—"}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ color: w.belowPar ? SEMANTIC.warning : "text.disabled" }}>
                    {w.belowPar || "—"}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function ConsumptionView({ data }: { data: ConsumptionReport }) {
  if (!data.wards.length) return <Empty>Nothing was used out of a ward cupboard in this window.</Empty>;
  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <Stat label="Units used" value={data.totals.units} color={SEMANTIC.info} />
        <Stat label="Billed to patients" value={formatINRAuto(data.totals.billedValue)} color={SEMANTIC.success} />
        <Stat label="Absorbed as floor stock" value={formatINRAuto(data.totals.absorbedValue)} color={SEMANTIC.warning} />
      </Box>
      {/* Two numbers of different kinds, and reading the second as revenue lost
          would be wrong — it is the size of a decision, taken on purpose. */}
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
        Billed is what patients were actually charged. Absorbed is what the same units would have billed at
        list price had they not been marked floor stock — the size of that decision, not a loss.
        Prices exclude GST.
      </Typography>

      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto", mb: 2.5 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Ward</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Patients</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Units</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Billed</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Absorbed</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.wards.map((w) => (
              <TableRow key={w.wardId} hover>
                <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{w.wardName}</Typography></TableCell>
                <TableCell align="right">{w.patients}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{w.units}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatINRAuto(w.billedValue)}
                  <Typography component="span" variant="caption" sx={{ color: "text.secondary", ml: 0.5 }}>
                    ({w.billedUnits})
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatINRAuto(w.absorbedValue)}
                  <Typography component="span" variant="caption" sx={{ color: "text.secondary", ml: 0.5 }}>
                    ({w.absorbedUnits})
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {data.items.length > 0 && (
        <>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 1 }}>
            MOST USED · {data.items.length}
          </Typography>
          {data.items.map((i) => (
            <Box key={i.stockItemId}
              sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.8, borderBottom: "1px solid", borderColor: "divider" }}>
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }} noWrap>{i.name}</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>{formatINRAuto(i.value)}</Typography>
              <Typography variant="body2" sx={{ width: 90, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {units(i.units, i.unit)}
              </Typography>
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}

function VarianceView({ data }: { data: VarianceReport }) {
  if (!data.wards.length) return <Empty>No ward holds stock yet, so there is nothing to count.</Empty>;
  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <Stat label="Counts done" value={data.totals.counts} color={SEMANTIC.info} />
        <Stat label="Units short" value={data.totals.unitsShort} color={SEMANTIC.danger} />
        {data.totals.unitsOver > 0 && <Stat label="Units over" value={data.totals.unitsOver} color={SEMANTIC.warning} />}
        <Stat label="Value short" value={formatINRAuto(data.totals.shortValue)} color={SEMANTIC.danger} />
        {data.totals.wardsNeverCounted > 0 && (
          <Stat label="Never counted" value={data.totals.wardsNeverCounted} color={SEMANTIC.warning} />
        )}
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Ward</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Holding</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Counts</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Lines off</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Short</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Over</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Value short</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Last counted</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.wards.map((w) => (
              <TableRow key={w.wardId} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{w.wardName}</Typography>
                  {/* A ward nobody has counted is a finding, not an empty row. */}
                  {w.neverCounted && (
                    <Chip size="small" label="never counted"
                      sx={{ height: 18, fontSize: 11, fontWeight: 700, mt: 0.3, bgcolor: `${SEMANTIC.warning}1f`, color: SEMANTIC.warning }} />
                  )}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{w.unitsHeld}</TableCell>
                <TableCell align="right">{w.counts || "—"}</TableCell>
                <TableCell align="right">{w.off || "—"}</TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: w.unitsShort ? 800 : 400, color: w.unitsShort ? SEMANTIC.danger : "text.disabled" }}>
                    {w.unitsShort || "—"}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ color: w.unitsOver ? SEMANTIC.warning : "text.disabled" }}>
                    {w.unitsOver || "—"}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {w.unitsShort ? formatINRAuto(w.shortValue) : "—"}
                </TableCell>
                <TableCell align="right">
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {w.lastCountedAt ? formatDate(w.lastCountedAt) : "—"}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
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
      { label: "To reorder", node: <ReorderTab /> },
      { label: "Central store", node: <StoreTab /> },
      { label: "Movement log", node: <LogTab /> },
      { label: "Reports", node: <ReportsTab /> },
    ];

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: "-0.5px" }}>Ward Stock</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
          {isNurse
            ? "What this ward is holding, what it used, and sending back what it does not need."
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
