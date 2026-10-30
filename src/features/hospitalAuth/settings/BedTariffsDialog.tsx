import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Table, TableHead,
  TableRow, TableCell, TableBody, TableContainer, InputAdornment, Alert, Collapse, Chip,
  MenuItem, Autocomplete,
} from "@mui/material";
import { PaymentsRounded, HistoryRounded, AddRounded, ListAltRounded, DeleteOutlineRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { useToast } from "@/providers/ToastContext";
import { getApiErrorMessage } from "@/utils/apiError";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { BRAND } from "@/styles/accents";

/**
 * Bed tariffs: what a bed-day costs, per room class and payer type - room rent
 * plus a nursing charge - from a date (workbook data model: bed_tariffs).
 *
 * Saving never overwrites a price: the tariff in force is closed the day the
 * new one starts, so a stay is billed at the rate of each of its days. With no
 * tariff for a payer, the cash tariff applies; with no tariff at all, a bed's
 * own daily charge - exactly how billing worked before tariffs existed.
 *
 * Replaces the old per-class "room rent" box: a cash rent saved here is also
 * the Schedule-of-Charges room rent and each bed's daily charge.
 *
 * Payer rate lists (e.g. "Paramount TPA Rates") are columns of their own: an
 * insured stay whose claim's payer is on a list is billed the list's rent,
 * else the Insurance column's. The hospital admin names the lists and puts
 * the payers on them under "Rate lists".
 */

interface Tariff { tariffId: string; roomClassId: string; payerType: string; rateListId?: string | null; roomRent: string | number; nursingCharge: string | number; effectiveFrom: string; effectiveTo: string | null }
interface TariffsResponse {
  payerTypes: { code: string; label: string }[];
  rateLists: RateList[];
  payers: { payerId: string; payerName: string; payerType: string }[];
  roomClasses: { roomClassId: string; name: string; isActive: boolean }[];
  current: Tariff[];
  upcoming: Tariff[];
  history: Tariff[];
  /** For a branch: the group's tariffs in force, which it follows where it has none. */
  groupCurrent?: Tariff[];
}
interface RateList { rateListId: string; name: string; payerIds: string[] }
type Cell = { rent: string; nursing: string };
const key = (rc: string, p: string) => `${rc}|${p}`;
/** A column: a payer type, or a rate list ("RL:" + its id). */
const colOf = (t: { payerType: string; rateListId?: string | null }) => (t.rateListId ? `RL:${t.rateListId}` : t.payerType);
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
  const [listsOpen, setListsOpen] = useState(false);
  // "" = the group's tariffs (every branch without its own); else one branch's.
  const { availableBranches, isOrgAdmin, activeBranchId } = useHospitalAuth();
  const multiBranch = availableBranches.length > 1;
  const [branchId, setBranchId] = useState<string>(isOrgAdmin ? "" : activeBranchId ?? "");

  const { data, isLoading, refetch } = useQuery<TariffsResponse>({
    queryKey: ["bed-tariffs", branchId],
    queryFn: async () => (await axiosInstance.get("/ipd/bed-tariffs", { params: branchId ? { branchId } : {} })).data.data,
  });
  const group = new Map((data?.groupCurrent ?? []).map((t) => [key(t.roomClassId, colOf(t)), t]));
  const current = new Map((data?.current ?? []).map((t) => [key(t.roomClassId, colOf(t)), t]));
  const upcoming = new Map((data?.upcoming ?? []).map((t) => [key(t.roomClassId, colOf(t)), t]));
  const columns = [
    ...(data?.payerTypes ?? []).map((p) => ({ code: p.code, label: p.label, rateListId: null as string | null })),
    ...(data?.rateLists ?? []).map((l) => ({ code: `RL:${l.rateListId}`, label: l.name, rateListId: l.rateListId as string | null })),
  ];
  const cellOf = (k: string): Cell => {
    if (edits[k]) return edits[k];
    const t = current.get(k);
    return { rent: t ? String(Number(t.roomRent)) : "", nursing: t ? String(Number(t.nursingCharge)) : "" };
  };

  const changed: { roomClassId: string; payerType: string; rateListId?: string; roomRent: number; nursingCharge: number }[] = [];
  if (data) {
    for (const rc of data.roomClasses) for (const p of columns) {
      const k = key(rc.roomClassId, p.code);
      const c = cellOf(k);
      if (c.rent.trim() === "") continue;
      const t = current.get(k);
      const rent = Number(c.rent), nursing = Number(c.nursing || 0);
      if (!Number.isFinite(rent) || rent < 0 || !Number.isFinite(nursing) || nursing < 0) continue;
      if (t && Number(t.roomRent) === rent && Number(t.nursingCharge) === nursing) continue;
      changed.push(p.rateListId
        ? { roomClassId: rc.roomClassId, payerType: "INSURANCE", rateListId: p.rateListId, roomRent: rent, nursingCharge: nursing }
        : { roomClassId: rc.roomClassId, payerType: p.code, roomRent: rent, nursingCharge: nursing });
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
  const payer = (t: Tariff) => (t.rateListId ? data?.rateLists?.find((l) => l.rateListId === t.rateListId)?.name : data?.payerTypes.find((p) => p.code === t.payerType)?.label) ?? t.payerType;

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <PaymentsRounded sx={{ color: BRAND.action }} /> Bed tariffs - room rent and nursing
      </DialogTitle>
      <DialogContent dividers>
        {isLoading || !data ? <ListSkeleton rows={4} /> : (
          <>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
              Each rate is per the ward's billing unit: per day in most wards, per hour in recovery and observation, per session in daycare and dialysis, per visit in emergency.
            </Typography>
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
                : "Each stay is billed at the tariff for its bed's room class and its payer type, day by day. Leave a payer blank to bill it at the cash tariff. An insured stay whose payer is on a rate list is billed the list's rent; a blank list cell bills the Insurance rent."}
            </Typography>
            {isOrgAdmin && !branchId && (
              <Box sx={{ mb: 2 }}>
                <Button size="small" startIcon={<ListAltRounded />} onClick={() => setListsOpen((v) => !v)} sx={{ textTransform: "none" }}>
                  Rate lists ({data.rateLists?.length ?? 0})
                </Button>
                <Collapse in={listsOpen} unmountOnExit>
                  <RateListsEditor rateLists={data.rateLists ?? []} payers={data.payers ?? []} onSaved={() => { setListsOpen(false); refetch(); }} />
                </Collapse>
              </Box>
            )}
            {data.roomClasses.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>No room classes switched on yet. Add one below, or switch on a standard bed category in Schedule of Charges → Room classes.</Alert>
            ) : (
              <TableContainer sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Room class</TableCell>
                      {columns.map((p) => (
                        <TableCell key={p.code} sx={{ fontWeight: 700, minWidth: 200 }}>
                          {p.label}
                          {p.rateListId && <Typography variant="caption" sx={{ display: "block", color: "text.secondary", fontWeight: 400 }}>Rate list · {data.rateLists?.find((l) => l.rateListId === p.rateListId)?.payerIds.length ?? 0} payers</Typography>}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.roomClasses.map((rc) => (
                      <TableRow key={rc.roomClassId}>
                        <TableCell sx={{ fontWeight: 600, verticalAlign: "top", pt: 2 }}>
                          {rc.name}{!rc.isActive && <Chip label="switched off" size="small" sx={{ ml: 1, height: 18 }} />}
                        </TableCell>
                        {columns.map((p) => {
                          const k = key(rc.roomClassId, p.code);
                          const c = cellOf(k);
                          const next = upcoming.get(k);
                          const set = (field: keyof Cell, v: string) => setEdits((prev) => ({ ...prev, [k]: { ...c, [field]: v } }));
                          return (
                            <TableCell key={p.code} sx={{ verticalAlign: "top" }}>
                              <Box sx={{ display: "flex", gap: 1 }}>
                                <TextField size="small" type="number" placeholder={group.get(k) ? String(Number(group.get(k)!.roomRent)) : p.code === "CASH" ? "Rent" : p.rateListId ? "insurance" : "cash"} value={c.rent} onChange={(e) => set("rent", e.target.value)}
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
                          <TableCell>{payer(t)}</TableCell>
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

/**
 * The hospital admin's rate lists and the payers on each, saved whole. A payer
 * is on one list at most; a list with rents cannot be removed (the server says so).
 */
// Also on the Insurance & TPA page.
export function RateListsEditor({ rateLists, payers, onSaved }: { rateLists: RateList[]; payers: TariffsResponse["payers"]; onSaved: () => void }) {
  const toast = useToast();
  const [lists, setLists] = useState<{ rateListId: string | null; name: string; payerIds: string[] }[]>(() => rateLists.map((l) => ({ ...l })));
  const [saving, setSaving] = useState(false);
  const byId = new Map(payers.map((p) => [p.payerId, p]));
  const taken = (i: number) => new Set(lists.flatMap((l, j) => (j === i ? [] : l.payerIds)));
  const set = (i: number, patch: Partial<(typeof lists)[number]>) => setLists((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const save = async () => {
    setSaving(true);
    try {
      await axiosInstance.put("/ipd/bed-tariffs/rate-lists", { rateLists: lists.map((l) => ({ ...l, name: l.name.trim() })) });
      toast.success("Rate lists saved");
      onSaved();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Couldn't save the rate lists"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ mt: 1, p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        A rate list is the room rent an insurer or TPA has agreed with the hospital. Put each payer on the list it bills by; a payer on no list is billed the Insurance rent.
      </Typography>
      {lists.map((l, i) => (
        <Box key={l.rateListId ?? `new-${i}`} sx={{ display: "flex", gap: 1, alignItems: "flex-start", mb: 1.5 }}>
          <TextField size="small" label="Rate list" value={l.name} onChange={(e) => set(i, { name: e.target.value })} slotProps={{ htmlInput: { maxLength: 80 } }} sx={{ width: 220 }} />
          <Autocomplete multiple size="small" sx={{ flex: 1 }}
            options={payers.filter((p) => !taken(i).has(p.payerId)).map((p) => p.payerId)}
            value={l.payerIds.filter((id) => byId.has(id))}
            getOptionLabel={(id) => byId.get(id)?.payerName ?? id}
            onChange={(_, v) => set(i, { payerIds: v })}
            renderInput={(params) => <TextField {...params} label="Payers on this list" />} />
          <Button color="inherit" onClick={() => setLists((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove ${l.name || "rate list"}`} sx={{ minWidth: 0, mt: 0.5 }}>
            <DeleteOutlineRounded fontSize="small" />
          </Button>
        </Box>
      ))}
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button size="small" startIcon={<AddRounded />} onClick={() => setLists((prev) => [...prev, { rateListId: null, name: "", payerIds: [] }])} sx={{ textTransform: "none" }}>Add a rate list</Button>
        <Button size="small" variant="contained" onClick={save} disabled={saving || lists.some((l) => !l.name.trim())} sx={{ ml: "auto" }}>
          {saving ? "Saving…" : "Save rate lists"}
        </Button>
      </Box>
    </Box>
  );
}
