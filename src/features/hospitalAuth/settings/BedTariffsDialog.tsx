import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Table, TableHead,
  TableRow, TableCell, TableBody, TableContainer, InputAdornment, Alert, Collapse, Chip,
  MenuItem,
} from "@mui/material";
import { PaymentsRounded, HistoryRounded, AddRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { useToast } from "@/providers/ToastContext";
import { getApiErrorMessage } from "@/utils/apiError";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { BRAND } from "@/styles/accents";

/**
 * Bed tariffs: what a bed-day costs, per room class and payer type — room rent
 * plus a nursing charge — from a date (workbook data model: bed_tariffs).
 *
 * Saving never overwrites a price: the tariff in force is closed the day the
 * new one starts, so a stay is billed at the rate of each of its days. With no
 * tariff for a payer, the cash tariff applies; with no tariff at all, a bed's
 * own daily charge — exactly how billing worked before tariffs existed.
 *
 * Replaces the old per-class "room rent" box: a cash rent saved here is also
 * the Schedule-of-Charges room rent and each bed's daily charge.
 */

interface Tariff { tariffId: string; roomClassId: string; payerType: string; roomRent: string | number; nursingCharge: string | number; effectiveFrom: string; effectiveTo: string | null }
interface TariffsResponse {
  payerTypes: { code: string; label: string }[];
  roomClasses: { roomClassId: string; name: string; isActive: boolean }[];
  current: Tariff[];
  upcoming: Tariff[];
  history: Tariff[];
  /** For a branch: the group's tariffs in force, which it follows where it has none. */
  groupCurrent?: Tariff[];
}
type Cell = { rent: string; nursing: string };
const key = (rc: string, p: string) => `${rc}|${p}`;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const short = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function BedTariffsDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [from, setFrom] = useState(ymd(new Date()));
  /** Only what the user has typed; untouched cells show the tariff in force. */
  const [edits, setEdits] = useState<Record<string, Cell>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [newClass, setNewClass] = useState("");
  // "" = the group's tariffs (every branch without its own); else one branch's.
  const { availableBranches, isOrgAdmin, activeBranchId } = useHospitalAuth();
  const multiBranch = availableBranches.length > 1;
  const [branchId, setBranchId] = useState<string>(isOrgAdmin ? "" : activeBranchId ?? "");

  const { data, isLoading, refetch } = useQuery<TariffsResponse>({
    queryKey: ["bed-tariffs", branchId],
    queryFn: async () => (await axiosInstance.get("/ipd/bed-tariffs", { params: branchId ? { branchId } : {} })).data.data,
  });
  const group = new Map((data?.groupCurrent ?? []).map((t) => [key(t.roomClassId, t.payerType), t]));
  const current = new Map((data?.current ?? []).map((t) => [key(t.roomClassId, t.payerType), t]));
  const upcoming = new Map((data?.upcoming ?? []).map((t) => [key(t.roomClassId, t.payerType), t]));
  const cellOf = (k: string): Cell => {
    if (edits[k]) return edits[k];
    const t = current.get(k);
    return { rent: t ? String(Number(t.roomRent)) : "", nursing: t ? String(Number(t.nursingCharge)) : "" };
  };

  const changed: { roomClassId: string; payerType: string; roomRent: number; nursingCharge: number }[] = [];
  if (data) {
    for (const rc of data.roomClasses) for (const p of data.payerTypes) {
      const k = key(rc.roomClassId, p.code);
      const c = cellOf(k);
      if (c.rent.trim() === "") continue;
      const t = current.get(k);
      const rent = Number(c.rent), nursing = Number(c.nursing || 0);
      if (!Number.isFinite(rent) || rent < 0 || !Number.isFinite(nursing) || nursing < 0) continue;
      if (t && Number(t.roomRent) === rent && Number(t.nursingCharge) === nursing) continue;
      changed.push({ roomClassId: rc.roomClassId, payerType: p.code, roomRent: rent, nursingCharge: nursing });
    }
  }

  const save = async () => {
    setSaving(true);
    try {
      const r = await axiosInstance.put("/ipd/bed-tariffs", { effectiveFrom: from, rows: changed, ...(branchId ? { branchId } : {}) });
      toast.success(r.data.message ?? "Tariffs saved");
      onDone();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Couldn't save the tariffs"));
    } finally {
      setSaving(false);
    }
  };

  const addClass = async () => {
    if (!newClass.trim()) return;
    try {
      await axiosInstance.post("/hospital/soc/room-classes", { name: newClass.trim() });
      setNewClass("");
      refetch();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Couldn't add that room class"));
    }
  };

  const name = (id: string) => data?.roomClasses.find((c) => c.roomClassId === id)?.name ?? "Room class";
  const payer = (code: string) => data?.payerTypes.find((p) => p.code === code)?.label ?? code;

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <PaymentsRounded sx={{ color: BRAND.action }} /> Bed tariffs — room rent and nursing, per day
      </DialogTitle>
      <DialogContent dividers>
        {isLoading || !data ? <ListSkeleton rows={4} /> : (
          <>
            {multiBranch && (
              <TextField id="tariff-scope" select size="small" label="Tariffs for" value={branchId} sx={{ mb: 2, minWidth: 280 }}
                onChange={(e) => { setBranchId(e.target.value); setEdits({}); }} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
                {isOrgAdmin && <MenuItem value="">The group (every branch without its own)</MenuItem>}
                {availableBranches.map((b) => <MenuItem key={b.branchId} value={b.branchId}>{b.branchName}</MenuItem>)}
              </TextField>
            )}
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
              {branchId
                ? "This branch's own tariffs. A blank cell follows the group's tariff, shown in grey."
                : "Each stay is billed at the tariff for its bed's room class and its payer type, day by day. Leave a payer blank to bill it at the cash tariff."}
            </Typography>
            {data.roomClasses.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>No room classes switched on yet. Add one below, or switch on a standard bed category in Schedule of Charges → Room classes.</Alert>
            ) : (
              <TableContainer sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Room class</TableCell>
                      {data.payerTypes.map((p) => <TableCell key={p.code} sx={{ fontWeight: 700, minWidth: 200 }}>{p.label}</TableCell>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.roomClasses.map((rc) => (
                      <TableRow key={rc.roomClassId}>
                        <TableCell sx={{ fontWeight: 600, verticalAlign: "top", pt: 2 }}>
                          {rc.name}{!rc.isActive && <Chip label="switched off" size="small" sx={{ ml: 1, height: 18 }} />}
                        </TableCell>
                        {data.payerTypes.map((p) => {
                          const k = key(rc.roomClassId, p.code);
                          const c = cellOf(k);
                          const next = upcoming.get(k);
                          const set = (field: keyof Cell, v: string) => setEdits((prev) => ({ ...prev, [k]: { ...c, [field]: v } }));
                          return (
                            <TableCell key={p.code} sx={{ verticalAlign: "top" }}>
                              <Box sx={{ display: "flex", gap: 1 }}>
                                <TextField size="small" type="number" placeholder={group.get(k) ? String(Number(group.get(k)!.roomRent)) : p.code === "CASH" ? "Rent" : "cash"} value={c.rent} onChange={(e) => set("rent", e.target.value)}
                                  slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> }, htmlInput: { min: 0, "aria-label": `${rc.name} ${p.label} rent` } }} sx={{ width: 120 }} />
                                <TextField size="small" type="number" placeholder="Nursing" value={c.nursing} onChange={(e) => set("nursing", e.target.value)}
                                  slotProps={{ htmlInput: { min: 0, "aria-label": `${rc.name} ${p.label} nursing` } }} sx={{ width: 110 }} />
                              </Box>
                              {next && (
                                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                                  From {short(next.effectiveFrom)}: ₹{Number(next.roomRent)} + ₹{Number(next.nursingCharge)}
                                </Typography>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
              <TextField size="small" type="date" label="Changes take effect from" value={from} onChange={(e) => setFrom(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: ymd(new Date()) } }}
                helperText="Today or later. Days already stayed keep the rate they had." sx={{ width: 260 }} />
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", ml: "auto" }}>
                <TextField size="small" placeholder="Add a room class (e.g. Deluxe)" value={newClass} onChange={(e) => setNewClass(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addClass(); } }} sx={{ width: 240 }} />
                <Button startIcon={<AddRounded />} onClick={addClass} disabled={!newClass.trim()} sx={{ textTransform: "none" }}>Add</Button>
              </Box>
            </Box>

            {data.history.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Button size="small" startIcon={<HistoryRounded />} onClick={() => setShowHistory((v) => !v)} sx={{ textTransform: "none" }}>
                  {showHistory ? "Hide" : "Show"} earlier tariffs ({data.history.length})
                </Button>
                <Collapse in={showHistory}>
                  <Table size="small" sx={{ mt: 1 }}>
                    <TableBody>
                      {data.history.map((t) => (
                        <TableRow key={t.tariffId}>
                          <TableCell>{name(t.roomClassId)}</TableCell>
                          <TableCell>{payer(t.payerType)}</TableCell>
                          <TableCell>₹{Number(t.roomRent)} + ₹{Number(t.nursingCharge)} nursing</TableCell>
                          <TableCell sx={{ color: "text.secondary" }}>{short(t.effectiveFrom)} – {t.effectiveTo ? short(t.effectiveTo) : "…"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Collapse>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Typography variant="caption" sx={{ color: "text.secondary", mr: "auto" }}>
          {changed.length ? `${changed.length} change${changed.length === 1 ? "" : "s"} to save` : "No changes"}
        </Typography>
        <Button onClick={onClose} color="inherit" disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !changed.length}>{saving ? "Saving…" : "Save tariffs"}</Button>
      </DialogActions>
    </Dialog>
  );
}
