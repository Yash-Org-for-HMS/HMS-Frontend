import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Paper, Typography, TextField, MenuItem, Button, Chip, Tabs, Tab, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, InputAdornment, Divider,
} from "@mui/material";
import { SearchRounded, SaveRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";
import ErrorState from "@/components/ErrorState";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import { SEMANTIC, alpha } from "@/styles/accents";

type Row = {
  kind: "MEDICINE" | "CHARGE_ITEM";
  id: string;
  name: string;
  secondary: string | null;
  taxPercent: number;
  hsnCode: string | null;
  needsAttention: boolean;
};

type Config = { gstin: string | null; medicines: Row[]; chargeItems: Row[] };

/** The only rates GST uses. Anything else is a typo. */
const RATES = [0, 5, 12, 18, 28];

/**
 * The catalogue behind the GST return, editable where the return is read.
 *
 * The report already counted what was unconfigured — medicines with no HSN,
 * taxable charge items with none — and then sent you to the Medicine Catalogue
 * and the Schedule of Charges to fix 248 rows one at a time, in two screens
 * that say nothing about the return they feed. Counting a problem in one place
 * and fixing it in another is how a catalogue stays half-set for a year.
 *
 * Edits are held locally and saved together: setting a rate and a code on
 * thirty medicines should be one action, not sixty round trips.
 */
export default function GstSetup() {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [onlyGaps, setOnlyGaps] = useState(false);
  /** id -> the edits not yet saved. */
  const [edits, setEdits] = useState<Record<string, { taxPercent?: number; hsnCode?: string }>>({});

  const { data, isLoading, isError, error, refetch } = useQuery<Config>({
    queryKey: ["gst-config"],
    queryFn: async () => (await axiosInstance.get("/billing/gst-config")).data.data,
  });

  const save = useMutation({
    mutationFn: async (rows: unknown[]) => (await axiosInstance.put("/billing/gst-config", { rows })).data.data,
    onSuccess: (res: { updated: number }) => {
      toast.success(`${res.updated} item${res.updated === 1 ? "" : "s"} updated.`);
      setEdits({});
      qc.invalidateQueries({ queryKey: ["gst-config"] });
      // The report's readiness counts come from the same catalogue.
      qc.invalidateQueries({ queryKey: ["gst-report"] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not save")),
  });

  // Memoised so the filter below does not see a new array identity on every
  // render — `?? []` creates a fresh one each time otherwise.
  const all = useMemo(
    () => (tab === 0 ? data?.medicines ?? [] : data?.chargeItems ?? []),
    [tab, data],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((r) => {
      if (onlyGaps && !r.needsAttention) return false;
      if (!q) return true;
      return `${r.name} ${r.secondary ?? ""} ${r.hsnCode ?? ""}`.toLowerCase().includes(q);
    });
  }, [all, search, onlyGaps]);

  const edited = Object.keys(edits).length;

  /**
   * Render a page at a time. Every row carries a MUI Select and a text field,
   * and the charge-item tab has 208 of them — that is 416 inputs plus a
   * thousand MenuItem children in one commit, which locked the tab up for
   * seconds on click. Medicines (40) was fine; the difference was the row count,
   * not the code.
   *
   * Only the RENDERING is paged. `rows` stays the whole filtered set, so the
   * gap count and Apply-to-all still mean what they say.
   */
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // Clamped rather than reset in an effect: filtering to fewer rows than the
  // current page would otherwise render one empty frame before correcting.
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const setEdit = (id: string, patch: { taxPercent?: number; hsnCode?: string }) =>
    setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  const valueOf = (r: Row) => ({
    taxPercent: edits[r.id]?.taxPercent ?? r.taxPercent,
    hsnCode: edits[r.id]?.hsnCode ?? r.hsnCode ?? "",
  });

  /**
   * What the status chip reports — three states, not two.
   *
   * It used to count gaps alone, which made "No gaps" mean both "every taxed
   * item is coded" and "nothing is configured at all". Those are opposite
   * answers to the only question this page exists to settle. They looked the
   * same because an unconfigured row is 0% by schema default, and a 0% row
   * correctly needs no HSN — so a hospital that had set nothing scored a clean
   * green. `taxed` separates them.
   *
   * Counted off the STAGED values, like the per-row warnings, so the tally
   * falls as codes are typed instead of freezing until a save.
   */
  const status = useMemo(() => {
    let taxed = 0, gaps = 0;
    for (const r of all) {
      const rate = edits[r.id]?.taxPercent ?? r.taxPercent;
      if (rate <= 0) continue;
      taxed += 1;
      if (!String(edits[r.id]?.hsnCode ?? r.hsnCode ?? "").trim()) gaps += 1;
    }
    return { taxed, gaps };
  }, [all, edits]);

  /** Apply one code and rate to every row currently listed. */
  const applyToVisible = (hsnCode: string, taxPercent: number | null) => {
    const patch: Record<string, { taxPercent?: number; hsnCode?: string }> = {};
    for (const r of rows) {
      patch[r.id] = {
        ...edits[r.id],
        ...(hsnCode ? { hsnCode } : {}),
        ...(taxPercent != null ? { taxPercent } : {}),
      };
    }
    setEdits((e) => ({ ...e, ...patch }));
  };

  const submit = () => {
    const payload = Object.entries(edits).map(([id, patch]) => {
      const row = [...(data?.medicines ?? []), ...(data?.chargeItems ?? [])].find((r) => r.id === id)!;
      return { kind: row.kind, id, ...patch };
    });
    if (payload.length) save.mutate(payload);
  };

  if (isLoading) return <ListSkeleton />;
  if (isError || !data) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        These rates and codes decide what appears on the return. Healthcare services are
        exempt — leave them at 0% with no code. Goods sold to a patient, chiefly medicines
        and consumables, are taxable and need an HSN. Take both from your supplier invoices.
      </Alert>

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <Tabs value={tab} onChange={(_, v) => { setTab(v); setSearch(""); setPage(0); }} sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tab sx={{ textTransform: "none", fontWeight: 700 }} label={`Medicines (${data.medicines.length})`} />
          <Tab sx={{ textTransform: "none", fontWeight: 700 }} label={`Charge items (${data.chargeItems.length})`} />
        </Tabs>

        <Box sx={{ px: 2, py: 1.75, display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid", borderColor: "divider" }}>
          <TextField
            size="small" placeholder="Search by name or code…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ minWidth: 240, flex: 1 }}
            slotProps={{ input: { startAdornment: (
              <InputAdornment position="start"><SearchRounded fontSize="small" sx={{ color: "text.secondary" }} /></InputAdornment>
            ) } }}
          />
          {/* Filing readiness. Only the red state is a filter — clicking green
              used to narrow the list to nothing and render "Nothing matches.",
              a button whose whole job was to show you an empty table. */}
          <StatusChip
            taxed={status.taxed}
            gaps={status.gaps}
            active={onlyGaps}
            /* Still clickable while the filter is ON even once the count hits
               zero — coding the last gap must not strand you in a filtered
               list with no way back out. */
            onToggle={status.gaps || onlyGaps ? () => { setOnlyGaps((v) => !v); setPage(0); } : undefined}
          />
        </Box>

        {/* Set one code and rate across everything currently listed — the point
            of doing this here rather than row by row in another screen. */}
        <BulkBar count={rows.length} onApply={applyToVisible} />

        <TableContainer sx={{ maxHeight: "max(320px, calc(100vh - 460px))" }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                {/* Equal widths so the two controls read as a pair. */}
                <TableCell sx={{ fontWeight: 700, width: 170 }}>GST rate</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 170 }}>HSN / SAC</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={3}>
                  <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center", py: 4 }}>
                    Nothing matches.
                  </Typography>
                </TableCell></TableRow>
              ) : pageRows.map((r) => {
                const v = valueOf(r);
                const dirty = !!edits[r.id];
                // Live, so the warning clears as soon as a code is typed rather
                // than only after a save.
                const gap = v.taxPercent > 0 && !String(v.hsnCode).trim();
                return (
                  <TableRow
                    key={r.id} hover
                    sx={{
                      ...(dirty ? { bgcolor: alpha(SEMANTIC.info, 0.05) } : null),
                      // Both controls are the same height now, so centring them
                      // keeps the pair level against a two-line item name.
                      "& td": { verticalAlign: "middle" },
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.name}</Typography>
                      {r.secondary && (
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>{r.secondary}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <TextField
                        select size="small" fullWidth value={v.taxPercent}
                        onChange={(e) => setEdit(r.id, { taxPercent: Number(e.target.value) })}
                      >
                        {RATES.map((x) => (
                          <MenuItem key={x} value={x}>{x === 0 ? "Exempt (0%)" : `${x}%`}</MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      {/* No helperText, deliberately.
                          It reserved a line under this field and not under the
                          rate select beside it, so the two boxes sat at
                          different heights on every row. The gap is already
                          said three other ways: the red border here, the
                          placeholder, and the counting chip above. */}
                      <TextField
                        size="small" fullWidth value={v.hsnCode}
                        placeholder={gap ? "Needs a code" : v.taxPercent > 0 ? "e.g. 3004" : "not needed"}
                        onChange={(e) => setEdit(r.id, { hsnCode: e.target.value })}
                        error={gap}
                        title={gap ? "This item is taxed, so it needs an HSN/SAC to be filed" : undefined}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <Divider />
        {pageCount > 1 && (
          <Box sx={{ px: 2, py: 1.25, display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
            <Button
              type="button" size="small" disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              sx={{ textTransform: "none" }}
            >
              Previous
            </Button>
            <Typography variant="caption" sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
              {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, rows.length)} of {rows.length}
            </Typography>
            <Button
              type="button" size="small" disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              sx={{ textTransform: "none" }}
            >
              Next
            </Button>
          </Box>
        )}
        <Box sx={{ px: 2, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          {/* Counts every edit, not just those on this page — paging away from
              a change must not look like losing it. */}
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {edited ? `${edited} unsaved change${edited === 1 ? "" : "s"}` : "No unsaved changes"}
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            {edited > 0 && (
              <Button type="button" onClick={() => setEdits({})} sx={{ textTransform: "none", color: "text.secondary" }}>
                Discard
              </Button>
            )}
            <Button
              type="button" variant="contained" startIcon={<SaveRounded />}
              disabled={!edited || save.isPending} onClick={submit}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              {save.isPending ? "Saving…" : `Save ${edited || ""}`.trim()}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

/** Set one rate and code across every row the filters are currently showing. */
/**
 * Whether this catalogue can be filed, in one chip.
 *
 *   nothing taxed  → grey  "No tax rates set yet"
 *   taxed, gaps    → red   "7 missing an HSN"        (click to filter to them)
 *   taxed, no gaps → green "52 taxed items, all coded"
 *
 * The middle state is the only one that filters, because it is the only one
 * with anything to filter to. Without `onToggle` the chip renders as a label,
 * so it neither invites a click nor takes focus.
 */
function StatusChip({ taxed, gaps, active, onToggle }: {
  taxed: number; gaps: number; active: boolean; onToggle?: () => void;
}) {
  const [label, tone, hint] =
    taxed === 0
      ? ["No tax rates set yet", null,
         "Nothing here is taxed, so nothing needs an HSN/SAC yet. Set a rate on whatever you charge GST on."]
      : gaps > 0
        ? [`${gaps} missing an HSN`, SEMANTIC.danger,
           "Taxed, but with no code to file it under — this is what blocks a GSTR-1 Table 12 filing. Click to see only these."]
        : [`${taxed} taxed item${taxed === 1 ? "" : "s"}, all coded`, SEMANTIC.success,
           "Every item you charge GST on has an HSN/SAC."];

  return (
    <Chip
      label={label}
      title={hint}
      {...(onToggle ? { onClick: onToggle } : {})}
      variant={active ? "filled" : "outlined"}
      sx={{
        fontWeight: 700,
        ...(tone
          ? { color: tone, borderColor: alpha(tone, 0.5), ...(active ? { bgcolor: alpha(tone, 0.12) } : {}) }
          : { color: "text.secondary" }),
      }}
    />
  );
}

function BulkBar({ count, onApply }: { count: number; onApply: (hsn: string, rate: number | null) => void }) {
  const [hsn, setHsn] = useState("");
  const [rate, setRate] = useState<string>("");

  return (
    <Box sx={{ px: 2, py: 1.5, display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap", bgcolor: "action.hover" }}>
      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
        Apply to all {count} matching:
      </Typography>
      <TextField
        select size="small" label="Rate" value={rate} onChange={(e) => setRate(e.target.value)} sx={{ width: 140 }}
      >
        <MenuItem value="">leave as is</MenuItem>
        {RATES.map((x) => <MenuItem key={x} value={String(x)}>{x === 0 ? "Exempt (0%)" : `${x}%`}</MenuItem>)}
      </TextField>
      <TextField
        size="small" label="HSN / SAC" value={hsn} onChange={(e) => setHsn(e.target.value)}
        placeholder="leave blank to keep" sx={{ width: 170 }}
      />
      <Button
        type="button" size="small" variant="outlined"
        disabled={!count || (!hsn.trim() && rate === "")}
        onClick={() => { onApply(hsn.trim(), rate === "" ? null : Number(rate)); setHsn(""); setRate(""); }}
        sx={{ textTransform: "none", fontWeight: 600 }}
      >
        Apply
      </Button>
      {/* Staged, not written — the save button at the bottom is still the only
          thing that touches the database. */}
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        Staged only — nothing is saved until you press Save.
      </Typography>
    </Box>
  );
}
