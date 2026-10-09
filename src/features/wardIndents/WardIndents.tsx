import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Paper, Typography, TextField, MenuItem, Button, Stack, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, Table, TableHead, TableBody, TableRow, TableCell,
} from "@mui/material";
import { AddRounded, SearchRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";
import { SEMANTIC } from "@/styles/accents";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";
import IndentCard, { type Indent } from "./IndentCard";

/**
 * Indents — the in-charge's (15_System_Roles NURSE_INCHARGE "indents"): ask
 * the pharmacy for stock for a ward they run. What the store issues lands in
 * the ward's cupboard (Ward Stock). Below-par items come first, already filled in.
 */

interface WardChoice { wardId: string; wardName: string; wardCode: string | null }
interface ItemChoice { stockItemId: string; name: string; unit: string | null; onHand: number; parLevel: number | null; suggest: number }

function NewIndentDialog({ ward, onClose, onDone }: { ward: WardChoice; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [qty, setQty] = useState<Record<string, string> | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const items = useQuery<ItemChoice[]>({
    queryKey: ["ward-indents", "items", ward.wardId],
    queryFn: async () => (await axiosInstance.get(`/ward-indents/wards/${ward.wardId}/items`)).data.data,
  });
  // Below par, already filled in: what it takes to get back to par.
  const quantities = qty ?? Object.fromEntries((items.data ?? []).filter((i) => i.suggest > 0).map((i) => [i.stockItemId, String(i.suggest)]));
  const set = (id: string, v: string) => setQty({ ...quantities, [id]: v.replace(/\D/g, "").slice(0, 5) });
  const lines = Object.entries(quantities).filter(([, v]) => Number(v) > 0).map(([stockItemId, v]) => ({ stockItemId, quantity: Number(v) }));
  const shown = (items.data ?? []).filter((i) => !search.trim() || i.name.toLowerCase().includes(search.trim().toLowerCase()));

  const send = async () => {
    setSaving(true);
    try {
      await axiosInstance.post("/ward-indents", { wardId: ward.wardId, notes: notes.trim() || undefined, lines });
      toast.success(`Indent sent to the pharmacy (${lines.length} item${lines.length === 1 ? "" : "s"})`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't send the indent"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 700 }}>New indent · {ward.wardName}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <TextField
            id="indent-search" size="small" placeholder="Find an item" value={search} onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }}
          />
          {items.isError ? (
            <Typography variant="body2" sx={{ color: SEMANTIC.danger }}>{getApiErrorMessage(items.error, "Couldn't load the items")}</Typography>
          ) : items.isLoading ? <ListSkeleton rows={4} /> : !items.data?.length ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>The pharmacy has not set up any ward-stock items yet.</Typography>
          ) : (
            <Box sx={{ maxHeight: 420, overflow: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell align="right">On the ward</TableCell>
                    <TableCell align="right">Par</TableCell>
                    <TableCell align="right" sx={{ width: 120 }}>Ask for</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shown.map((i) => (
                    <TableRow key={i.stockItemId} hover>
                      <TableCell>
                        {i.name}
                        {i.suggest > 0 && <Typography component="span" variant="caption" sx={{ color: SEMANTIC.warningDark, fontWeight: 700 }}> · below par</Typography>}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{i.onHand}{i.unit ? ` ${i.unit}` : ""}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", color: "text.secondary" }}>{i.parLevel ?? "—"}</TableCell>
                      <TableCell align="right">
                        <TextField
                          size="small" value={quantities[i.stockItemId] ?? ""} onChange={(e) => set(i.stockItemId, e.target.value)}
                          inputProps={{ inputMode: "numeric", "aria-label": `Ask for ${i.name}`, style: { textAlign: "right" } }} sx={{ width: 90 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
          <TextField id="indent-notes" label="Note for the pharmacy (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} inputProps={{ maxLength: 500 }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={send} disabled={saving || !lines.length}>
          {saving ? "Sending…" : `Send to pharmacy${lines.length ? ` (${lines.length})` : ""}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function WardIndents() {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [chosen, setWard] = useState("");
  const [raising, setRaising] = useState(false);
  const wards = useQuery<WardChoice[]>({
    queryKey: ["ward-indents", "wards"],
    queryFn: async () => (await axiosInstance.get("/ward-indents/wards")).data.data,
  });
  const wardId = chosen || wards.data?.[0]?.wardId || "";
  const ward = useMemo(() => wards.data?.find((w) => w.wardId === wardId) ?? null, [wards.data, wardId]);
  const list = useQuery<Indent[]>({
    queryKey: ["ward-indents", "list", wardId],
    queryFn: async () => (await axiosInstance.get(`/ward-indents/wards/${wardId}`)).data.data,
    enabled: !!wardId,
    refetchOnWindowFocus: true,
  });

  const cancel = async (indent: Indent) => {
    const ok = await confirm({ title: "Cancel this indent", message: "The pharmacy has not started on it. Cancel it?", confirmText: "Cancel indent" });
    if (!ok) return;
    try {
      await axiosInstance.post(`/ward-indents/${indent.indentId}/cancel`);
      toast.success("Indent cancelled");
      qc.invalidateQueries({ queryKey: ["ward-indents", "list", wardId] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't cancel the indent"));
    }
  };

  return (
    <Box sx={{ pb: 6 }}>
      <PageHeader
        title="Indents"
        subtitle="Ask the pharmacy for stock for your ward. What it issues lands in the ward's cupboard (Ward Stock)."
        actions={ward ? <Button variant="contained" startIcon={<AddRounded />} onClick={() => setRaising(true)}>New indent</Button> : undefined}
      />
      {wards.isError ? (
        <ErrorState title="Couldn't load your wards" message={apiErrorText(wards.error)} onRetry={() => wards.refetch()} />
      ) : wards.data && !wards.data.length ? (
        <Paper sx={{ p: 3 }}><Mascot pose="nothing-here-yet" title="No ward to raise indents for" subtitle="You raise indents for the wards you are in charge of, or posted to." /></Paper>
      ) : (
        <>
          {(wards.data?.length ?? 0) > 1 && (
            <TextField id="indent-ward" select size="small" label="Ward" value={wardId} onChange={(e) => setWard(e.target.value)} sx={{ minWidth: 240, mb: 2 }}>
              {wards.data!.map((w) => <MenuItem key={w.wardId} value={w.wardId}>{w.wardName}</MenuItem>)}
            </TextField>
          )}
          {list.isError ? (
            <ErrorState title="Couldn't load the indents" message={apiErrorText(list.error)} onRetry={() => list.refetch()} />
          ) : list.isLoading || !wardId ? <ListSkeleton rows={3} /> : !list.data?.length ? (
            <Paper sx={{ p: 3 }}><Mascot pose="nothing-here-yet" title="No indents in the last 30 days" /></Paper>
          ) : (
            <Stack spacing={1.5}>
              {list.data.map((i) => (
                <IndentCard
                  key={i.indentId} indent={i}
                  actions={i.status === "OPEN" && i.items.every((l) => !l.issued)
                    ? <Button size="small" color="inherit" onClick={() => cancel(i)}>Cancel</Button>
                    : undefined}
                />
              ))}
            </Stack>
          )}
        </>
      )}
      {raising && ward && <NewIndentDialog ward={ward} onClose={() => setRaising(false)} onDone={() => qc.invalidateQueries({ queryKey: ["ward-indents", "list", ward.wardId] })} />}
    </Box>
  );
}
