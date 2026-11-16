import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Typography, Box, Alert, Stack,
} from "@mui/material";
import { CloudOffRounded, PrintRounded } from "@mui/icons-material";
import { formatINRAuto } from "@/utils/format";

const inr = formatINRAuto;

export type CollectMethod = { label: string; value: string; id?: number };

/**
 * Taking the money with no network ("bill and collect", Option A): the screen's
 * own total, the method, one save that waits on this computer. The bill and the
 * receipt are made when the network is back - at the server's figure, and only
 * if it is within Rs 1 of what was collected here (otherwise the save comes
 * back under "needs attention", nothing billed). A slip says so to the patient.
 */
export default function OfflineCollectDialog({ open, onClose, title, patientName, lines, total, methods, onCollect }: {
  open: boolean;
  onClose: () => void;
  title: string;
  patientName: string;
  lines: { name: string; amount: number }[];
  total: number;
  methods: CollectMethod[];
  /** Makes the one save; true once it is kept (or sent). */
  onCollect: (m: CollectMethod) => Promise<boolean>;
}) {
  const [method, setMethod] = useState<CollectMethod | null>(methods[0] ?? null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ at: Date; method: CollectMethod } | null>(null);

  const collect = async () => {
    if (!method) return;
    setSaving(true);
    try {
      if (await onCollect(method)) setDone({ at: new Date(), method });
    } finally {
      setSaving(false);
    }
  };
  const close = () => { setDone(null); onClose(); };

  return (
    <Dialog open={open} onClose={saving ? undefined : close} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <CloudOffRounded sx={{ color: "warning.main" }} /> {title}
      </DialogTitle>
      <DialogContent dividers>
        {!done ? (
          <Stack spacing={1.5}>
            <Alert severity="warning" sx={{ py: 0 }}>
              No network. Collect the amount below - the bill and receipt are made when the network is back.
            </Alert>
            <Box>
              {lines.map((l, i) => (
                <Box key={i} sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", py: 0.25 }}>
                  <span>{l.name}</span><span>{inr(l.amount)}</span>
                </Box>
              ))}
              <Box sx={{ display: "flex", justifyContent: "space-between", fontWeight: 800, borderTop: "1px solid", borderColor: "divider", mt: 0.5, pt: 0.5 }}>
                <span>Collect</span><span>{inr(total)}</span>
              </Box>
            </Box>
            <TextField select size="small" label="Paid by" value={method?.value ?? ""} onChange={(e) => setMethod(methods.find((m) => m.value === e.target.value) ?? null)}>
              {methods.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
            </TextField>
          </Stack>
        ) : (
          <Stack spacing={1}>
            <Typography sx={{ fontWeight: 700 }}>{inr(total)} collected by {done.method.label}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Saved on this computer at {done.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. The bill and receipt are made when the network is back.
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {!done ? (
          <>
            <Button onClick={close} disabled={saving}>Cancel</Button>
            <Button variant="contained" onClick={collect} disabled={saving || !method || !(total > 0)}>Collect {inr(total)}</Button>
          </>
        ) : (
          <>
            <Button startIcon={<PrintRounded />} onClick={() => printSlip({ patientName, lines, total, method: done.method.label, at: done.at })}>Print slip</Button>
            <Button variant="contained" onClick={close}>Done</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** A plain slip: what was collected, and that the receipt follows. */
function printSlip(s: { patientName: string; lines: { name: string; amount: number }[]; total: number; method: string; at: Date }) {
  const w = window.open("", "_blank", "width=380,height=560");
  if (!w) return;
  const rows = s.lines.map((l) => `<tr><td>${esc(l.name)}</td><td style="text-align:right">${esc(inr(l.amount))}</td></tr>`).join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Payment slip</title>
<style>body{font:13px system-ui,sans-serif;margin:16px}h1{font-size:15px;margin:0 0 4px}table{width:100%;border-collapse:collapse}td{padding:2px 0}
.t td{border-top:1px solid #000;font-weight:700;padding-top:4px}.n{margin-top:12px;font-size:12px}</style></head><body>
<h1>Payment received - receipt to follow</h1>
<div>${esc(s.patientName)}</div><div>${esc(s.at.toLocaleString())}</div><br>
<table>${rows}<tr class="t"><td>Paid by ${esc(s.method)}</td><td style="text-align:right">${esc(inr(s.total))}</td></tr></table>
<div class="n">Taken while the hospital network was down. The bill and receipt will be issued when the network is back.</div>
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}
