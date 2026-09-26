import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Paper, Typography, List, ListItemButton, ListItemText, ListSubheader, Chip, Button, TextField,
  InputAdornment, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Dialog, DialogTitle,
  DialogContent, DialogActions, Switch, FormControlLabel, MenuItem, Checkbox, Alert, Stack, Tooltip,
} from "@mui/material";
import {
  SearchRounded, AddRounded, LockRounded, CloudSyncRounded, CheckRounded, ContentCopyRounded,
} from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import ErrorState from "@/components/ErrorState";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { axiosInstance } from "@/api/axios";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import { useConfirm } from "@/providers/ConfirmContext";
import { BRAND, SEMANTIC, NEUTRAL } from "@/styles/accents";

/**
 * The platform's master lists — the departments, ward/room/bed types, bed
 * categories, designations and the rest from HMS_Platform_Master_Data.xlsx.
 *
 * Everything on this screen is described by the API: each master sends its own
 * column definitions, so the table and the edit form are built from them and a
 * new column needs no change here. Locked masters are shown but never editable —
 * code depends on their codes.
 *
 * Changes here reach hospitals through "Push to hospitals" (and automatically for
 * every hospital created from now on): each hospital gets any rows it is missing,
 * keeps its own names and on/off choices, and follows the platform on behaviour.
 */

type Option = { value: string; label: string };
interface Column {
  key: string; label: string; type: "text" | "bool" | "int" | "list" | "select";
  max?: number; min?: number; required?: boolean; inTable?: boolean; hint?: string; options?: Option[];
}
interface MasterSummary { key: string; label: string; group: string; description: string; locked: boolean; copiedToHospitals: boolean; rows: number }
interface MasterDetail extends Omit<MasterSummary, "rows"> { idKey: "code" | "id"; columns: Column[]; rows: Record<string, unknown>[] }
interface CopySummary {
  hospitalId: string;
  wardTypes: { created: number; synced: number }; roomTypes: { created: number; synced: number };
  bedTypes: { created: number; synced: number }; designations: { created: number; synced: number };
  departments: { linked: number; created: number; unlinkedOwn: string[] };
  roomClasses: { linked: number; created: number; unlinkedOwn: string[] };
}

const STAFF_MAP = "__deptStaffMap";

export default function PlatformMasters() {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [selected, setSelected] = useState("departments");
  const [syncResult, setSyncResult] = useState<{ results: CopySummary[]; failed: { hospitalName: string; error: string }[] } | null>(null);

  const summaryQ = useQuery<{ masters: MasterSummary[]; deptStaffMapRows: number }>({
    queryKey: ["platform-masters"],
    queryFn: async () => (await axiosInstance.get("/platform-masters")).data.data,
  });

  const groups = useMemo(() => {
    const out = new Map<string, MasterSummary[]>();
    for (const m of summaryQ.data?.masters ?? []) out.set(m.group, [...(out.get(m.group) ?? []), m]);
    return [...out.entries()];
  }, [summaryQ.data]);

  const sync = useMutation({
    mutationFn: async () => (await axiosInstance.post("/platform-masters/sync-hospitals", {}, { timeout: 300_000 })).data.data,
    onSuccess: (data) => { setSyncResult(data); qc.invalidateQueries({ queryKey: ["platform-masters"] }); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not push the masters to hospitals")),
  });

  const onSync = async () => {
    const ok = await confirm({
      title: "Push master lists to every hospital?",
      message: "Each hospital gets the rows it is missing. Nothing is deleted, hospitals keep their own names and on/off choices, and behaviour flags (critical care, census, billing, grades) follow the platform. New departments and bed categories arrive switched off.",
      confirmText: "Push to hospitals",
    });
    if (ok) sync.mutate();
  };

  return (
    <PageContainer>
      <PageHeader
        title="Master Data"
        subtitle="The standard lists every hospital is set up from — departments, wards, rooms, beds and staff."
        actions={
          <Button variant="contained" startIcon={<CloudSyncRounded />} onClick={onSync} disabled={sync.isPending}
            sx={{ textTransform: "none", fontWeight: 600 }}>
            {sync.isPending ? "Pushing to hospitals…" : "Push to hospitals"}
          </Button>
        }
      />

      {summaryQ.isError ? (
        <ErrorState message={apiErrorText(summaryQ.error)} onRetry={() => summaryQ.refetch()} />
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "260px 1fr" }, gap: 3, alignItems: "start" }}>
          <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden", position: { md: "sticky" }, top: { md: 16 } }}>
            <List dense disablePadding>
              {groups.map(([group, items]) => (
                <Box key={group}>
                  <ListSubheader sx={{ fontWeight: 700, lineHeight: "36px", bgcolor: "background.paper" }}>{group}</ListSubheader>
                  {items.map((m) => (
                    <ListItemButton key={m.key} selected={selected === m.key} onClick={() => setSelected(m.key)} sx={{ pl: 2.5 }}>
                      <ListItemText primary={m.label} slotProps={{ primary: { sx: { fontWeight: selected === m.key ? 700 : 500, fontSize: "0.875rem" } } }} />
                      {m.locked && <LockRounded sx={{ fontSize: 14, color: "text.disabled", mr: 1 }} />}
                      <Typography variant="caption" sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>{m.rows}</Typography>
                    </ListItemButton>
                  ))}
                  {group === "Departments" && (
                    <ListItemButton selected={selected === STAFF_MAP} onClick={() => setSelected(STAFF_MAP)} sx={{ pl: 2.5 }}>
                      <ListItemText primary="Department ↔ staff" slotProps={{ primary: { sx: { fontWeight: selected === STAFF_MAP ? 700 : 500, fontSize: "0.875rem" } } }} />
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>{summaryQ.data?.deptStaffMapRows ?? ""}</Typography>
                    </ListItemButton>
                  )}
                </Box>
              ))}
            </List>
          </Paper>

          <Box sx={{ minWidth: 0 }}>
            {selected === STAFF_MAP ? <DeptStaffMap /> : <MasterTable key={selected} masterKey={selected} />}
          </Box>
        </Box>
      )}

      <SyncResultDialog result={syncResult} onClose={() => setSyncResult(null)} />
    </PageContainer>
  );
}

// ── One master ───────────────────────────────────────────────────────────────

function MasterTable({ masterKey }: { masterKey: string }) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Record<string, unknown> | "new" | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<MasterDetail>({
    queryKey: ["platform-master", masterKey],
    queryFn: async () => (await axiosInstance.get(`/platform-masters/${masterKey}`)).data.data,
  });

  const tableCols = (data?.columns ?? []).filter((c) => c.inTable);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const all = data?.rows ?? [];
    if (!term) return all;
    return all.filter((r) => Object.values(r).some((v) => String(Array.isArray(v) ? v.join(" ") : v ?? "").toLowerCase().includes(term)));
  }, [data, q]);

  const editable = data && !data.locked;

  return (
    <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>
      <Box sx={{ p: 2.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{data?.label ?? " "}</Typography>
          {data?.locked && <Chip size="small" icon={<LockRounded sx={{ fontSize: 14 }} />} label="Locked" sx={{ fontWeight: 600 }} />}
          {data?.copiedToHospitals && <Chip size="small" icon={<ContentCopyRounded sx={{ fontSize: 14 }} />} label="Copied to each hospital" sx={{ fontWeight: 600, bgcolor: `${BRAND.action}14`, color: BRAND.action }} />}
        </Box>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>{data?.description}</Typography>
        <Box sx={{ display: "flex", gap: 1.5, mt: 2, flexWrap: "wrap" }}>
          <TextField size="small" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} sx={{ flex: 1, minWidth: 220 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
          {editable && (
            <Button variant="outlined" startIcon={<AddRounded />} onClick={() => setEditing("new")} sx={{ textTransform: "none", fontWeight: 600 }}>
              Add
            </Button>
          )}
        </Box>
      </Box>

      {isError ? (
        <Box sx={{ p: 3 }}><ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /></Box>
      ) : (
        <TableContainer sx={{ maxHeight: "calc(100vh - 330px)" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {tableCols.map((c) => (
                  <TableCell key={c.key} sx={{ fontWeight: 700, color: "text.secondary", bgcolor: "background.paper", whiteSpace: "nowrap" }}>{c.label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRowsSkeleton rows={8} columns={5} />
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={tableCols.length || 1} sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>Nothing matches.</TableCell></TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow
                    key={String(r[data!.idKey] ?? i) + String(r.lookupGroup ?? "")}
                    hover={!!editable}
                    onClick={editable ? () => setEditing(r) : undefined}
                    sx={{ cursor: editable ? "pointer" : "default", opacity: r.isActive === false ? 0.5 : 1 }}
                  >
                    {tableCols.map((c) => <TableCell key={c.key} sx={{ verticalAlign: "top" }}><Cell col={c} value={r[c.key]} /></TableCell>)}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {editing && data && (
        <EditDialog master={data} row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </Paper>
  );
}

function Cell({ col, value }: { col: Column; value: unknown }) {
  if (col.type === "bool") {
    return value ? <CheckRounded sx={{ fontSize: 18, color: SEMANTIC.success }} /> : <Typography variant="body2" sx={{ color: "text.disabled" }}>—</Typography>;
  }
  if (col.type === "list") {
    const items = (value as string[] | null) ?? [];
    return <Typography variant="body2" sx={{ color: "text.secondary" }}>{items.join(", ") || "—"}</Typography>;
  }
  if (col.key === "colorHex" && typeof value === "string") {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ width: 16, height: 16, borderRadius: 0.75, bgcolor: value, border: "1px solid", borderColor: "divider" }} />
        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{value}</Typography>
      </Box>
    );
  }
  if (col.type === "select" && col.options) {
    const opt = col.options.find((o) => o.value === value);
    return <Typography variant="body2">{opt ? opt.label.split(" — ")[0] : String(value ?? "—")}</Typography>;
  }
  if (col.key === "code") return <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 600 }}>{String(value ?? "")}</Typography>;
  return <Typography variant="body2" sx={{ color: col.key === "name" ? "text.primary" : "text.secondary" }}>{value === null || value === undefined || value === "" ? "—" : String(value)}</Typography>;
}

function EditDialog({ master, row, onClose }: { master: MasterDetail; row: Record<string, unknown> | null; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const creating = row === null;
  const initial = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const c of master.columns) {
      const v = row?.[c.key];
      out[c.key] = c.type === "list" ? ((v as string[] | undefined) ?? []).join(", ")
        : c.type === "bool" ? (creating ? c.key === "isActive" : !!v)
          : v ?? "";
    }
    return out;
  }, [master, row, creating]);
  const [f, setF] = useState<Record<string, unknown>>(initial);

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      for (const c of master.columns) {
        if (!creating && c.key === "code") continue;
        const v = f[c.key];
        body[c.key] = c.type === "int" ? (v === "" ? undefined : Number(v)) : v;
      }
      const id = String(row?.[master.idKey] ?? "");
      return creating
        ? axiosInstance.post(`/platform-masters/${master.key}`, body)
        : axiosInstance.put(`/platform-masters/${master.key}/${encodeURIComponent(id)}`, body);
    },
    onSuccess: () => {
      toast.success(creating ? "Added" : "Saved");
      qc.invalidateQueries({ queryKey: ["platform-master", master.key] });
      qc.invalidateQueries({ queryKey: ["platform-masters"] });
      onClose();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not save")),
  });

  const fields = master.columns.filter((c) => !(c.key === "code" && !creating));
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {creating ? `Add to ${master.label.toLowerCase()}` : String(row?.name ?? row?.designationGroup ?? "Edit")}
        {!creating && master.idKey === "code" && (
          <Typography variant="body2" sx={{ color: "text.secondary", fontFamily: "monospace" }}>{String(row?.code)}</Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {master.copiedToHospitals && !creating && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Hospitals keep their own name for this row. Behaviour changes reach them on the next push.
          </Alert>
        )}
        <Stack spacing={2}>
          {fields.map((c) => {
            const v = f[c.key];
            const set = (nv: unknown) => setF((p) => ({ ...p, [c.key]: nv }));
            if (c.type === "bool") {
              return (
                <Box key={c.key}>
                  <FormControlLabel control={<Switch checked={!!v} onChange={(e) => set(e.target.checked)} />} label={c.label} />
                  {c.hint && <Typography variant="caption" sx={{ display: "block", color: "text.secondary", ml: 6, mt: -0.5 }}>{c.hint}</Typography>}
                </Box>
              );
            }
            if (c.type === "select") {
              return (
                <TextField key={c.key} select fullWidth size="small" label={c.label} required={c.required} value={v ?? ""} onChange={(e) => set(e.target.value)} helperText={c.hint}>
                  {(c.options ?? []).map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                </TextField>
              );
            }
            return (
              <TextField
                key={c.key} fullWidth size="small" label={c.label} required={c.required}
                type={c.type === "int" ? "number" : "text"}
                value={v ?? ""} onChange={(e) => set(c.key === "code" ? e.target.value.toUpperCase() : e.target.value)}
                helperText={c.hint} slotProps={{ htmlInput: { maxLength: c.max, min: c.min, max: c.type === "int" ? c.max : undefined } }}
              />
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate()} sx={{ textTransform: "none", fontWeight: 600 }}>
          {creating ? "Add" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Department ↔ staff category map ─────────────────────────────────────────

function DeptStaffMap() {
  const toast = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data, isLoading, isError, error, refetch } = useQuery<{
    departments: { code: string; name: string; categoryCode: string; isActive: boolean }[];
    categories: { code: string; name: string }[];
    pairs: { departmentCode: string; staffCategoryCode: string }[];
  }>({
    queryKey: ["platform-dept-staff-map"],
    queryFn: async () => (await axiosInstance.get("/platform-masters/dept-staff-map")).data.data,
  });
  const on = useMemo(() => new Set((data?.pairs ?? []).map((p) => `${p.departmentCode}|${p.staffCategoryCode}`)), [data]);
  const depts = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.departments ?? []).filter((d) => !term || `${d.name} ${d.code}`.toLowerCase().includes(term));
  }, [data, q]);

  const toggle = useMutation({
    mutationFn: async (v: { departmentCode: string; staffCategoryCode: string; allowed: boolean }) =>
      axiosInstance.put("/platform-masters/dept-staff-map", v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-dept-staff-map"] }); qc.invalidateQueries({ queryKey: ["platform-masters"] }); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not change the map")),
  });

  return (
    <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>
      <Box sx={{ p: 2.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Department ↔ staff category</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
          Which kind of staff can have each department as their home department. Drives the department choices when a staff member is added.
        </Typography>
        <TextField size="small" placeholder="Search departments" value={q} onChange={(e) => setQ(e.target.value)} sx={{ mt: 2, width: "100%", maxWidth: 360 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
      </Box>
      {isError ? (
        <Box sx={{ p: 3 }}><ErrorState message={apiErrorText(error)} onRetry={() => refetch()} /></Box>
      ) : (
        <TableContainer sx={{ maxHeight: "calc(100vh - 330px)" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: "text.secondary", bgcolor: "background.paper" }}>Department</TableCell>
                {(data?.categories ?? []).map((c) => (
                  <TableCell key={c.code} align="center" sx={{ fontWeight: 700, color: "text.secondary", bgcolor: "background.paper", whiteSpace: "nowrap", fontSize: "0.75rem" }}>
                    <Tooltip title={c.name}><span>{c.code.replace("_", " ")}</span></Tooltip>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? <TableRowsSkeleton rows={8} columns={8} /> : depts.map((d) => (
                <TableRow key={d.code} hover sx={{ opacity: d.isActive ? 1 : 0.5 }}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{d.name}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace" }}>{d.code}</Typography>
                  </TableCell>
                  {(data?.categories ?? []).map((c) => {
                    const checked = on.has(`${d.code}|${c.code}`);
                    return (
                      <TableCell key={c.code} align="center" sx={{ p: 0 }}>
                        <Checkbox size="small" checked={checked} disabled={toggle.isPending}
                          onChange={(e) => toggle.mutate({ departmentCode: d.code, staffCategoryCode: c.code, allowed: e.target.checked })}
                          slotProps={{ input: { "aria-label": `${c.name} in ${d.name}` } }} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}

// ── Push result ──────────────────────────────────────────────────────────────

function SyncResultDialog({ result, onClose }: { result: { results: CopySummary[]; failed: { hospitalName: string; error: string }[] } | null; onClose: () => void }) {
  const hospitalsQ = useQuery<{ hospitalId: string; hospitalName: string }[]>({
    queryKey: ["platform-masters-hospital-names"],
    queryFn: async () => (await axiosInstance.get("/hospitals", { params: { limit: 500 } })).data.data,
    enabled: !!result,
  });
  if (!result) return null;
  const nameOf = (id: string) => hospitalsQ.data?.find((h) => h.hospitalId === id)?.hospitalName ?? "Hospital";
  const line = (label: string, parts: string[]) => parts.length ? `${label}: ${parts.join(", ")}` : null;
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Pushed to {result.results.length} hospital{result.results.length === 1 ? "" : "s"}</DialogTitle>
      <DialogContent dividers>
        {result.failed.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {result.failed.map((f) => `${f.hospitalName}: ${f.error}`).join(" · ")}
          </Alert>
        )}
        <Stack spacing={2}>
          {result.results.map((r) => {
            const n = (x: number, what: string) => (x ? [`${x} ${what}`] : []);
            const summary = [
              line("Ward / room / bed types added", [...n(r.wardTypes.created, "ward"), ...n(r.roomTypes.created, "room"), ...n(r.bedTypes.created, "bed")]),
              line("Designations added", n(r.designations.created, "")),
              line("Departments", [...n(r.departments.linked, "linked to the standard list"), ...n(r.departments.created, "added, switched off")]),
              line("Bed categories", [...n(r.roomClasses.linked, "room classes linked"), ...n(r.roomClasses.created, "added, switched off")]),
              line("Behaviour updated", [...n(r.wardTypes.synced + r.roomTypes.synced + r.bedTypes.synced + r.designations.synced, "rows")]),
            ].filter(Boolean);
            return (
              <Box key={r.hospitalId} sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{nameOf(r.hospitalId)}</Typography>
                {summary.length === 0 ? (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>Already up to date.</Typography>
                ) : summary.map((s) => <Typography key={s} variant="body2" sx={{ color: "text.secondary" }}>{s}</Typography>)}
                {(r.departments.unlinkedOwn.length > 0 || r.roomClasses.unlinkedOwn.length > 0) && (
                  <Typography variant="caption" sx={{ display: "block", mt: 1, color: NEUTRAL.muted }}>
                    Kept as the hospital&apos;s own (no standard match): {[...r.departments.unlinkedOwn, ...r.roomClasses.unlinkedOwn].join(", ")}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="contained" onClick={onClose} sx={{ textTransform: "none", fontWeight: 600 }}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
