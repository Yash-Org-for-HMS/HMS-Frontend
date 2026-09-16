import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete, Box, Button, Checkbox, Chip, FormControlLabel, IconButton,
  MenuItem, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import {
  DeleteOutlineRounded, StarRounded, StarBorderRounded, AddRounded,
} from "@mui/icons-material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { ListSkeleton } from "@/components/TableRowsSkeleton";

/**
 * The coded diagnoses on one encounter.
 *
 * Replaces the single "Primary Diagnosis (ICD-10)" box, which could hold one
 * diagnosis, stored it as a sentence, and therefore could not be counted, put
 * on a claim, or told apart from a note. A patient routinely has more than one
 * condition and a payer wants to know which was primary, so that is what this
 * records.
 *
 * Lives in components/clinical rather than in the doctor's folder because the
 * same panel serves the consultation, the admission and a claim - the only
 * difference is which encounter it is pointed at.
 *
 * Searching is deliberately tier-limited by default. The catalog holds ~98k
 * ICD-10-CM codes, but tiers 3 and 4 are the WHO ICD-10 levels Indian TPAs
 * accept, so those are what a clinician is offered unless they ask for the
 * deeper ones. A term that has no code is still recordable as free text: being
 * unable to name a condition in ICD-10 must never stop it being written down.
 */

export type DiagnosisEncounter = {
  encounterType: "OPD" | "IPD" | "SURGERY" | "CLAIM";
  consultationId?: string | null;
  admissionId?: string | null;
  operativeRecordId?: string | null;
  claimId?: string | null;
};

type CatalogHit = {
  diagnosisCodeId: number;
  code: string;
  title: string;
  chapter: string | null;
  isBillable: boolean;
  tier: number;
};

type DiagnosisRow = {
  patientDiagnosisId: string;
  code: string | null;
  title: string | null;
  freeText: string | null;
  rank: string;
  certainty: string;
  presentOnAdmission: boolean | null;
  notes: string | null;
};

const CERTAINTIES = [
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PROVISIONAL", label: "Provisional" },
  { value: "RULED_OUT", label: "Ruled out" },
];

function encounterId(e: DiagnosisEncounter): string | null {
  return e.consultationId || e.admissionId || e.operativeRecordId || e.claimId || null;
}

/** The query string that names this encounter to the API. */
function encounterQuery(e: DiagnosisEncounter): string {
  const p = new URLSearchParams({ encounterType: e.encounterType });
  if (e.consultationId) p.set("consultationId", e.consultationId);
  if (e.admissionId) p.set("admissionId", e.admissionId);
  if (e.operativeRecordId) p.set("operativeRecordId", e.operativeRecordId);
  if (e.claimId) p.set("claimId", e.claimId);
  return p.toString();
}

export default function DiagnosisPanel({
  encounter,
  readOnly = false,
  ensureEncounter,
  label = "Diagnoses",
  onChanged,
}: {
  encounter: DiagnosisEncounter;
  readOnly?: boolean;
  /**
   * Creates the encounter on demand and returns its id. The consultation row
   * does not exist until the note is first saved, so without this the panel
   * would be dead on a brand-new consultation.
   */
  ensureEncounter?: () => Promise<string | null>;
  label?: string;
  /**
   * Fired after anything here changes. The server rewrites the encounter's old
   * free-text diagnosis field from these rows, so a screen still holding that
   * value in form state needs to re-read it rather than keep a stale copy and
   * save it back over the top.
   */
  onChanged?: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();

  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<CatalogHit | null>(null);
  const [certainty, setCertainty] = useState("CONFIRMED");
  const [deepCodes, setDeepCodes] = useState(false);
  const [poa, setPoa] = useState(encounter.encounterType === "IPD");
  const [busy, setBusy] = useState(false);

  const id = encounterId(encounter);
  const key = ["diagnoses", encounter.encounterType, id];

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 300);
    return () => clearTimeout(t);
  }, [term]);

  const { data: rows = [], isLoading } = useQuery<DiagnosisRow[]>({
    queryKey: key,
    enabled: !!id,
    queryFn: async () => {
      const res = await axiosInstance.get(`/clinical/diagnoses?${encounterQuery(encounter)}`);
      return res.data.data ?? [];
    },
  });

  const { data: options = [], isFetching: searching } = useQuery<CatalogHit[]>({
    queryKey: ["diagnosis-codes", debounced, deepCodes],
    enabled: debounced.trim().length >= 2,
    queryFn: async () => {
      const res = await axiosInstance.get(
        `/clinical/diagnoses/codes?q=${encodeURIComponent(debounced)}${deepCodes ? "" : "&maxTier=4"}`,
      );
      return res.data.data ?? [];
    },
  });

  const hasPrimary = useMemo(() => rows.some((r) => r.rank === "PRIMARY"), [rows]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    // The old free-text field is rewritten from these rows, so anything showing
    // the consultation needs to re-read it too.
    qc.invalidateQueries({ queryKey: ["consultation"] });
    onChanged?.();
  };

  const add = async () => {
    const freeText = picked ? null : term.trim();
    if (!picked && !freeText) return;

    setBusy(true);
    try {
      let target = encounter;
      if (!encounterId(target)) {
        const fresh = ensureEncounter ? await ensureEncounter() : null;
        if (!fresh) {
          toast.error("Save the consultation first, then add a diagnosis");
          return;
        }
        target = { ...encounter, consultationId: fresh };
      }

      await axiosInstance.post("/clinical/diagnoses", {
        encounterType: target.encounterType,
        consultationId: target.consultationId ?? undefined,
        admissionId: target.admissionId ?? undefined,
        operativeRecordId: target.operativeRecordId ?? undefined,
        claimId: target.claimId ?? undefined,
        diagnosisCodeId: picked?.diagnosisCodeId,
        freeText,
        // The first diagnosis on an encounter is the primary one unless the
        // clinician later says otherwise.
        rank: hasPrimary ? "SECONDARY" : "PRIMARY",
        certainty,
        presentOnAdmission: target.encounterType === "IPD" ? poa : undefined,
      });
      setPicked(null);
      setTerm("");
      refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not add the diagnosis"));
    } finally {
      setBusy(false);
    }
  };

  const makePrimary = useMutation({
    mutationFn: (rowId: string) => axiosInstance.put(`/clinical/diagnoses/${rowId}`, { rank: "PRIMARY" }),
    onSuccess: refresh,
    onError: (err) => toast.error(getApiErrorMessage(err, "Could not change the primary diagnosis")),
  });

  const remove = useMutation({
    mutationFn: (rowId: string) => axiosInstance.delete(`/clinical/diagnoses/${rowId}`),
    onSuccess: refresh,
    onError: (err) => toast.error(getApiErrorMessage(err, "Could not remove the diagnosis")),
  });

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: "text.primary" }}>
        {label}
      </Typography>

      {isLoading ? (
        <ListSkeleton rows={2} />
      ) : rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
          Nothing recorded yet.
        </Typography>
      ) : (
        <Stack spacing={1} sx={{ mb: 2 }}>
          {rows.map((r) => (
            <Box
              key={r.patientDiagnosisId}
              sx={{
                display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1,
                border: "1px solid", borderColor: "divider", borderRadius: 1.5,
                bgcolor: r.rank === "PRIMARY" ? "action.hover" : "transparent",
              }}
            >
              <Tooltip title={r.rank === "PRIMARY" ? "Primary diagnosis" : "Make this the primary diagnosis"}>
                <span>
                  <IconButton
                    size="small"
                    disabled={readOnly || r.rank === "PRIMARY" || makePrimary.isPending}
                    onClick={() => makePrimary.mutate(r.patientDiagnosisId)}
                  >
                    {r.rank === "PRIMARY" ? (
                      <StarRounded fontSize="small" color="warning" />
                    ) : (
                      <StarBorderRounded fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {r.code ? `[${r.code}] ${r.title}` : r.freeText}
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
                  {!r.code && <Chip size="small" variant="outlined" label="Not coded" />}
                  {r.certainty !== "CONFIRMED" && (
                    <Chip
                      size="small"
                      color={r.certainty === "RULED_OUT" ? "default" : "info"}
                      label={CERTAINTIES.find((c) => c.value === r.certainty)?.label ?? r.certainty}
                    />
                  )}
                  {r.presentOnAdmission && <Chip size="small" variant="outlined" label="Present on admission" />}
                </Stack>
              </Box>

              {!readOnly && (
                <IconButton
                  size="small"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(r.patientDiagnosisId)}
                  aria-label="Remove diagnosis"
                >
                  <DeleteOutlineRounded fontSize="small" />
                </IconButton>
              )}
            </Box>
          ))}
        </Stack>
      )}

      {!readOnly && (
        <Stack spacing={1.25}>
          <Autocomplete
            freeSolo
            options={options}
            value={picked}
            filterOptions={(x) => x}
            getOptionLabel={(o) => (typeof o === "string" ? o : `[${o.code}] ${o.title}`)}
            isOptionEqualToValue={(a, b) => a.diagnosisCodeId === b.diagnosisCodeId}
            loading={searching}
            // Controlled, so clearing `term` after a successful add actually
            // empties the box. Left uncontrolled, the chosen label stayed in the
            // input while `picked` reset to null, and the button flipped back to
            // "Add as free text" - one more click would have filed the literal
            // string "[U09] Post COVID-19 condition" as an uncoded diagnosis.
            inputValue={term}
            onInputChange={(_e, v, reason) => {
              setTerm(v);
              // Typing over a chosen code deselects it; only a pick re-sets it.
              if (reason === "input") setPicked(null);
            }}
            onChange={(_e, v) => setPicked(typeof v === "string" ? null : v)}
            noOptionsText={
              debounced.trim().length < 2
                ? "Type at least two characters"
                : "No matching code - it can still be recorded as free text"
            }
            renderOption={(props, o) => (
              <li {...props} key={o.diagnosisCodeId}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    [{o.code}] {o.title}
                  </Typography>
                  {o.chapter && (
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {o.chapter}
                    </Typography>
                  )}
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Add a diagnosis (ICD-10)"
                placeholder="Search a code or term, e.g. E11.9 or diabetes"
                fullWidth
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {searching ? <HeartbeatLoader size={22} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />

          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", alignItems: "center", gap: 1 }}>
            <TextField
              select
              size="small"
              label="Certainty"
              value={certainty}
              onChange={(e) => setCertainty(e.target.value)}
              sx={{ minWidth: 150 }}
            >
              {CERTAINTIES.map((c) => (
                <MenuItem key={c.value} value={c.value}>
                  {c.label}
                </MenuItem>
              ))}
            </TextField>

            {encounter.encounterType === "IPD" && (
              <FormControlLabel
                control={<Checkbox size="small" checked={poa} onChange={(e) => setPoa(e.target.checked)} />}
                label={<Typography variant="body2">Present on admission</Typography>}
              />
            )}

            <Tooltip title="Also offer the finer ICD-10-CM sub-codes, beyond the levels payers usually take">
              <FormControlLabel
                control={<Checkbox size="small" checked={deepCodes} onChange={(e) => setDeepCodes(e.target.checked)} />}
                label={<Typography variant="body2">Detailed codes</Typography>}
              />
            </Tooltip>

            <Box sx={{ flex: 1 }} />
            <Button
              variant="contained"
              size="small"
              startIcon={<AddRounded />}
              disabled={busy || (!picked && term.trim().length === 0)}
              onClick={add}
            >
              {picked ? "Add" : "Add as free text"}
            </Button>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}
