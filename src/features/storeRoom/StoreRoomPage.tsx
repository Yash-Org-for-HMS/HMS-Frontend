import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, InputAdornment,
  MenuItem, Paper, Stack, Switch, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Tooltip, Typography,
} from "@mui/material";
import { AddRounded, EditRounded, Inventory2Rounded, RemoveCircleOutlineRounded, SearchRounded, FactCheckRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import PageHeader from "@/components/layout/PageHeader";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import DetailSkeleton from "@/components/skeletons/DetailSkeleton";
import { useToast } from "@/providers/ToastContext";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { hasRole } from "@/constants/roles";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { formatDateTime } from "@/utils/format";
import { SEMANTIC } from "@/styles/accents";

// The store room (backend storeRoom.service): what a branch keeps that is not
// used up and is not medicine - spare beds, equipment, linen. Counted items are
// a number; tagged items are counted by their units, each with an asset tag.

type Category = "BEDS_FURNITURE" | "EQUIPMENT" | "LINEN" | "OTHER";
type Condition = "WORKING" | "NEEDS_REPAIR" | "CONDEMNED";
type Reason = "DAMAGED" | "CONDEMNED" | "LOST" | "MOVED_OUT" | "OTHER";
interface Item {
  storeItemId: string; itemName: string; category: Category; tracking: "COUNT" | "TAGGED"; unit: string | null; notes: string | null;
  quantity: number; isActive: boolean; branchId: string; branchName?: string | null; inStore: number; needsRepair?: number;
}
interface Unit { storeAssetId: string; assetTag: string; serialNumber: string | null; condition: Condition; status: "IN_STORE" | "REMOVED"; notes: string | null; removedAt: string | null }
interface Movement { storeMovementId: string; kind: "ADD" | "REMOVE" | "COUNT" | "CONDITION"; change: number; quantityAfter: number; reason: string | null; note: string | null; createdAt: string; byName: string | null; assetTag: string | null }
interface ItemDetail extends Item { units: Unit[]; movements: Movement[] }

const CATEGORY_LABEL: Record<Category, string> = { BEDS_FURNITURE: "Beds & furniture", EQUIPMENT: "Medical equipment", LINEN: "Linen", OTHER: "Other" };
const CONDITION_LABEL: Record<Condition, string> = { WORKING: "Working", NEEDS_REPAIR: "Needs repair", CONDEMNED: "Condemned" };
const REASON_LABEL: Record<string, string> = { DAMAGED: "Damaged", CONDEMNED: "Condemned", LOST: "Lost", MOVED_OUT: "Moved out", OTHER: "Other", WORKING: "Working", NEEDS_REPAIR: "Needs repair" };
const KIND_LABEL: Record<Movement["kind"], string> = { ADD: "Added", REMOVE: "Removed", COUNT: "Counted", CONDITION: "Condition" };
const conditionColor = (c: Condition) => (c === "WORKING" ? SEMANTIC.success : c === "NEEDS_REPAIR" ? SEMANTIC.warning : SEMANTIC.danger);
const headCell = { color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", borderColor: "divider" } as const;

export default function StoreRoomPage() {
  const { user, activeBranchId } = useHospitalAuth();
  const canEdit = hasRole(user, "STORE_KEEPER", "H_ADMIN", "B_ADMIN");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [showOff, setShowOff] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: items = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["store-items", activeBranchId ?? "all", showOff],
    queryFn: async () => (await axiosInstance.get("/store-room/items", { params: showOff ? { includeInactive: "true" } : {} })).data.data as Item[],
  });
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => (!category || i.category === category) && (!q || i.itemName.toLowerCase().includes(q)));
  }, [items, search, category]);
  const allBranches = !activeBranchId;

  if (isLoading) return <DetailSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  return (
    <Box>
      <PageHeader
        title="Store room"
        subtitle="Spare beds, equipment and linen kept in this branch's store room. Medicines and consumables are kept in Pharmacy."
        actions={canEdit && (
          <Tooltip title={allBranches ? "Choose a branch in the top bar first" : ""}>
            <span><Button variant="contained" startIcon={<AddRounded />} disabled={allBranches} onClick={() => setAdding(true)} sx={{ textTransform: "none" }}>Add item</Button></span>
          </Tooltip>
        )}
      />
      {allBranches && <Alert severity="info" sx={{ mb: 2 }}>Showing every branch. Choose a branch in the top bar to add or change stock.</Alert>}

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ p: 2, alignItems: { md: "center" }, borderBottom: "1px solid", borderColor: "divider" }}>
          <TextField size="small" placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 280 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" sx={{ color: "text.secondary" }} /></InputAdornment> }} />
          <TextField select size="small" label="Category" value={category} onChange={(e) => setCategory(e.target.value as Category | "")} sx={{ minWidth: 200 }}>
            <MenuItem value="">All categories</MenuItem>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <MenuItem key={c} value={c}>{CATEGORY_LABEL[c]}</MenuItem>)}
          </TextField>
          <FormControlLabel control={<Switch checked={showOff} onChange={(e) => setShowOff(e.target.checked)} />} label="Show items taken off the list" />
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" sx={{ color: "text.secondary" }}>{shown.length} item{shown.length === 1 ? "" : "s"}</Typography>
        </Stack>
        {items.length === 0 ? (
          <Mascot pose="nothing-here-yet" title="The store room is empty" subtitle={canEdit ? "Use Add item for spare beds, equipment or linen." : undefined} />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {["Item", "Category", "Kept as", "In store", "Needs repair", ...(allBranches ? ["Branch"] : []), ""].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {shown.length === 0 && (
                  <TableRow><TableCell colSpan={7} sx={{ border: 0, py: 3 }}><Mascot pose="nothing-here-yet" subtitle="No items match." size={110} /></TableCell></TableRow>
                )}
                {shown.map((i) => (
                  <TableRow key={i.storeItemId} hover onClick={() => setOpenId(i.storeItemId)} sx={{ cursor: "pointer", opacity: i.isActive ? 1 : 0.55 }}>
                    <TableCell sx={{ borderColor: "divider", fontWeight: 600 }}>{i.itemName}{!i.isActive && <Chip size="small" label="Off the list" sx={{ ml: 1 }} />}</TableCell>
                    <TableCell sx={{ borderColor: "divider" }}>{CATEGORY_LABEL[i.category]}</TableCell>
                    <TableCell sx={{ borderColor: "divider", color: "text.secondary" }}>{i.tracking === "TAGGED" ? "Tagged units" : "Count"}</TableCell>
                    <TableCell sx={{ borderColor: "divider", fontWeight: 700 }}>{i.inStore}{i.unit ? <Typography component="span" variant="body2" sx={{ color: "text.secondary", ml: 0.5 }}>{i.unit}</Typography> : null}</TableCell>
                    <TableCell sx={{ borderColor: "divider" }}>
                      {i.needsRepair ? <Chip size="small" label={i.needsRepair} sx={{ bgcolor: `${SEMANTIC.warning}1f`, color: SEMANTIC.warning, fontWeight: 700 }} /> : <Typography variant="body2" sx={{ color: "text.disabled" }}>-</Typography>}
                    </TableCell>
                    {allBranches && <TableCell sx={{ borderColor: "divider" }}>{i.branchName}</TableCell>}
                    <TableCell align="right" sx={{ borderColor: "divider" }}><Inventory2Rounded fontSize="small" sx={{ color: "text.disabled" }} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {adding && <AddItemDialog onClose={() => setAdding(false)} onDone={() => { setAdding(false); refetch(); }} />}
      {openId && <ItemDialog id={openId} canEdit={canEdit} onClose={() => setOpenId(null)} onChanged={() => refetch()} />}
    </Box>
  );
}

function AddItemDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ itemName: "", category: "BEDS_FURNITURE" as Category, tracking: "COUNT" as "COUNT" | "TAGGED", unit: "", quantity: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try {
      await axiosInstance.post("/store-room/items", { ...f, quantity: f.tracking === "COUNT" && f.quantity ? Number(f.quantity) : undefined });
      toast.success("Item added");
      onDone();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not add the item"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add store item</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Item name" required value={f.itemName} onChange={set("itemName")} inputProps={{ maxLength: 120 }} placeholder="e.g. Extra bed, Cardiac monitor, Bedsheet" />
          <TextField select label="Category" value={f.category} onChange={set("category")}>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <MenuItem key={c} value={c}>{CATEGORY_LABEL[c]}</MenuItem>)}
          </TextField>
          <TextField select label="Keep as" value={f.tracking} onChange={set("tracking")}
            helperText={f.tracking === "COUNT" ? "Just a number - for beds, stands, linen." : "Each unit gets its own asset tag - for monitors, pumps, ventilators. Add the units after saving."}>
            <MenuItem value="COUNT">Count</MenuItem>
            <MenuItem value="TAGGED">Tagged units</MenuItem>
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField label="Unit (optional)" value={f.unit} onChange={set("unit")} inputProps={{ maxLength: 30 }} placeholder="e.g. bed, piece, set" sx={{ flex: 1 }} />
            {f.tracking === "COUNT" && <TextField label="In store now" type="number" value={f.quantity} onChange={set("quantity")} inputProps={{ min: 0 }} sx={{ flex: 1 }} />}
          </Stack>
          <TextField label="Notes (optional)" value={f.notes} onChange={set("notes")} multiline minRows={2} inputProps={{ maxLength: 500 }} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" disabled={busy || !f.itemName.trim()} onClick={save} sx={{ textTransform: "none" }}>Add item</Button>
      </DialogActions>
    </Dialog>
  );
}

function ItemDialog({ id, canEdit, onClose, onChanged }: { id: string; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState(0);
  const [action, setAction] = useState<"add" | "remove" | "count" | "unit" | "edit" | null>(null);
  const { data: item, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["store-item", id],
    queryFn: async () => (await axiosInstance.get(`/store-room/items/${id}`)).data.data as ItemDetail,
  });
  const done = (msg: string) => {
    toast.success(msg);
    setAction(null);
    refetch();
    onChanged();
    qc.invalidateQueries({ queryKey: ["store-items"] });
  };
  const run = async (call: () => Promise<unknown>, msg: string, failMsg: string) => {
    try {
      await call();
      done(msg);
    } catch (err) {
      toast.error(getApiErrorMessage(err, failMsg));
    }
  };

  const unitsIn = item?.units.filter((u) => u.status === "IN_STORE") ?? [];
  const unitsOut = item?.units.filter((u) => u.status === "REMOVED") ?? [];

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      {isLoading || !item ? (
        <DialogContent>{isError ? <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /> : <DetailSkeleton />}</DialogContent>
      ) : (
        <>
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            {item.itemName}
            <Chip size="small" label={CATEGORY_LABEL[item.category]} />
            <Chip size="small" label={`${item.inStore}${item.unit ? ` ${item.unit}` : ""} in store`} color="primary" variant="outlined" />
            {!item.isActive && <Chip size="small" label="Off the list" />}
            <Box sx={{ flex: 1 }} />
            {canEdit && <Tooltip title="Edit item"><IconButton size="small" onClick={() => setAction("edit")}><EditRounded fontSize="small" /></IconButton></Tooltip>}
          </DialogTitle>
          <DialogContent>
            {item.notes && <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>{item.notes}</Typography>}
            {canEdit && item.isActive && (
              <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
                {item.tracking === "COUNT" ? (
                  <>
                    <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => setAction("add")} sx={{ textTransform: "none" }}>Add stock</Button>
                    <Button size="small" variant="outlined" startIcon={<RemoveCircleOutlineRounded />} disabled={item.quantity === 0} onClick={() => setAction("remove")} sx={{ textTransform: "none" }}>Remove</Button>
                    <Button size="small" variant="outlined" startIcon={<FactCheckRounded />} onClick={() => setAction("count")} sx={{ textTransform: "none" }}>Set count after a check</Button>
                  </>
                ) : (
                  <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => setAction("unit")} sx={{ textTransform: "none" }}>Add unit</Button>
                )}
              </Stack>
            )}
            {action === "add" && <CountForm title="Add stock" label="How many to add" onCancel={() => setAction(null)}
              onSave={(q, _r, note) => run(() => axiosInstance.post(`/store-room/items/${id}/add`, { quantity: q, note }), "Stock added", "Could not add stock")} />}
            {action === "remove" && <CountForm title="Remove from the store" label="How many to remove" max={item.quantity} withReason onCancel={() => setAction(null)}
              onSave={(q, reason, note) => run(() => axiosInstance.post(`/store-room/items/${id}/remove`, { quantity: q, reason, note }), "Removed", "Could not remove")} />}
            {action === "count" && <CountForm title="Set the count after a physical check" label="How many are actually there" min={0} onCancel={() => setAction(null)}
              onSave={(q, _r, note) => run(() => axiosInstance.post(`/store-room/items/${id}/count`, { quantity: q, note }), "Count saved", "Could not save the count")} />}
            {action === "unit" && <UnitForm onCancel={() => setAction(null)}
              onSave={(body) => run(() => axiosInstance.post(`/store-room/items/${id}/units`, body), "Unit added", "Could not add the unit")} />}
            {action === "edit" && <EditItemForm item={item} onCancel={() => setAction(null)}
              onSave={(body) => run(() => axiosInstance.patch(`/store-room/items/${id}`, body), "Item saved", "Could not save the item")} />}

            {item.tracking === "TAGGED" && (
              <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 1 }}>
                <Tab label={`Units in store (${unitsIn.length})`} sx={{ textTransform: "none" }} />
                <Tab label={`Left the store (${unitsOut.length})`} sx={{ textTransform: "none" }} />
                <Tab label="History" sx={{ textTransform: "none" }} />
              </Tabs>
            )}
            {item.tracking === "TAGGED" && tab < 2 ? (
              <UnitsTable units={tab === 0 ? unitsIn : unitsOut} canEdit={canEdit && tab === 0 && item.isActive}
                onCondition={(u, condition) => run(() => axiosInstance.patch(`/store-room/units/${u.storeAssetId}`, { condition }), "Condition saved", "Could not save the condition")}
                onRemove={(u, reason, note) => run(() => axiosInstance.post(`/store-room/units/${u.storeAssetId}/remove`, { reason, note }), `${u.assetTag} removed`, "Could not remove the unit")} />
            ) : (
              <History movements={item.movements} />
            )}
          </DialogContent>
          <DialogActions><Button onClick={onClose} sx={{ textTransform: "none" }}>Close</Button></DialogActions>
        </>
      )}
    </Dialog>
  );
}

function ReasonSelect({ value, onChange }: { value: Reason | ""; onChange: (r: Reason) => void }) {
  return (
    <TextField select size="small" label="Why" required value={value} onChange={(e) => onChange(e.target.value as Reason)} sx={{ minWidth: 160 }}>
      {(["DAMAGED", "CONDEMNED", "LOST", "MOVED_OUT", "OTHER"] as Reason[]).map((r) => <MenuItem key={r} value={r}>{REASON_LABEL[r]}</MenuItem>)}
    </TextField>
  );
}

function CountForm({ title, label, min = 1, max, withReason, onCancel, onSave }: {
  title: string; label: string; min?: number; max?: number; withReason?: boolean; onCancel: () => void;
  onSave: (quantity: number, reason: Reason | undefined, note: string | undefined) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [reason, setReason] = useState<Reason | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const n = Number(q);
  const ok = q !== "" && Number.isInteger(n) && n >= min && (max === undefined || n <= max) && (!withReason || !!reason);
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>{title}</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField size="small" type="number" label={label} value={q} onChange={(e) => setQ(e.target.value)} inputProps={{ min, max }} sx={{ minWidth: 200 }}
          helperText={max !== undefined ? `${max} in the store` : undefined} />
        {withReason && <ReasonSelect value={reason} onChange={setReason} />}
        <TextField size="small" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} inputProps={{ maxLength: 500 }} sx={{ flex: 1 }} />
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 1.5, justifyContent: "flex-end" }}>
        <Button size="small" onClick={onCancel} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button size="small" variant="contained" disabled={!ok || busy} sx={{ textTransform: "none" }}
          onClick={async () => { setBusy(true); await onSave(n, reason || undefined, note.trim() || undefined); setBusy(false); }}>Save</Button>
      </Stack>
    </Paper>
  );
}

function UnitForm({ onCancel, onSave }: { onCancel: () => void; onSave: (body: { assetTag: string; serialNumber?: string; condition: Condition; notes?: string }) => Promise<void> }) {
  const [f, setF] = useState({ assetTag: "", serialNumber: "", condition: "WORKING" as Condition, notes: "" });
  const [busy, setBusy] = useState(false);
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Add a unit</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField size="small" label="Asset tag" required value={f.assetTag} onChange={(e) => setF({ ...f, assetTag: e.target.value })} inputProps={{ maxLength: 60 }} helperText="Unique in the hospital" />
        <TextField size="small" label="Serial no. (optional)" value={f.serialNumber} onChange={(e) => setF({ ...f, serialNumber: e.target.value })} inputProps={{ maxLength: 100 }} />
        <TextField select size="small" label="Condition" value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value as Condition })} sx={{ minWidth: 150 }}>
          {(["WORKING", "NEEDS_REPAIR"] as Condition[]).map((c) => <MenuItem key={c} value={c}>{CONDITION_LABEL[c]}</MenuItem>)}
        </TextField>
        <TextField size="small" label="Note (optional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} inputProps={{ maxLength: 500 }} sx={{ flex: 1 }} />
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 1.5, justifyContent: "flex-end" }}>
        <Button size="small" onClick={onCancel} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button size="small" variant="contained" disabled={!f.assetTag.trim() || busy} sx={{ textTransform: "none" }}
          onClick={async () => { setBusy(true); await onSave({ assetTag: f.assetTag.trim(), serialNumber: f.serialNumber.trim() || undefined, condition: f.condition, notes: f.notes.trim() || undefined }); setBusy(false); }}>Add unit</Button>
      </Stack>
    </Paper>
  );
}

function EditItemForm({ item, onCancel, onSave }: { item: ItemDetail; onCancel: () => void; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  const [f, setF] = useState({ itemName: item.itemName, category: item.category, unit: item.unit ?? "", notes: item.notes ?? "" });
  const [busy, setBusy] = useState(false);
  const save = async (extra: Record<string, unknown> = {}) => { setBusy(true); await onSave({ ...f, ...extra }); setBusy(false); };
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Edit item</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField size="small" label="Item name" value={f.itemName} onChange={(e) => setF({ ...f, itemName: e.target.value })} inputProps={{ maxLength: 120 }} sx={{ flex: 1 }} />
        <TextField select size="small" label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Category })} sx={{ minWidth: 180 }}>
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <MenuItem key={c} value={c}>{CATEGORY_LABEL[c]}</MenuItem>)}
        </TextField>
        <TextField size="small" label="Unit" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} inputProps={{ maxLength: 30 }} sx={{ width: 120 }} />
      </Stack>
      <TextField size="small" label="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} inputProps={{ maxLength: 500 }} fullWidth multiline sx={{ mt: 1.5 }} />
      <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: "center" }}>
        <Tooltip title={item.isActive && item.inStore > 0 ? "Remove everything from the store first" : ""}>
          <span>
            <Button size="small" color={item.isActive ? "error" : "primary"} disabled={busy || (item.isActive && item.inStore > 0)} onClick={() => save({ isActive: !item.isActive })} sx={{ textTransform: "none" }}>
              {item.isActive ? "Take off the list" : "Put back on the list"}
            </Button>
          </span>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={onCancel} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button size="small" variant="contained" disabled={busy || !f.itemName.trim()} onClick={() => save()} sx={{ textTransform: "none" }}>Save</Button>
      </Stack>
    </Paper>
  );
}

function UnitsTable({ units, canEdit, onCondition, onRemove }: {
  units: Unit[]; canEdit: boolean; onCondition: (u: Unit, c: Condition) => void; onRemove: (u: Unit, reason: Reason, note?: string) => Promise<void>;
}) {
  const [removing, setRemoving] = useState<Unit | null>(null);
  const [reason, setReason] = useState<Reason | "">("");
  const [note, setNote] = useState("");
  if (!units.length) return <Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>None.</Typography>;
  return (
    <>
      <TableContainer>
        <Table size="small">
          <TableHead><TableRow>{["Asset tag", "Serial no.", "Condition", "Note", ""].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {units.map((u) => (
              <TableRow key={u.storeAssetId}>
                <TableCell sx={{ borderColor: "divider", fontFamily: "monospace", fontWeight: 600 }}>{u.assetTag}</TableCell>
                <TableCell sx={{ borderColor: "divider", color: "text.secondary" }}>{u.serialNumber ?? "-"}</TableCell>
                <TableCell sx={{ borderColor: "divider" }}>
                  {canEdit ? (
                    <TextField select size="small" variant="standard" value={u.condition} onChange={(e) => onCondition(u, e.target.value as Condition)}>
                      {(["WORKING", "NEEDS_REPAIR"] as Condition[]).map((c) => <MenuItem key={c} value={c}>{CONDITION_LABEL[c]}</MenuItem>)}
                    </TextField>
                  ) : (
                    <Chip size="small" label={CONDITION_LABEL[u.condition]} sx={{ bgcolor: `${conditionColor(u.condition)}1f`, color: conditionColor(u.condition), fontWeight: 700 }} />
                  )}
                </TableCell>
                <TableCell sx={{ borderColor: "divider", color: "text.secondary" }}>{u.notes ?? ""}{u.removedAt ? ` (left ${formatDateTime(u.removedAt)})` : ""}</TableCell>
                <TableCell align="right" sx={{ borderColor: "divider" }}>
                  {canEdit && <Button size="small" color="error" onClick={() => { setRemoving(u); setReason(""); setNote(""); }} sx={{ textTransform: "none" }}>Remove</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {removing && (
        <Dialog open onClose={() => setRemoving(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Remove {removing.assetTag}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <ReasonSelect value={reason} onChange={setReason} />
              <TextField size="small" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} inputProps={{ maxLength: 500 }} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRemoving(null)} sx={{ textTransform: "none" }}>Cancel</Button>
            <Button variant="contained" color="error" disabled={!reason} sx={{ textTransform: "none" }}
              onClick={async () => { await onRemove(removing, reason as Reason, note.trim() || undefined); setRemoving(null); }}>Remove</Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}

function History({ movements }: { movements: Movement[] }) {
  if (!movements.length) return <Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>Nothing recorded yet.</Typography>;
  return (
    <TableContainer sx={{ maxHeight: 360 }}>
      <Table size="small" stickyHeader>
        <TableHead><TableRow>{["When", "What", "Change", "After", "Reason", "Note", "By"].map((h) => <TableCell key={h} sx={headCell}>{h}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {movements.map((m) => (
            <TableRow key={m.storeMovementId}>
              <TableCell sx={{ borderColor: "divider", whiteSpace: "nowrap" }}>{formatDateTime(m.createdAt)}</TableCell>
              <TableCell sx={{ borderColor: "divider" }}>{KIND_LABEL[m.kind]}{m.assetTag ? ` ${m.assetTag}` : ""}</TableCell>
              <TableCell sx={{ borderColor: "divider", fontWeight: 700, color: m.change > 0 ? SEMANTIC.success : m.change < 0 ? SEMANTIC.danger : "text.secondary" }}>{m.change > 0 ? `+${m.change}` : m.change}</TableCell>
              <TableCell sx={{ borderColor: "divider" }}>{m.quantityAfter}</TableCell>
              <TableCell sx={{ borderColor: "divider" }}>{m.reason ? REASON_LABEL[m.reason] ?? m.reason : ""}</TableCell>
              <TableCell sx={{ borderColor: "divider", color: "text.secondary" }}>{m.note ?? ""}</TableCell>
              <TableCell sx={{ borderColor: "divider", color: "text.secondary" }}>{m.byName ?? ""}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
