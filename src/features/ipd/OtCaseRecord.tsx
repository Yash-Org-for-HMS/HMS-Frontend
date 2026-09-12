import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useIsNursePanel } from "./panelBase";
import CaseJourney from "./CaseJourney";
import { SEMANTIC, NEUTRAL, BRAND } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Grid, Chip, Tabs, Tab, Button, Stack, MenuItem,
  TextField, Checkbox, FormControlLabel, IconButton, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from "@mui/material";
import PatientHistoryButton from "@/components/clinical/PatientHistoryButton";
import {
  ArrowBackRounded, CheckCircleRounded, RadioButtonUncheckedRounded, DeleteOutlineRounded,
  AddRounded, WarningAmberRounded, ScheduleRounded, PersonRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import PageHeader from "@/components/layout/PageHeader";

/**
 * One case, during the case.
 *
 * The plan's own risk section says it plainly: an operative record filled in
 * the next morning from memory is worse than a paper one. So this screen is
 * built for a wall-mounted display and gloved hands — big targets, five short
 * tabs instead of one forty-field form, every section saving on its own, and
 * nothing required in order to save.
 *
 * The one place it deliberately refuses to be helpful is the count. A swab
 * short blocks sign-out, and the screen says so rather than offering an
 * override, because a count you can click past is not a count.
 */

const TEAM_ROLES: { value: string; label: string }[] = [
  { value: "PRIMARY_SURGEON", label: "Primary surgeon" },
  { value: "ASSISTANT", label: "Assistant" },
  { value: "ANAESTHETIST", label: "Anaesthetist" },
  { value: "SCRUB_NURSE", label: "Scrub nurse" },
  { value: "CIRCULATING_NURSE", label: "Circulating nurse" },
  { value: "TECHNICIAN", label: "Technician" },
];
const ROLE_LABEL: Record<string, string> = Object.fromEntries(TEAM_ROLES.map((r) => [r.value, r.label]));
const ANAESTHESIA = ["GENERAL", "SPINAL", "EPIDURAL", "REGIONAL", "LOCAL", "SEDATION", "BLOCK"];
const ASA = ["I", "II", "III", "IV", "V", "VI"];
const CONSENT_TYPES: { value: string; label: string }[] = [
  { value: "SURGICAL", label: "Surgical" },
  { value: "ANAESTHESIA", label: "Anaesthesia" },
  { value: "BLOOD_TRANSFUSION", label: "Blood transfusion" },
  { value: "PHOTOGRAPHY", label: "Photography" },
  { value: "HIGH_RISK", label: "High risk" },
];
const GIVERS = [
  { value: "PATIENT", label: "The patient" },
  { value: "NEXT_OF_KIN", label: "Next of kin" },
  { value: "GUARDIAN", label: "Guardian" },
];
const CHARGE_TYPES: { value: string; label: string }[] = [
  { value: "SURGEON_FEE", label: "Surgeon fee" },
  { value: "ASSISTANT_FEE", label: "Assistant fee" },
  { value: "ANAESTHETIST_FEE", label: "Anaesthetist fee" },
  { value: "OT_CHARGE", label: "Theatre charge" },
  { value: "ANAESTHESIA_CHARGE", label: "Anaesthesia charge" },
  { value: "RECOVERY_CHARGE", label: "Recovery charge" },
  { value: "CONSUMABLE", label: "Consumable" },
  { value: "IMPLANT", label: "Implant" },
  { value: "OTHER", label: "Other" },
];
const TIMES: { key: string; label: string }[] = [
  { key: "wheeledInAt", label: "Wheeled in" },
  { key: "anaesthesiaStart", label: "Anaesthesia start" },
  { key: "incisionAt", label: "Incision" },
  { key: "closureAt", label: "Closure" },
  { key: "anaesthesiaEnd", label: "Anaesthesia end" },
  { key: "wheeledOutAt", label: "Wheeled out" },
];
/** Turns the server's item codes into something a person reads aloud. */
const itemLabel = (code: string) =>
  code.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const clock = (s?: string | null) =>
  s ? new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

export default function OtCaseRecord() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const isNurse = useIsNursePanel();
  const [tab, setTab] = useState(0);
  const [placing, setPlacing] = useState(false);

  const recordQ = useQuery({
    queryKey: ["ot-case-record", id],
    queryFn: async () => (await axiosInstance.get(`/ipd/ot/cases/${id}/record`)).data.data,
  });
  const checklistQ = useQuery({
    queryKey: ["ot-case-checklist", id],
    queryFn: async () => (await axiosInstance.get(`/ipd/ot/cases/${id}/checklist`)).data.data,
  });
  const consentsQ = useQuery({
    queryKey: ["ot-case-consents", id],
    queryFn: async () => (await axiosInstance.get(`/ipd/ot/cases/${id}/consents`)).data.data,
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["ot-case-record", id] });
    qc.invalidateQueries({ queryKey: ["ot-case-checklist", id] });
    qc.invalidateQueries({ queryKey: ["ot-case-consents", id] });
    // Wheeling in and out moves the patient, so the ward board and the theatre
    // board are stale the moment it happens.
    qc.invalidateQueries({ queryKey: ["ipd-structure"] });
    qc.invalidateQueries({ queryKey: ["ot-theatres-pick"] });
    qc.invalidateQueries({ queryKey: ["ot-theatres"] });
    qc.invalidateQueries({ queryKey: ["ot-day-list"] });
  };

  /**
   * The journey's one action.
   *
   * Both wheel events go through the record endpoint — the same path the times
   * have always used — so there is exactly one way a patient moves, whichever
   * screen the button was pressed on.
   */
  const journeyAction = useMutation({
    mutationFn: async (a: "WHEEL_IN" | "WHEEL_OUT") =>
      (await axiosInstance.put(`/ipd/ot/cases/${id}/record`, {
        [a === "WHEEL_IN" ? "wheeledInAt" : "wheeledOutAt"]: new Date().toISOString(),
      })).data,
    onSuccess: (res, a) => {
      const m = (res as { movement?: { status?: string } } | undefined)?.movement?.status;
      toast.success(
        m === "moved"
          ? a === "WHEEL_IN" ? "In theatre — the ward board now shows them away" : "Out to recovery — their bed is still held"
          : m === "no-theatre" ? "Time recorded. No theatre is booked for this case, so the patient was not moved"
          : m === "theatre-busy" ? "Time recorded. The theatre is not free, so the patient was not moved"
          : "Time recorded",
      );
      refreshAll();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not move the patient")),
  });

  if (recordQ.isLoading) return <ListSkeleton />;
  if (recordQ.isError) return <ErrorState message={apiErrorText(recordQ.error)} onRetry={() => recordQ.refetch()} />;

  const surgery = recordQ.data?.surgery;
  const counts = checklistQ.data?.counts ?? { correct: null, mismatches: [] };

  return (
    <Box>
      <PageHeader
        title={surgery?.procedureName || "Case"}
        subtitle={surgery?.patientName
          ? `${surgery.patientName}${surgery.uhid ? ` · ${surgery.uhid}` : ""} — save each section as you go`
          : "The record for this case — save each section as you go"}
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            {/* What has happened to this patient before, without leaving the
                record that is being written about them now. */}
            <PatientHistoryButton patientId={surgery?.patientId} patientName={surgery?.patientName} uhid={surgery?.uhid} />
            <Button startIcon={<ArrowBackRounded />} sx={{ textTransform: "none" }} onClick={() => navigate(-1)}>
              Back to the list
            </Button>
          </Stack>
        }
      />

      {/* A count that does not match is the one thing this screen shouts about,
          on every tab, until it is resolved. */}
      {counts.correct === false && (
        <Alert severity="error" icon={<WarningAmberRounded />} sx={{ mb: 2, fontWeight: 600 }}>
          {counts.mismatches.join(" and ")} count does not match. This case cannot be signed out until it is resolved.
        </Alert>
      )}

      {/* The journey, and the single next action. Everything below is detail
          to be filled in; this is how the case is actually driven. */}
      <CaseJourney
        j={{
          status: surgery?.status ?? "SCHEDULED",
          patientLocation: surgery?.patientLocation ?? null,
          bedNumber: surgery?.bedNumber ?? null,
          theatreName: recordQ.data?.surgery?.theatreName ?? null,
          wheeledInAt: recordQ.data?.record?.wheeledInAt ?? null,
          wheeledOutAt: recordQ.data?.record?.wheeledOutAt ?? null,
        }}
        busy={journeyAction.isPending}
        onAction={(a) => {
          if (a === "PLACE_IN_BED") return setPlacing(true);
          journeyAction.mutate(a);
        }}
      />

      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ px: 1, "& .MuiTab-root": { textTransform: "none", fontWeight: 700, minHeight: 56 } }}>
          <Tab label="Safety checklist" />
          <Tab label="Team" />
          <Tab label="Anaesthesia" />
          <Tab label="Procedure" />
          <Tab label="Implants" />
          <Tab label="Consent" />
          {/* What a case costs is a billing decision. The scrub nurse runs the
              checklist and counts the swabs; she does not set the surgeon's
              fee, and the API refuses it for her too. */}
          {!isNurse && <Tab label="Billing" />}
        </Tabs>
      </Paper>

      {tab === 0 && <ChecklistTab id={id} data={checklistQ.data} onSaved={refreshAll} />}
      {tab === 1 && <TeamTab id={id} team={recordQ.data?.team ?? []} onSaved={refreshAll} />}
      {tab === 2 && <AnaesthesiaTab id={id} record={recordQ.data?.record} onSaved={refreshAll} />}
      {tab === 3 && <ProcedureTab id={id} record={recordQ.data?.record} onSaved={refreshAll} />}
      {tab === 4 && <ImplantsTab id={id} implants={recordQ.data?.implants ?? []} onSaved={refreshAll} />}
      {tab === 5 && <ConsentTab id={id} consents={consentsQ.data ?? []} onSaved={refreshAll} />}
      {tab === 6 && !isNurse && <BillingTab id={id} />}

      {placing && surgery?.admissionId && (
        <PlaceFromRecoveryDialog
          admissionId={surgery.admissionId}
          heldBed={surgery.bedHeldForReturn ? surgery.bedNumber : null}
          onClose={() => setPlacing(false)}
          onDone={() => { setPlacing(false); refreshAll(); }}
        />
      )}
    </Box>
  );
}

// ── Billing ──────────────────────────────────────────────────────────────────

/**
 * The theatre bill, line by line.
 *
 * "Auto-price" builds the standard lines from what the case already knows — who
 * was in the room, how long the theatre was used for, which implants went in.
 * It adds only what is missing, so pressing it twice is safe, and it says so
 * rather than silently doing nothing.
 */
function BillingTab({ id }: { id: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState({ chargeType: "OTHER", description: "", unitPrice: "", quantity: "1", taxPercent: "0" });
  const [rates, setRates] = useState({ surgeonFee: "", assistantFee: "", anaesthetistFee: "", otHourlyRate: "", anaesthesiaCharge: "", recoveryCharge: "" });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ot-case-charges", id],
    queryFn: async () => (await axiosInstance.get(`/ipd/ot/cases/${id}/charges`)).data.data,
  });

  const add = useMutation({
    mutationFn: async () => axiosInstance.post(`/ipd/ot/cases/${id}/charges`, {
      chargeType: f.chargeType, description: f.description.trim(),
      unitPrice: f.unitPrice ? Number(f.unitPrice) : 0,
      quantity: Number(f.quantity) || 1,
      taxPercent: f.taxPercent ? Number(f.taxPercent) : 0,
    }),
    onSuccess: () => { toast.success("Line added"); setF({ ...f, description: "", unitPrice: "" }); refetch(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not add the line")),
  });
  const remove = useMutation({
    mutationFn: async (chargeId: string) => axiosInstance.delete(`/ipd/ot/cases/${id}/charges/${chargeId}`),
    onSuccess: () => { toast.success("Removed"); refetch(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not remove the line")),
  });
  const auto = useMutation({
    mutationFn: async () => axiosInstance.post(`/ipd/ot/cases/${id}/charges/auto`, {
      rates: Object.fromEntries(Object.entries(rates).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)])),
    }),
    onSuccess: (r) => {
      toast.success(r.data?.data?.note ?? "Priced");
      qc.invalidateQueries({ queryKey: ["ot-case-charges", id] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not price the case")),
  });

  if (isLoading) return <ListSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  const charges = (data?.charges ?? []) as Record<string, string | number | null>[];
  const s = data?.summary ?? {};

  return (
    <>
      <Section title="The bill for this case">
        {charges.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>
            No lines yet. Until there are, this case bills on its single price
            {s.flatPrice ? ` of ₹${Number(s.flatPrice).toLocaleString("en-IN")}` : ""}.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {charges.map((c) => (
              <Box key={String(c.surgeryChargeId)} sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{String(c.description)}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    {String(c.label)}
                    {Number(c.quantity) > 1 ? ` · ${c.quantity} × ₹${Number(c.unitPrice).toLocaleString("en-IN")}` : ""}
                    {Number(c.taxPercent) > 0 ? ` · ${c.taxPercent}% tax` : ""}
                    {c.invoiceItemId ? " · on a bill" : ""}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  ₹{Number(c.totalPrice).toLocaleString("en-IN")}
                </Typography>
                {!c.invoiceItemId && (
                  <IconButton size="small" onClick={() => remove.mutate(String(c.surgeryChargeId))} aria-label="Remove line">
                    <DeleteOutlineRounded fontSize="small" />
                  </IconButton>
                )}
              </Box>
            ))}
            <Box sx={{ display: "flex", justifyContent: "space-between", pt: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Total {Number(s.tax) > 0 ? `(including ₹${Number(s.tax).toLocaleString("en-IN")} tax)` : ""}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 800 }}>₹{Number(s.total ?? 0).toLocaleString("en-IN")}</Typography>
            </Box>
            {Number(s.billed) > 0 && (
              <Alert severity="info">
                {s.billed} of {charges.length} lines are already on a bill and can no longer be removed here.
              </Alert>
            )}
          </Stack>
        )}
      </Section>

      <Section title="Price it from what the case knows">
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Builds the standard lines from the team recorded, the theatre time actually used, and the implants
          entered. Leave a rate blank to skip that line. Running this twice adds nothing.
        </Typography>
        <Grid container spacing={2}>
          {([
            ["surgeonFee", "Surgeon fee"], ["assistantFee", "Assistant fee"], ["anaesthetistFee", "Anaesthetist fee"],
            ["otHourlyRate", "Theatre, per hour"], ["anaesthesiaCharge", "Anaesthesia"], ["recoveryCharge", "Recovery"],
          ] as [keyof typeof rates, string][]).map(([k, label]) => (
            <Grid size={{ xs: 6, md: 4 }} key={k}>
              <TextField fullWidth size="small" label={label} value={rates[k]}
                onChange={(e) => setRates({ ...rates, [k]: e.target.value })} />
            </Grid>
          ))}
        </Grid>
        <Button variant="contained" size="large" sx={{ mt: 2, textTransform: "none", fontWeight: 700 }}
          disabled={auto.isPending} onClick={() => auto.mutate()}>
          {auto.isPending ? "Pricing…" : "Build the standard lines"}
        </Button>
      </Section>

      <Section title="Add a line by hand">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField select fullWidth label="Type" value={f.chargeType} onChange={(e) => setF({ ...f, chargeType: e.target.value })}>
              {CHARGE_TYPES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField fullWidth required label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 4 }}><TextField fullWidth label="Price" value={f.unitPrice} onChange={(e) => setF({ ...f, unitPrice: e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}><TextField fullWidth type="number" label="Quantity" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Grid>
          <Grid size={{ xs: 4 }}>
            <TextField fullWidth label="Tax %" value={f.taxPercent} onChange={(e) => setF({ ...f, taxPercent: e.target.value })}
              helperText="Charged on top" />
          </Grid>
        </Grid>
        <Button variant="contained" size="large" startIcon={<AddRounded />} sx={{ mt: 2, textTransform: "none", fontWeight: 700 }}
          disabled={!f.description.trim() || add.isPending} onClick={() => add.mutate()}>
          Add the line
        </Button>
      </Section>
    </>
  );
}

/** A save button that says what it did, used by every section. */
function useSectionSave(id: string, onSaved: () => void, message = "Saved") {
  const toast = useToast();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => axiosInstance.put(`/ipd/ot/cases/${id}/record`, body),
    onSuccess: () => { toast.success(message); onSaved(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not save")),
  });
}

const Section = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2 }}>
    <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>{title}</Typography>
      {action}
    </Box>
    {children}
  </Paper>
);

// ── Safety checklist ─────────────────────────────────────────────────────────

function ChecklistTab({ id, data, onSaved }: { id: string; data: Record<string, never> | undefined; onSaved: () => void }) {
  const toast = useToast();
  const cl = (data as Record<string, Record<string, string | number | null>> | undefined)?.checklist;
  const items = (data as Record<string, Record<string, string[]>> | undefined)?.items;
  const counts = (data as Record<string, { correct: boolean | null; mismatches: string[] }> | undefined)?.counts
    ?? { correct: null, mismatches: [] };

  const sign = useMutation({
    mutationFn: async (v: { stage: string; items: Record<string, boolean>; extra?: Record<string, unknown> }) =>
      axiosInstance.post(`/ipd/ot/cases/${id}/checklist/${v.stage}`, { items: v.items, ...(v.extra ?? {}) }),
    onSuccess: () => { toast.success("Stage signed"); onSaved(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not sign this stage")),
  });
  const saveCounts = useMutation({
    mutationFn: async (body: Record<string, unknown>) => axiosInstance.put(`/ipd/ot/cases/${id}/checklist/counts`, body),
    onSuccess: () => { toast.success("Counts saved"); onSaved(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not save the counts")),
  });

  const [ticks, setTicks] = useState<Record<string, Record<string, boolean>>>({});
  const [countForm, setCountForm] = useState<Record<string, string>>({});
  // null until the user touches it, so the saved side shows through until
  // they deliberately change it.
  const [lateralityEdit, setLateralityEdit] = useState<string | null>(null);
  const laterality = lateralityEdit ?? (cl?.laterality ? String(cl.laterality) : "");

  const stageMeta: { stage: string; title: string; when: string; atKey: string; itemsKey: string }[] = [
    { stage: "SIGN_IN", title: "Sign In", when: "Before anaesthesia", atKey: "signInAt", itemsKey: "signInItems" },
    { stage: "TIME_OUT", title: "Time Out", when: "Before the incision", atKey: "timeOutAt", itemsKey: "timeOutItems" },
    { stage: "SIGN_OUT", title: "Sign Out", when: "Before the patient leaves", atKey: "signOutAt", itemsKey: "signOutItems" },
  ];

  const countRow = (label: string, inKey: string, outKey: string) => {
    const inVal = countForm[inKey] ?? (cl?.[inKey] != null ? String(cl[inKey]) : "");
    const outVal = countForm[outKey] ?? (cl?.[outKey] != null ? String(cl[outKey]) : "");
    const mismatched = inVal !== "" && outVal !== "" && inVal !== outVal;
    return (
      <Grid size={{ xs: 12, sm: 4 }} key={label}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: mismatched ? SEMANTIC.danger : "text.secondary" }}>
          {label}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
          <TextField size="small" label="In" type="number" value={inVal}
            onChange={(e) => setCountForm({ ...countForm, [inKey]: e.target.value })} />
          <TextField size="small" label="Out" type="number" value={outVal}
            error={mismatched}
            onChange={(e) => setCountForm({ ...countForm, [outKey]: e.target.value })} />
        </Stack>
      </Grid>
    );
  };

  return (
    <>
      {stageMeta.map((m) => {
        const signedAt = cl?.[m.atKey] as string | undefined;
        const stageItems = items?.[m.stage] ?? [];
        // Start from what was actually signed, not from an empty form. A
        // signed stage that renders every box unticked is not just wrong to
        // look at — pressing "Re-sign" would record the whole stage as NOT
        // done and quietly erase the record.
        const saved = (cl?.[m.itemsKey] as unknown as Record<string, boolean> | null) ?? {};
        const current = ticks[m.stage] ?? saved;
        const allTicked = stageItems.length > 0 && stageItems.every((k) => current[k]);
        return (
          <Section
            key={m.stage}
            title={`${m.title} — ${m.when}`}
            action={signedAt
              ? <Chip size="small" icon={<CheckCircleRounded />} label={`Signed ${clock(signedAt)}`}
                  sx={{ bgcolor: `${SEMANTIC.success}1a`, color: SEMANTIC.success, fontWeight: 700 }} />
              : <Chip size="small" label="Not signed" sx={{ bgcolor: `${NEUTRAL.muted}1a`, color: NEUTRAL.muted, fontWeight: 700 }} />}
          >
            <Grid container spacing={1}>
              {stageItems.map((code) => (
                <Grid size={{ xs: 12, md: 6 }} key={code}>
                  <FormControlLabel
                    sx={{ width: "100%", m: 0, py: 0.5 }}
                    control={
                      <Checkbox
                        // Big enough to hit with a glove on.
                        sx={{ "& .MuiSvgIcon-root": { fontSize: 26 } }}
                        checked={!!current[code]}
                        onChange={(e) => setTicks({ ...ticks, [m.stage]: { ...current, [code]: e.target.checked } })}
                      />
                    }
                    label={<Typography variant="body2">{itemLabel(code)}</Typography>}
                  />
                </Grid>
              ))}
            </Grid>
            {m.stage === "SIGN_IN" && (
              <TextField select size="small" label="Side" sx={{ mt: 2, width: 200 }} value={laterality}
                onChange={(e) => setLateralityEdit(e.target.value)}
                helperText="For anything with a left and a right">
                <MenuItem value=""><em>Not applicable</em></MenuItem>
                <MenuItem value="LEFT">Left</MenuItem>
                <MenuItem value="RIGHT">Right</MenuItem>
                <MenuItem value="BILATERAL">Bilateral</MenuItem>
              </TextField>
            )}
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained" size="large" sx={{ textTransform: "none", fontWeight: 700 }}
                disabled={sign.isPending}
                onClick={() => sign.mutate({
                  stage: m.stage,
                  items: current,
                  extra: m.stage === "SIGN_IN" ? { siteMarked: !!current.SITE_MARKED, laterality: laterality || undefined } : undefined,
                })}
              >
                {/* The stage titles are already verbs — "Sign In", "Time Out",
                    "Sign Out" — so prefixing "Sign" produced "Sign Sign In". */}
                {signedAt ? `Re-confirm ${m.title}` : `Confirm ${m.title}`}
              </Button>
              {!allTicked && stageItems.length > 0 && (
                <Typography variant="caption" sx={{ color: "text.secondary", ml: 2 }}>
                  Signing records exactly what is ticked — unticked items are recorded as not done.
                </Typography>
              )}
            </Box>
          </Section>
        );
      })}

      <Section title="Counts">
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Counted in at the start and out at the end. A count that does not match blocks sign-out.
        </Typography>
        <Grid container spacing={2}>
          {countRow("Swabs", "swabCountInitial", "swabCountFinal")}
          {countRow("Instruments", "instrumentCountInitial", "instrumentCountFinal")}
          {countRow("Needles", "needleCountInitial", "needleCountFinal")}
        </Grid>
        {counts.correct === false && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {counts.mismatches.join(" and ")} short. Recount, and record what was found.
          </Alert>
        )}
        {counts.correct === true && (
          <Alert severity="success" sx={{ mt: 2 }}>All counts match.</Alert>
        )}
        <TextField fullWidth multiline minRows={2} sx={{ mt: 2 }} label="Note (what happened, what was found)"
          defaultValue={cl?.countDiscrepancyNote ?? ""}
          onChange={(e) => setCountForm({ ...countForm, countDiscrepancyNote: e.target.value })} />
        <Button variant="contained" size="large" sx={{ mt: 2, textTransform: "none", fontWeight: 700 }}
          disabled={saveCounts.isPending}
          onClick={() => {
            const body: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(countForm)) {
              if (k === "countDiscrepancyNote") body[k] = v;
              else if (v !== "") body[k] = Number(v);
            }
            saveCounts.mutate(body);
          }}>
          Save counts
        </Button>
      </Section>
    </>
  );
}

// ── Team ─────────────────────────────────────────────────────────────────────

function TeamTab({ id, team, onSaved }: { id: string; team: Record<string, string>[]; onSaved: () => void }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);

  const remove = useMutation({
    mutationFn: async (memberId: string) => axiosInstance.delete(`/ipd/ot/cases/${id}/team/${memberId}`),
    onSuccess: () => { toast.success("Removed"); onSaved(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not remove them")),
  });

  return (
    <Section title="Who is in the room" action={
      <Button startIcon={<AddRounded />} sx={{ textTransform: "none" }} onClick={() => setAdding(true)}>Add someone</Button>
    }>
      {team.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>
          Nobody recorded yet.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {team.map((t) => (
            <Box key={t.surgeryTeamMemberId} sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
              <PersonRounded sx={{ color: BRAND.action }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{t.name}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {ROLE_LABEL[t.teamRole] ?? t.teamRole}
                  {t.isExternal ? " · visiting" : ""}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => remove.mutate(t.surgeryTeamMemberId)} aria-label={`Remove ${t.name}`}>
                <DeleteOutlineRounded fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Stack>
      )}
      {adding && <AddTeamDialog id={id} onClose={() => setAdding(false)} onDone={() => { setAdding(false); onSaved(); }} />}
    </Section>
  );
}

function AddTeamDialog({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [teamRole, setTeamRole] = useState("ASSISTANT");
  const [who, setWho] = useState<"doctor" | "staff" | "external">("doctor");
  const [doctorId, setDoctorId] = useState("");
  const [userId, setUserId] = useState("");
  const [externalName, setExternalName] = useState("");

  const { data: dropdowns, isLoading: loadingDoctors } = useQuery({
    queryKey: ["appointment-dropdowns"],
    queryFn: async () => (await axiosInstance.get("/reception/appointments/dropdowns")).data.data,
  });
  // /hospital/users is admin-only, so this returned 403 and rendered an
  // empty list for the nurses and receptionists who actually fill this in.
  const { data: teamOpts, isLoading: loadingStaff } = useQuery({
    queryKey: ["ot-team-options"],
    queryFn: async () => (await axiosInstance.get("/ipd/ot/team-options")).data.data,
  });

  const add = useMutation({
    mutationFn: async () => axiosInstance.post(`/ipd/ot/cases/${id}/team`, {
      teamRole,
      doctorId: who === "doctor" ? doctorId || undefined : undefined,
      userId: who === "staff" ? userId || undefined : undefined,
      externalName: who === "external" ? externalName.trim() || undefined : undefined,
    }),
    onSuccess: () => { toast.success("Added to the team"); onDone(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not add them")),
  });

  const doctors = (dropdowns?.doctors ?? []) as { doctorId: string; user?: { firstName?: string; lastName?: string } }[];
  const staffRows = (teamOpts?.staff ?? []) as { userId: string; name: string; roleName: string }[];
  const canSave = who === "doctor" ? !!doctorId : who === "staff" ? !!userId : !!externalName.trim();

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add someone to the team</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField select label="Role" fullWidth value={teamRole} onChange={(e) => setTeamRole(e.target.value)}>
            {TEAM_ROLES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
          </TextField>
          <TextField select label="Who" fullWidth value={who} onChange={(e) => setWho(e.target.value as typeof who)}
            helperText="A visiting surgeon or agency nurse has no login — name them instead">
            <MenuItem value="doctor">A doctor here</MenuItem>
            <MenuItem value="staff">A staff member here</MenuItem>
            <MenuItem value="external">Someone visiting</MenuItem>
          </TextField>
          {who === "doctor" && (
            <TextField select label="Doctor" fullWidth value={doctorId} onChange={(e) => setDoctorId(e.target.value)}
              helperText={loadingDoctors ? "Loading…" : doctors.length ? undefined : "No doctors found"}>
              {doctors.map((d) => (
                <MenuItem key={d.doctorId} value={d.doctorId}>Dr. {d.user?.firstName || "Unknown"} {d.user?.lastName || ""}</MenuItem>
              ))}
            </TextField>
          )}
          {who === "staff" && (
            <TextField select label="Staff member" fullWidth value={userId} onChange={(e) => setUserId(e.target.value)}
              helperText={loadingStaff ? "Loading…" : staffRows.length ? undefined : "No staff found"}>
              {staffRows.map((s) => (
                <MenuItem key={s.userId} value={s.userId}>{s.name} · {s.roleName}</MenuItem>
              ))}
            </TextField>
          )}
          {who === "external" && (
            <TextField label="Their name" fullWidth value={externalName} onChange={(e) => setExternalName(e.target.value)} />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" sx={{ textTransform: "none" }} disabled={!canSave || add.isPending} onClick={() => add.mutate()}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Anaesthesia, with the six timestamps ─────────────────────────────────────

function AnaesthesiaTab({ id, record, onSaved }: { id: string; record: Record<string, string | number | null> | null; onSaved: () => void }) {
  const toast = useToast();
  const save = useSectionSave(id, onSaved, "Anaesthesia saved");
  // Wheeling in and out moves the patient as well as recording the time, so
  // the toast has to say so — a button that quietly does two things is a
  // button people stop trusting.
  const stampTime = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await axiosInstance.put(`/ipd/ot/cases/${id}/record`, body)).data,
    onSuccess: (res) => {
      const m = (res as { movement?: { status?: string } } | undefined)?.movement?.status;
      toast.success(
        m === "moved" ? "Time recorded — the patient has been moved, and the ward board now shows it"
          : m === "no-theatre" ? "Time recorded. No theatre is booked for this case, so the patient was not moved"
          : m === "theatre-busy" ? "Time recorded. The theatre is not free, so the patient was not moved — check the theatre board"
          : m === "no-admission" ? "Time recorded (day case — there is no ward bed to move them from)"
          : "Time recorded",
      );
      onSaved();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not record the time")),
  });
  const [f, setF] = useState<Record<string, string>>({});
  const val = (k: string) => f[k] ?? (record?.[k] != null ? String(record[k]) : "");

  return (
    <>
      <Section title="The six times">
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          Stamp each as it happens. Utilisation and turnaround are computed from these, and nothing else can produce them.
        </Typography>
        <Grid container spacing={1.5}>
          {TIMES.map((t) => {
            const at = record?.[t.key] as string | undefined;
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={t.key}>
                <Button
                  fullWidth variant={at ? "outlined" : "contained"} size="large"
                  startIcon={at ? <CheckCircleRounded /> : <ScheduleRounded />}
                  sx={{ textTransform: "none", fontWeight: 700, justifyContent: "flex-start", py: 1.5 }}
                  disabled={stampTime.isPending}
                  onClick={() => stampTime.mutate({ [t.key]: new Date().toISOString() })}
                >
                  <Box sx={{ textAlign: "left" }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{t.label}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.85 }}>{at ? clock(at) : "Tap to record now"}</Typography>
                  </Box>
                </Button>
              </Grid>
            );
          })}
        </Grid>
      </Section>

      <Section title="Anaesthesia">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select fullWidth label="Type" value={val("anaesthesiaType")}
              onChange={(e) => setF({ ...f, anaesthesiaType: e.target.value })}>
              <MenuItem value=""><em>Not recorded</em></MenuItem>
              {ANAESTHESIA.map((a) => <MenuItem key={a} value={a}>{a.charAt(0) + a.slice(1).toLowerCase()}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select fullWidth label="ASA grade" value={val("asaGrade")}
              onChange={(e) => setF({ ...f, asaGrade: e.target.value })}
              helperText="Physical status, I to VI">
              <MenuItem value=""><em>Not recorded</em></MenuItem>
              {ASA.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={12}>
            <TextField fullWidth label="Airway" value={val("airway")} onChange={(e) => setF({ ...f, airway: e.target.value })} />
          </Grid>
          <Grid size={12}>
            <TextField fullWidth multiline minRows={3} label="Anaesthesia notes" value={val("anaesthesiaNotes")}
              onChange={(e) => setF({ ...f, anaesthesiaNotes: e.target.value })} />
          </Grid>
        </Grid>
        <Button variant="contained" size="large" sx={{ mt: 2, textTransform: "none", fontWeight: 700 }}
          disabled={save.isPending} onClick={() => save.mutate(f)}>
          Save this section
        </Button>
      </Section>
    </>
  );
}

// ── Procedure ────────────────────────────────────────────────────────────────

function ProcedureTab({ id, record, onSaved }: { id: string; record: Record<string, string | number | null> | null; onSaved: () => void }) {
  const save = useSectionSave(id, onSaved, "Procedure saved");
  const [f, setF] = useState<Record<string, string>>({});
  const val = (k: string) => f[k] ?? (record?.[k] != null ? String(record[k]) : "");
  const field = (k: string, label: string, opts: { rows?: number; half?: boolean; helper?: string } = {}) => (
    <Grid size={{ xs: 12, sm: opts.half ? 6 : 12 }} key={k}>
      <TextField fullWidth label={label} value={val(k)} helperText={opts.helper}
        multiline={!!opts.rows} minRows={opts.rows}
        onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </Grid>
  );

  return (
    <Section title="What was done">
      <Grid container spacing={2}>
        {field("preOpDiagnosis", "Pre-operative diagnosis", { half: true })}
        {field("postOpDiagnosis", "Post-operative diagnosis", { half: true, helper: "Kept separate — the difference is the point" })}
        {field("procedurePerformed", "Procedure actually performed")}
        {field("incision", "Incision", { half: true })}
        {field("bloodLossMl", "Estimated blood loss (ml)", { half: true })}
        {field("findings", "Findings", { rows: 3 })}
        {field("procedureDetail", "Procedure detail", { rows: 5 })}
        {field("specimensSent", "Specimens sent", { half: true, helper: "To histopathology" })}
        {field("bloodProducts", "Blood products given", { half: true })}
        {field("drains", "Drains", { half: true })}
        {field("complications", "Complications", { half: true })}
        {field("postOpInstructions", "Post-operative instructions", { rows: 3 })}
      </Grid>
      <Button variant="contained" size="large" sx={{ mt: 2, textTransform: "none", fontWeight: 700 }}
        disabled={save.isPending}
        onClick={() => save.mutate({ ...f, ...(f.bloodLossMl !== undefined ? { bloodLossMl: f.bloodLossMl === "" ? null : Number(f.bloodLossMl) } : {}) })}>
        Save this section
      </Button>
    </Section>
  );
}

// ── Implants ─────────────────────────────────────────────────────────────────

function ImplantsTab({ id, implants, onSaved }: { id: string; implants: Record<string, string | number | null>[]; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ implantName: "", manufacturer: "", batchNumber: "", serialNumber: "", quantity: "1", price: "" });

  const add = useMutation({
    mutationFn: async () => axiosInstance.post(`/ipd/ot/cases/${id}/implants`, {
      implantName: f.implantName.trim(),
      manufacturer: f.manufacturer.trim() || undefined,
      batchNumber: f.batchNumber.trim() || undefined,
      serialNumber: f.serialNumber.trim() || undefined,
      quantity: Number(f.quantity) || 1,
      price: f.price ? Number(f.price) : undefined,
    }),
    onSuccess: () => {
      toast.success("Implant recorded");
      setF({ implantName: "", manufacturer: "", batchNumber: "", serialNumber: "", quantity: "1", price: "" });
      onSaved();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not record it")),
  });
  const remove = useMutation({
    mutationFn: async (implantId: string) => axiosInstance.delete(`/ipd/ot/cases/${id}/implants/${implantId}`),
    onSuccess: () => { toast.success("Removed"); onSaved(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not remove it")),
  });

  return (
    <>
      <Section title="Implants used">
        {implants.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>None recorded.</Typography>
        ) : (
          <Stack spacing={1}>
            {implants.map((im) => {
              const traceable = !!(im.batchNumber || im.serialNumber);
              return (
                <Box key={String(im.surgeryImplantId)} sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5, borderRadius: 2, border: "1px solid", borderColor: traceable ? "divider" : SEMANTIC.warning }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {String(im.implantName)} {Number(im.quantity) > 1 ? `× ${im.quantity}` : ""}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                      {[im.manufacturer, im.batchNumber && `Batch ${im.batchNumber}`, im.serialNumber && `Serial ${im.serialNumber}`]
                        .filter(Boolean).join(" · ") || "No identifying detail"}
                    </Typography>
                    {!traceable && (
                      <Typography variant="caption" sx={{ color: SEMANTIC.warning, fontWeight: 700 }}>
                        No batch or serial — this one cannot be found in a recall
                      </Typography>
                    )}
                  </Box>
                  <IconButton size="small" onClick={() => remove.mutate(String(im.surgeryImplantId))} aria-label="Remove implant">
                    <DeleteOutlineRounded fontSize="small" />
                  </IconButton>
                </Box>
              );
            })}
          </Stack>
        )}
      </Section>

      <Section title="Record an implant">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth required label="Implant" value={f.implantName} onChange={(e) => setF({ ...f, implantName: e.target.value })} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Manufacturer" value={f.manufacturer} onChange={(e) => setF({ ...f, manufacturer: e.target.value })} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Batch number" value={f.batchNumber} onChange={(e) => setF({ ...f, batchNumber: e.target.value })}
              helperText="This is what a recall is searched by" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Serial number" value={f.serialNumber} onChange={(e) => setF({ ...f, serialNumber: e.target.value })} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth type="number" label="Quantity" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth label="Price" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Grid>
        </Grid>
        <Button variant="contained" size="large" startIcon={<AddRounded />} sx={{ mt: 2, textTransform: "none", fontWeight: 700 }}
          disabled={!f.implantName.trim() || add.isPending} onClick={() => add.mutate()}>
          Record it
        </Button>
      </Section>
    </>
  );
}

// ── Consent ──────────────────────────────────────────────────────────────────

function ConsentTab({ id, consents, onSaved }: { id: string; consents: Record<string, string | boolean>[]; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ consentType: "SURGICAL", givenBy: "PATIENT", giverName: "", relationship: "", witnessName: "" });
  const [withdrawing, setWithdrawing] = useState<Record<string, string | boolean> | null>(null);

  const add = useMutation({
    mutationFn: async () => axiosInstance.post(`/ipd/ot/cases/${id}/consents`, {
      consentType: f.consentType, givenBy: f.givenBy,
      giverName: f.giverName.trim() || undefined,
      relationship: f.relationship.trim() || undefined,
      witnessName: f.witnessName.trim() || undefined,
    }),
    onSuccess: () => { toast.success("Consent recorded"); setF({ ...f, giverName: "", relationship: "", witnessName: "" }); onSaved(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not record consent")),
  });

  const needsGiver = f.givenBy !== "PATIENT";

  return (
    <>
      <Section title="Consent on file">
        {consents.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", py: 2 }}>Nothing recorded yet.</Typography>
        ) : (
          <Stack spacing={1}>
            {consents.map((c) => (
              <Box key={String(c.surgeryConsentId)} sx={{
                display: "flex", alignItems: "center", gap: 1, p: 1.5, borderRadius: 2, border: "1px solid",
                borderColor: c.isActive ? "divider" : SEMANTIC.danger,
                opacity: c.isActive ? 1 : 0.75,
              }}>
                {c.isActive ? <CheckCircleRounded sx={{ color: SEMANTIC.success }} /> : <RadioButtonUncheckedRounded sx={{ color: SEMANTIC.danger }} />}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {CONSENT_TYPES.find((t) => t.value === c.consentType)?.label ?? String(c.consentType)}
                    {!c.isActive && " — withdrawn"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    {c.givenBy === "PATIENT" ? "Given by the patient" : `Given by ${c.giverName} (${c.relationship})`}
                    {c.witnessName ? ` · witnessed by ${c.witnessName}` : ""}
                    {c.signedAt ? ` · ${new Date(String(c.signedAt)).toLocaleString()}` : ""}
                  </Typography>
                  {!c.isActive && (
                    <Typography variant="caption" sx={{ color: SEMANTIC.danger, display: "block" }}>
                      {String(c.withdrawnReason ?? "")}
                    </Typography>
                  )}
                </Box>
                {c.isActive && (
                  <Button size="small" color="error" sx={{ textTransform: "none" }} onClick={() => setWithdrawing(c)}>
                    Withdraw
                  </Button>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </Section>

      <Section title="Record consent">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select fullWidth label="For what" value={f.consentType} onChange={(e) => setF({ ...f, consentType: e.target.value })}>
              {CONSENT_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select fullWidth label="Given by" value={f.givenBy} onChange={(e) => setF({ ...f, givenBy: e.target.value })}>
              {GIVERS.map((g) => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
            </TextField>
          </Grid>
          {needsGiver && (
            <>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth required label="Their name" value={f.giverName} onChange={(e) => setF({ ...f, giverName: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth required label="Relationship to the patient" value={f.relationship}
                  onChange={(e) => setF({ ...f, relationship: e.target.value })} helperText="Son, wife, guardian…" />
              </Grid>
            </>
          )}
          <Grid size={12}>
            <TextField fullWidth label="Witnessed by" value={f.witnessName} onChange={(e) => setF({ ...f, witnessName: e.target.value })} />
          </Grid>
        </Grid>
        <Button variant="contained" size="large" sx={{ mt: 2, textTransform: "none", fontWeight: 700 }}
          disabled={add.isPending || (needsGiver && (!f.giverName.trim() || !f.relationship.trim()))}
          onClick={() => add.mutate()}>
          Record consent
        </Button>
      </Section>

      {withdrawing && (
        <WithdrawDialog id={id} consent={withdrawing} onClose={() => setWithdrawing(null)}
          onDone={() => { setWithdrawing(null); onSaved(); }} />
      )}
    </>
  );
}

function WithdrawDialog({ id, consent, onClose, onDone }: {
  id: string; consent: Record<string, string | boolean>; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const go = useMutation({
    mutationFn: async () => axiosInstance.post(`/ipd/ot/cases/${id}/consents/${consent.surgeryConsentId}/withdraw`, { reason: reason.trim() }),
    onSuccess: () => { toast.success("Consent withdrawn"); onDone(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not withdraw it")),
  });

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Withdraw consent</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          The consent stays on the record, marked withdrawn. Removing it would make the case look as though consent was never taken.
        </Typography>
        <TextField autoFocus fullWidth required multiline minRows={2} label="Why" value={reason} onChange={(e) => setReason(e.target.value)} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" color="error" sx={{ textTransform: "none" }}
          disabled={!reason.trim() || go.isPending} onClick={() => go.mutate()}>
          Withdraw
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Placing a patient after recovery, from the case itself.
 *
 * The same move the bed board offers — this is the second door, and it exists
 * because the person driving the case should not have to leave it to finish
 * the journey. Both go through return-from-theatre, so they cannot diverge.
 */
function PlaceFromRecoveryDialog({ admissionId, heldBed, onClose, onDone }: {
  admissionId: string; heldBed: string | null; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [toBedId, setToBedId] = useState("");

  const { data: freeBeds, isLoading } = useQuery({
    queryKey: ["free-beds-pick"],
    queryFn: async () => (await axiosInstance.get("/ipd/beds/available")).data.data,
  });

  const go = useMutation({
    mutationFn: async () =>
      axiosInstance.post(`/ipd/admissions/${admissionId}/return-from-theatre`, {
        toBedId: toBedId || undefined,
        reason: "Placed from recovery",
      }),
    onSuccess: () => { toast.success("Patient placed"); onDone(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not place them")),
  });

  const beds = (freeBeds ?? []) as { bedId: string; bedNumber: string; label?: string }[];

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Place in a bed</DialogTitle>
      <DialogContent>
        {heldBed ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Bed {heldBed} is being held for them. Leave the choice blank to put them back in it.
          </Alert>
        ) : (
          <Alert severity="warning" sx={{ mb: 2 }}>
            They have no bed — their old one was released on the way in. Choose one.
          </Alert>
        )}
        <TextField select fullWidth label="Bed" value={toBedId} onChange={(e) => setToBedId(e.target.value)}
          required={!heldBed}
          helperText={isLoading ? "Loading…" : beds.length ? "Beds free right now" : "No bed is free"}>
          {heldBed && <MenuItem value=""><em>Back to bed {heldBed}</em></MenuItem>}
          {beds.map((b) => <MenuItem key={b.bedId} value={b.bedId}>{b.label || b.bedNumber}</MenuItem>)}
        </TextField>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" sx={{ textTransform: "none" }}
          disabled={go.isPending || (!heldBed && !toBedId)} onClick={() => go.mutate()}>
          {go.isPending ? "Placing…" : "Place them"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
