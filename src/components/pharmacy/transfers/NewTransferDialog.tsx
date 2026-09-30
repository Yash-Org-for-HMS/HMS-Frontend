import { useState } from "react";
import {
  Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import { DeleteOutlineRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import type { TransferBranch, TransferDetail } from "./transfers.types";

interface Line { medicineId: string; medicineName: string; quantity: string }

/**
 * Start a transfer. Working at a branch, it is one of two things: asking
 * another branch for stock, or sending stock to one. With no branch picked (a
 * hospital admin looking at the whole group) both ends are chosen.
 *
 * Mount it only while it is open: its form starts from the props each time.
 */
export default function NewTransferDialog({ open, onClose, onCreated, branches, here, medicines, prefill }: {
  open: boolean;
  onClose: () => void;
  onCreated: (t: TransferDetail) => void;
  branches: TransferBranch[];
  /** The branch the user is working at, if they picked one. */
  here: string | null;
  medicines: { medicineId: string; medicineName: string; genericName?: string }[];
  /** Lines to start with — the medicines low at this branch. */
  prefill?: Line[];
}) {
  const toast = useToast();
  const [mode, setMode] = useState<"ask" | "send">("ask");
  const [other, setOther] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [lines, setLines] = useState<Line[]>(() => prefill ?? []);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const others = branches.filter((b) => b.branchId !== here);
  const fromId = here ? (mode === "ask" ? other : here) : from;
  const toId = here ? (mode === "ask" ? here : other) : to;

  const submit = async () => {
    if (!fromId || !toId) { toast.error(here ? "Choose the other branch." : "Choose both branches."); return; }
    if (fromId === toId) { toast.error("Choose two different branches."); return; }
    const items = lines.map((l) => ({ medicineId: l.medicineId, quantity: Number(l.quantity) }));
    if (!items.length) { toast.error("Add at least one medicine."); return; }
    if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity <= 0)) { toast.error("Every line needs a whole quantity above zero."); return; }
    setBusy(true);
    try {
      const r = await axiosInstance.post("/pharmacy/stock-transfers", { fromBranchId: fromId, toBranchId: toId, items, notes: notes.trim() || undefined });
      toast.success(`Transfer ${r.data.data.transferNumber} raised`);
      onCreated(r.data.data);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Couldn't raise the transfer"));
    } finally { setBusy(false); }
  };

  const branchSelect = (id: string, label: string, value: string, set: (v: string) => void, list: TransferBranch[]) => (
    <TextField id={id} select size="small" label={label} value={value} onChange={(e) => set(e.target.value)} sx={{ minWidth: 240, flex: 1 }}>
      {list.map((b) => <MenuItem key={b.branchId} value={b.branchId}>{b.branchName}</MenuItem>)}
    </TextField>
  );

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New stock transfer</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {here ? (
          <>
            <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)} aria-label="Transfer direction">
              <ToggleButton value="ask" sx={{ textTransform: "none", fontWeight: 600 }}>Ask a branch for stock</ToggleButton>
              <ToggleButton value="send" sx={{ textTransform: "none", fontWeight: 600 }}>Send stock to a branch</ToggleButton>
            </ToggleButtonGroup>
            {branchSelect("transfer-other", mode === "ask" ? "Ask which branch" : "Send to which branch", other, setOther, others)}
            <Typography variant="caption" sx={{ color: "text.secondary", mt: -1 }}>
              {mode === "ask"
                ? "The other branch picks the batches and sends them; you receive them here."
                : "You pick the batches next; the other branch receives them."}
            </Typography>
          </>
        ) : (
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {branchSelect("transfer-from", "From", from, setFrom, branches)}
            {branchSelect("transfer-to", "To", to, setTo, branches.filter((b) => b.branchId !== from))}
          </Box>
        )}

        <Autocomplete
          id="transfer-add-medicine"
          options={medicines.filter((m) => !lines.some((l) => l.medicineId === m.medicineId))}
          getOptionLabel={(m) => `${m.medicineName}${m.genericName ? ` (${m.genericName})` : ""}`}
          value={null}
          onChange={(_, m) => m && setLines((ls) => [...ls, { medicineId: m.medicineId, medicineName: m.medicineName, quantity: "" }])}
          renderInput={(params) => <TextField {...params} size="small" label="Add a medicine" placeholder="Search by name or generic…" />}
        />

        {lines.length > 0 && (
          <Table size="small">
            <TableHead><TableRow>
              <TableCell sx={{ fontWeight: 700, color: "text.secondary" }}>Medicine</TableCell>
              <TableCell sx={{ fontWeight: 700, color: "text.secondary" }} align="right">Quantity</TableCell>
              <TableCell />
            </TableRow></TableHead>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={l.medicineId}>
                  <TableCell sx={{ fontWeight: 600 }}>{l.medicineName}</TableCell>
                  <TableCell align="right">
                    <TextField
                      id={`transfer-qty-${l.medicineId}`} size="small" value={l.quantity} autoFocus={!l.quantity && i === lines.length - 1}
                      onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, quantity: e.target.value.replace(/\D/g, "") } : x)))}
                      inputProps={{ inputMode: "numeric", style: { textAlign: "right" }, "aria-label": `Quantity of ${l.medicineName}` }}
                      sx={{ width: 100 }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ width: 48 }}>
                    <IconButton size="small" aria-label={`Remove ${l.medicineName}`} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                      <DeleteOutlineRounded fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <TextField id="transfer-notes" size="small" label="Note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={1} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy || !lines.length}>
          {busy ? "Raising…" : here && mode === "send" ? "Next: pick batches" : "Raise request"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
