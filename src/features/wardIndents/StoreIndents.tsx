import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box, Paper, Typography, TextField, Button, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, Table, TableHead, TableBody, TableRow, TableCell,
} from "@mui/material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import { SEMANTIC } from "@/styles/accents";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";
import IndentCard, { type Indent } from "./IndentCard";

/**
 * The store's side of ward indents (Ward Stock → Indents): every indent still
 * open in the branch, oldest first. Issue what can be sent — through the same
 * issue as any issue to a ward, oldest-expiring batch first — and close what
 * cannot be supplied, saying why.
 */

const OPEN_INDENTS_KEY = ["ward-indents", "open"] as const;

function IssueDialog({ indent, onClose, onDone }: { indent: Indent; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const open = indent.items.filter((l) => l.remaining > 0);
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(open.map((l) => [l.indentItemId, String(Math.max(0, Math.min(l.remaining, l.inStore)))])));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const lines = open.map((l) => ({ indentItemId: l.indentItemId, quantity: Number(qty[l.indentItemId] || 0) })).filter((l) => l.quantity > 0);
  const over = open.some((l) => Number(qty[l.indentItemId] || 0) > l.remaining);

  const issue = async () => {
    setSaving(true);
    try {
      await axiosInstance.post(`/ward-indents/${indent.indentId}/issue`, { notes: notes.trim() || undefined, lines });
      toast.success(`Issued to ${indent.wardName}`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't issue"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Issue to {indent.wardName}</DialogTitle>
      <DialogContent dividers>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell align="right">Still to send</TableCell>
              <TableCell align="right">In store</TableCell>
              <TableCell align="right" sx={{ width: 110 }}>Send now</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {open.map((l) => {
              const n = Number(qty[l.indentItemId] || 0);
              return (
                <TableRow key={l.indentItemId}>
                  <TableCell>{l.name}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{l.remaining}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", color: l.inStore < l.remaining ? SEMANTIC.danger : "text.secondary" }}>{l.inStore}</TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small" value={qty[l.indentItemId] ?? ""} error={n > l.remaining}
                      onChange={(e) => setQty((s) => ({ ...s, [l.indentItemId]: e.target.value.replace(/\D/g, "").slice(0, 5) }))}
                      inputProps={{ inputMode: "numeric", "aria-label": `Send now: ${l.name}`, style: { textAlign: "right" } }} sx={{ width: 80 }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {over && <Typography variant="body2" sx={{ mt: 1, color: SEMANTIC.danger }}>A line is more than the ward still asked for.</Typography>}
        <TextField id="indent-issue-notes" label="Note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth sx={{ mt: 2 }} inputProps={{ maxLength: 500 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={issue} disabled={saving || over || !lines.length}>{saving ? "Issuing…" : "Issue"}</Button>
      </DialogActions>
    </Dialog>
  );
}

function CloseDialog({ indent, onClose, onDone }: { indent: Indent; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const close = async () => {
    setSaving(true);
    try {
      await axiosInstance.post(`/ward-indents/${indent.indentId}/close`, { reason: reason.trim() });
      toast.success("Indent closed");
      onDone();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't close the indent"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>Close what cannot be sent</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
          {indent.wardName} will see this indent as closed short, with your reason.
        </Typography>
        <TextField id="indent-close-reason" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} fullWidth autoFocus inputProps={{ maxLength: 300 }} placeholder="e.g. Out of stock — supplier delay" />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" color="error" onClick={close} disabled={saving || !reason.trim()}>Close indent</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function StoreIndents() {
  const qc = useQueryClient();
  const [issuing, setIssuing] = useState<Indent | null>(null);
  const [closing, setClosing] = useState<Indent | null>(null);
  const q = useQuery<Indent[]>({
    queryKey: [...OPEN_INDENTS_KEY],
    queryFn: async () => (await axiosInstance.get("/ward-indents/open")).data.data,
    refetchOnWindowFocus: true,
  });
  const done = () => {
    qc.invalidateQueries({ queryKey: [...OPEN_INDENTS_KEY] });
    qc.invalidateQueries({ queryKey: ["ward-indents-open-count"] });
  };

  if (q.isError) return <ErrorState title="Couldn't load the indents" message={apiErrorText(q.error)} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <ListSkeleton rows={3} />;
  if (!q.data?.length) return <Paper variant="outlined" sx={{ p: 3 }}><Mascot pose="all-caught-up" title="No ward is waiting on an indent" /></Paper>;

  return (
    <Box>
      <Stack spacing={1.5}>
        {q.data.map((i) => (
          <IndentCard
            key={i.indentId} indent={i} store
            actions={
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button size="small" color="inherit" onClick={() => setClosing(i)}>Close short</Button>
                <Button size="small" variant="contained" onClick={() => setIssuing(i)}>Issue</Button>
              </Box>
            }
          />
        ))}
      </Stack>
      {issuing && <IssueDialog indent={issuing} onClose={() => setIssuing(null)} onDone={done} />}
      {closing && <CloseDialog indent={closing} onClose={() => setClosing(null)} onDone={done} />}
    </Box>
  );
}
