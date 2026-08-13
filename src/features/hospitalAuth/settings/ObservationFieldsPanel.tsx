import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Paper, Typography, TextField, MenuItem, Button, IconButton, Chip, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, Switch, Tooltip, Alert, Divider,
  FormControlLabel, InputAdornment,
} from "@mui/material";
import {
  AddRounded, DeleteOutlineRounded, EditRounded, TuneRounded,
  ArrowUpwardRounded, ArrowDownwardRounded, LockRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { apiErrorText } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import { NEUTRAL } from "@/styles/accents";

/**
 * Observations this hospital charts that the standard seven do not cover.
 *
 * The types are deliberately few — a number, a set of choices, or free text.
 * Fewer types is fewer things to get wrong, and a number stays a number, so a
 * hospital's own observation can be trended and range-checked exactly like a
 * built-in one rather than being a note in a box.
 */

export interface ObservationFieldDef {
  observationFieldId: string;
  fieldKey: string;
  label: string;
  dataType: "NUMBER" | "CHOICE" | "TEXT";
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
  normalLow: number | null;
  normalHigh: number | null;
  choices: string[] | null;
  wardTypes: string[] | null;
  sortOrder: number;
  isActive: boolean;
  valueCount?: number;
  keyLocked?: boolean;
  typeLocked?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  NUMBER: "Number",
  CHOICE: "Choice",
  TEXT: "Text",
};

const TYPE_HELP: Record<string, string> = {
  NUMBER: "A measurement — can be charted on a graph and range-checked.",
  CHOICE: "One of a fixed list, in order (e.g. None → Severe).",
  TEXT: "A short note. Cannot be graphed or range-checked.",
};

const WARD_TYPE_LABELS: Record<string, string> = {
  ICU: "ICU",
  general: "General ward",
  surgical: "Surgical",
  maternity: "Maternity",
  pediatric: "Paediatric",
};

const BLANK = {
  label: "", dataType: "NUMBER" as const, unit: "",
  minValue: "", maxValue: "", normalLow: "", normalHigh: "",
  choices: ["", ""] as string[], wardTypes: [] as string[],
};

/** One-line summary of what a field accepts, for the list row. */
function describe(f: ObservationFieldDef): string {
  if (f.dataType === "CHOICE") return (f.choices ?? []).join(" · ");
  if (f.dataType === "TEXT") return "Free text";
  const bits: string[] = [];
  if (f.unit) bits.push(f.unit);
  if (f.minValue !== null || f.maxValue !== null) {
    bits.push(`accepts ${f.minValue ?? "any"}–${f.maxValue ?? "any"}`);
  }
  if (f.normalLow !== null || f.normalHigh !== null) {
    bits.push(`normal ${f.normalLow ?? "?"}–${f.normalHigh ?? "?"}`);
  }
  return bits.join(" · ") || "Number";
}

export default function ObservationFieldsPanel() {
  const toast = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ObservationFieldDef | null>(null);
  const [form, setForm] = useState<any>(BLANK);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["observation-fields"],
    // Switched-off fields are shown here (greyed) — this is the only screen
    // from which one can be switched back on.
    queryFn: async () => (await axiosInstance.get("/ipd/observation-fields?includeInactive=true")).data.data,
  });

  const fields: ObservationFieldDef[] = data?.fields ?? [];
  const wardTypes: string[] = data?.wardTypes ?? [];
  const activeCount = fields.filter((f) => f.isActive).length;

  const done = (msg: string) => {
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["observation-fields"] });
    setOpen(false);
  };
  const fail = (err: unknown) => toast.error(apiErrorText(err));

  const save = useMutation({
    mutationFn: async () => {
      const body: any = {
        label: form.label.trim(),
        dataType: form.dataType,
        wardTypes: form.wardTypes,
        sortOrder: editing ? editing.sortOrder : fields.length,
      };
      if (form.dataType === "NUMBER") {
        body.unit = form.unit.trim();
        body.minValue = form.minValue;
        body.maxValue = form.maxValue;
        body.normalLow = form.normalLow;
        body.normalHigh = form.normalHigh;
      }
      if (form.dataType === "CHOICE") body.choices = form.choices.filter((c: string) => c.trim());
      return editing
        ? (await axiosInstance.put(`/ipd/observation-fields/${editing.observationFieldId}`, body)).data
        : (await axiosInstance.post("/ipd/observation-fields", body)).data;
    },
    onSuccess: () => done(editing ? "Observation updated" : "Observation added"),
    onError: fail,
  });

  const toggle = useMutation({
    mutationFn: async (f: ObservationFieldDef) =>
      (await axiosInstance.patch(`/ipd/observation-fields/${f.observationFieldId}/active`, { isActive: !f.isActive })).data,
    onSuccess: (_d, f) => {
      toast.success(f.isActive ? `${f.label} switched off` : `${f.label} switched on`);
      qc.invalidateQueries({ queryKey: ["observation-fields"] });
    },
    onError: fail,
  });

  const remove = useMutation({
    mutationFn: async (f: ObservationFieldDef) =>
      (await axiosInstance.delete(`/ipd/observation-fields/${f.observationFieldId}`)).data,
    onSuccess: () => done("Observation removed"),
    onError: fail,
  });

  // Reordering writes only the two rows that swapped, so it cannot disturb a
  // field somebody else is editing in another tab.
  const reorder = useMutation({
    mutationFn: async ({ a, b }: { a: ObservationFieldDef; b: ObservationFieldDef }) => {
      const put = (f: ObservationFieldDef, sortOrder: number) =>
        axiosInstance.put(`/ipd/observation-fields/${f.observationFieldId}`, {
          label: f.label, dataType: f.dataType, unit: f.unit ?? "",
          minValue: f.minValue, maxValue: f.maxValue, normalLow: f.normalLow, normalHigh: f.normalHigh,
          choices: f.choices ?? undefined, wardTypes: f.wardTypes ?? [], sortOrder,
        });
      await Promise.all([put(a, b.sortOrder), put(b, a.sortOrder)]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["observation-fields"] }),
    onError: fail,
  });

  const openNew = () => { setEditing(null); setForm(BLANK); setOpen(true); };
  const openEdit = (f: ObservationFieldDef) => {
    setEditing(f);
    setForm({
      label: f.label, dataType: f.dataType, unit: f.unit ?? "",
      minValue: f.minValue ?? "", maxValue: f.maxValue ?? "",
      normalLow: f.normalLow ?? "", normalHigh: f.normalHigh ?? "",
      choices: f.choices?.length ? [...f.choices] : ["", ""],
      wardTypes: f.wardTypes ?? [],
    });
    setOpen(true);
  };

  const set = (patch: any) => setForm({ ...form, ...patch });
  const canSave = form.label.trim() && (form.dataType !== "CHOICE" || form.choices.filter((c: string) => c.trim()).length >= 2);

  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: 0.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <TuneRounded sx={{ color: "text.secondary" }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Your own observations</Typography>
        </Box>
        <Button size="small" variant="outlined" startIcon={<AddRounded />} sx={{ textTransform: "none" }} onClick={openNew}>
          Add observation
        </Button>
      </Box>
      <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
        Anything this hospital charts that the standard columns don't cover — retractions on a NICU
        chart, fundal height on a maternity one. These appear on the chart after the standard columns,
        in the order below.
      </Typography>

      {isLoading ? (
        <Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>Loading…</Typography>
      ) : fields.length === 0 ? (
        <Alert severity="info" icon={false} sx={{ borderRadius: 2 }}>
          <Typography variant="body2">
            None yet — the standard columns cover most wards. Add one only if your staff currently
            write it in the margin.
          </Typography>
        </Alert>
      ) : (
        <Stack divider={<Divider />} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
          {fields.map((f, i) => (
            <Box key={f.observationFieldId}
              sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1.25, opacity: f.isActive ? 1 : 0.55 }}>
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                <IconButton size="small" disabled={i === 0 || reorder.isPending}
                  onClick={() => reorder.mutate({ a: f, b: fields[i - 1] })} sx={{ p: 0.25 }}>
                  <ArrowUpwardRounded sx={{ fontSize: 15 }} />
                </IconButton>
                <IconButton size="small" disabled={i === fields.length - 1 || reorder.isPending}
                  onClick={() => reorder.mutate({ a: f, b: fields[i + 1] })} sx={{ p: 0.25 }}>
                  <ArrowDownwardRounded sx={{ fontSize: 15 }} />
                </IconButton>
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{f.label}</Typography>
                  <Chip size="small" label={TYPE_LABELS[f.dataType]} variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                  {(f.wardTypes ?? []).map((w) => (
                    <Chip key={w} size="small" label={WARD_TYPE_LABELS[w] ?? w} sx={{ height: 20, fontSize: 11 }} />
                  ))}
                  {!!f.valueCount && (
                    <Tooltip title="Recorded readings. What kind of observation this is can no longer change, and it can no longer be deleted — only switched off.">
                      <Chip size="small" icon={<LockRounded sx={{ fontSize: 13 }} />} label={`${f.valueCount} recorded`}
                        variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                    </Tooltip>
                  )}
                </Box>
                <Typography variant="caption" sx={{ color: NEUTRAL.muted, display: "block", mt: 0.25 }} noWrap>
                  {describe(f)}
                </Typography>
              </Box>

              <Tooltip title={f.isActive ? "Switch off — stops appearing on new charts; readings already taken stay" : "Switch back on"}>
                <Switch size="small" checked={f.isActive} onChange={() => toggle.mutate(f)} disabled={toggle.isPending} />
              </Tooltip>
              <IconButton size="small" onClick={() => openEdit(f)}><EditRounded fontSize="small" /></IconButton>
              <Tooltip title={f.valueCount ? "Has readings recorded — switch it off instead" : "Delete"}>
                <span>
                  <IconButton size="small" disabled={!!f.valueCount || remove.isPending} onClick={() => remove.mutate(f)}>
                    <DeleteOutlineRounded fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          ))}
        </Stack>
      )}

      {activeCount >= (data?.maxActive ?? 20) && (
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1.5 }}>
          That's {data?.maxActive} switched on, which is as many as a chart stays readable with.
        </Typography>
      )}

      {/* ── Add / edit ──────────────────────────────────────────────────────── */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle component="div">
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {editing ? `Edit ${editing.label}` : "Add an observation"}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            This appears on every ward chart it applies to, and on the printed sheet.
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <TextField
              label="Name" size="small" fullWidth autoFocus
              value={form.label} onChange={(e) => set({ label: e.target.value })}
              placeholder="e.g. Retractions"
              helperText={editing?.keyLocked ? "Renaming is safe — readings already taken follow the name." : "What the nurse sees at the top of the column."}
            />

            <TextField
              select label="What kind of observation" size="small" fullWidth
              value={form.dataType} onChange={(e) => set({ dataType: e.target.value })}
              disabled={!!editing?.typeLocked}
              helperText={editing?.typeLocked
                ? `${editing.valueCount} reading${editing.valueCount === 1 ? "" : "s"} already recorded, so this can no longer change. Switch it off and add a new one instead.`
                : TYPE_HELP[form.dataType]}
            >
              {Object.keys(TYPE_LABELS).map((t) => <MenuItem key={t} value={t}>{TYPE_LABELS[t]}</MenuItem>)}
            </TextField>

            {form.dataType === "NUMBER" && (
              <>
                <TextField label="Unit" size="small" value={form.unit} onChange={(e) => set({ unit: e.target.value })}
                  placeholder="e.g. cm" sx={{ maxWidth: 200 }} />
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 1 }}>
                    Values the chart will accept
                  </Typography>
                  <Stack direction="row" spacing={1.5}>
                    <TextField label="Lowest" size="small" type="number" value={form.minValue} onChange={(e) => set({ minValue: e.target.value })} />
                    <TextField label="Highest" size="small" type="number" value={form.maxValue} onChange={(e) => set({ maxValue: e.target.value })} />
                  </Stack>
                  <Typography variant="caption" sx={{ color: NEUTRAL.muted, display: "block", mt: 0.75 }}>
                    Set these wide. They exist to catch a mis-key, not to argue with a genuine reading —
                    a nurse who cannot enter the truth has nowhere to put it. Leave blank for no limit.
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 1 }}>
                    Normal range <Box component="span" sx={{ fontWeight: 400, color: NEUTRAL.muted }}>(optional)</Box>
                  </Typography>
                  <Stack direction="row" spacing={1.5}>
                    <TextField label="From" size="small" type="number" value={form.normalLow} onChange={(e) => set({ normalLow: e.target.value })} />
                    <TextField label="To" size="small" type="number" value={form.normalHigh} onChange={(e) => set({ normalHigh: e.target.value })} />
                  </Stack>
                  <Typography variant="caption" sx={{ color: NEUTRAL.muted, display: "block", mt: 0.75 }}>
                    A reading outside this is marked on the chart. It is never refused.
                  </Typography>
                </Box>
              </>
            )}

            {form.dataType === "CHOICE" && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 1 }}>
                  Options, in order
                </Typography>
                <Stack spacing={1}>
                  {form.choices.map((c: string, i: number) => (
                    <TextField
                      key={i} size="small" value={c} placeholder={i === 0 ? "e.g. None" : i === 1 ? "e.g. Mild" : "…"}
                      onChange={(e) => set({ choices: form.choices.map((x: string, j: number) => (j === i ? e.target.value : x)) })}
                      InputProps={{
                        startAdornment: <InputAdornment position="start"><Typography variant="caption" sx={{ color: NEUTRAL.muted }}>{i + 1}</Typography></InputAdornment>,
                        endAdornment: form.choices.length > 2 ? (
                          <IconButton size="small" onClick={() => set({ choices: form.choices.filter((_: string, j: number) => j !== i) })}>
                            <DeleteOutlineRounded fontSize="small" />
                          </IconButton>
                        ) : undefined,
                      }}
                    />
                  ))}
                </Stack>
                <Button size="small" startIcon={<AddRounded />} sx={{ textTransform: "none", mt: 1 }}
                  disabled={form.choices.length >= 12} onClick={() => set({ choices: [...form.choices, ""] })}>
                  Add option
                </Button>
                <Typography variant="caption" sx={{ color: NEUTRAL.muted, display: "block", mt: 0.75 }}>
                  Order matters — put them least to most severe so the chart reads in one direction.
                  {!!editing?.valueCount && " An option already recorded against a patient cannot be removed."}
                </Typography>
              </Box>
            )}

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 1 }}>
                Which wards chart this
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {wardTypes.map((w) => {
                  const on = form.wardTypes.includes(w);
                  return (
                    <Chip key={w} label={WARD_TYPE_LABELS[w] ?? w}
                      color={on ? "primary" : "default"} variant={on ? "filled" : "outlined"}
                      onClick={() => set({ wardTypes: on ? form.wardTypes.filter((x: string) => x !== w) : [...form.wardTypes, w] })}
                    />
                  );
                })}
              </Box>
              <Typography variant="caption" sx={{ color: NEUTRAL.muted, display: "block", mt: 0.75 }}>
                {form.wardTypes.length === 0 || form.wardTypes.length === wardTypes.length
                  ? "Every ward. Narrow it if only some wards chart this — a column nobody fills is a column people stop reading."
                  : `Only ${form.wardTypes.map((w: string) => WARD_TYPE_LABELS[w] ?? w).join(", ")}.`}
              </Typography>
            </Box>

            {!!editing?.valueCount && (
              <FormControlLabel
                control={<Switch size="small" checked={editing.isActive} disabled />}
                label={<Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Use the switch in the list to turn this on or off. It is never deleted, so the {editing.valueCount} reading
                  {editing.valueCount === 1 ? "" : "s"} already taken keep showing on their charts.
                </Typography>}
                sx={{ alignItems: "flex-start", m: 0 }}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" disabled={!canSave || save.isPending} onClick={() => save.mutate()} sx={{ textTransform: "none" }}>
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Add observation"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
