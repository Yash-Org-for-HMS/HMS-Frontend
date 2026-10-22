import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useIsNursePanel, usePanelBase } from "./panelBase";
import CaseJourney from "./CaseJourney";
import { SEMANTIC, NEUTRAL, BRAND, alpha } from "@/styles/accents";
import { getApiErrorMessage, apiErrorText } from "@/utils/apiError";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Typography, Paper, Grid, Chip, Tabs, Tab, Button, Stack, MenuItem,
  TextField, Checkbox, FormControlLabel, IconButton, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, Divider, Collapse, Autocomplete,
} from "@mui/material";
import PatientHistoryButton from "@/components/clinical/PatientHistoryButton";
import {
  ArrowBackRounded, CheckCircleRounded, RadioButtonUncheckedRounded, DeleteOutlineRounded,
  AddRounded, WarningAmberRounded, ScheduleRounded, PersonRounded, DescriptionRounded, PrintRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import ErrorState from "@/components/ErrorState";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { useToast } from "@/providers/ToastContext";
import PageHeader from "@/components/layout/PageHeader";
import SearchableSelect from "@/components/form/SearchableSelect";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import SocChargePicker from "@/components/billing/SocChargePicker";

/**
 * One case, during the case.
 *
 * The plan's own risk section says it plainly: an operative record filled in
 * the next morning from memory is worse than a paper one. So this screen is
 * built for a wall-mounted display and gloved hands - big targets, five short
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

/**
 * An ISO instant as a <input type="datetime-local"> value, in LOCAL time.
 *
 * datetime-local rather than a bare time input because a night list crosses
 * midnight, and a time alone would need the date inferred - which is guesswork
 * at exactly the moment the record has to be exact.
 */
const toLocalInput = (iso?: string | null): string => {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** "1h 12m", or "42m". Blank when either end is missing. */
const gap = (from?: string | null, to?: string | null): string | null => {
  if (!from || !to) return null;
  const mins = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000);
  if (!isFinite(mins) || mins < 0) return null;
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
};

/**
 * The intervals the six times exist to produce.
 *
 * They were captured and never shown back, so the one question the six stamps
 * are for - how long did this take - could only be answered by subtracting two
 * clock faces in your head, and a mis-stamp stayed invisible until it reached a
 * utilisation report weeks later.
 */
const SPANS: { label: string; from: string; to: string }[] = [
  { label: "Anaesthesia", from: "anaesthesiaStart", to: "anaesthesiaEnd" },
  { label: "Operating", from: "incisionAt", to: "closureAt" },
  { label: "In theatre", from: "wheeledInAt", to: "wheeledOutAt" },
];

/** Stamping these two moves the patient as well as recording a time. */
const MOVES_PATIENT = new Set(["wheeledInAt", "wheeledOutAt"]);

export default function OtCaseRecord() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const isNurse = useIsNursePanel();
  const basePath = usePanelBase();
  /**
   * null until someone picks a phase, so the screen can open on the one the
   * case is actually in.
   *
   * Held as "not chosen yet" rather than defaulting to 0, because a case
   * halfway through should not open on paperwork that was done an hour ago -
   * and once a person has chosen a phase, the screen must stay where they put
   * it even as the case moves on underneath them.
   */
  const [chosenTab, setChosenTab] = useState<number | null>(null);
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
   * Both wheel events go through the record endpoint - the same path the times
   * have always used - so there is exactly one way a patient moves, whichever
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
          ? a === "WHEEL_IN" ? "In theatre - the ward board now shows them away" : "Out to recovery - their bed is still held"
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

  /* ── Where the case is up to, and what it still needs ───────────────────── */

  const rec = (recordQ.data?.record ?? {}) as Record<string, unknown>;
  const cl = (checklistQ.data?.checklist ?? {}) as Record<string, unknown>;
  const team = (recordQ.data?.team ?? []) as Record<string, string>[];
  const consents = (consentsQ.data ?? []) as Record<string, unknown>[];

  const done = {
    consent: consents.some((c) => c.isActive && c.consentType === "SURGICAL"),
    team: team.some((t) => t.teamRole === "PRIMARY_SURGEON"),
    signIn: !!cl.signInAt,
    timeOut: !!cl.timeOutAt,
    signOut: !!cl.signOutAt,
    wheeledIn: !!rec.wheeledInAt,
    incision: !!rec.incisionAt,
    closure: !!rec.closureAt,
    wheeledOut: !!rec.wheeledOutAt,
    anaesthesia: !!rec.anaesthesiaType,
    procedure: !!rec.procedurePerformed,
    countsOk: counts.correct !== false,
  };

  /**
   * The case in the order it actually runs.
   *
   * The tabs were already in this order, but nothing said where you were in it,
   * so finding the next step meant opening each one and reading it. This is the
   * WHO checklist's own sequence: consent and team before the patient is
   * anaesthetised, Sign In before anaesthesia, Time Out before the knife, Sign
   * Out before they leave.
   */
  const STEPS: { key: string; text: string; phase: number; done: boolean }[] = [
    { key: "consent", text: "Record the surgical consent", phase: STEP_PHASE.consent, done: done.consent },
    { key: "team", text: "Name the primary surgeon", phase: STEP_PHASE.team, done: done.team },
    { key: "signIn", text: "Run Sign In - before anaesthesia", phase: STEP_PHASE.signIn, done: done.signIn },
    { key: "wheeledIn", text: "Stamp Wheeled in when the patient enters theatre", phase: STEP_PHASE.wheeledIn, done: done.wheeledIn },
    { key: "timeOut", text: "Run Time Out - before the incision", phase: STEP_PHASE.timeOut, done: done.timeOut },
    { key: "incision", text: "Stamp Incision", phase: STEP_PHASE.incision, done: done.incision },
    { key: "closure", text: "Stamp Closure", phase: STEP_PHASE.closure, done: done.closure },
    { key: "procedure", text: "Write what was actually done", phase: STEP_PHASE.procedure, done: done.procedure },
    { key: "signOut", text: "Run Sign Out - before the patient leaves", phase: STEP_PHASE.signOut, done: done.signOut },
    { key: "wheeledOut", text: "Stamp Wheeled out", phase: STEP_PHASE.wheeledOut, done: done.wheeledOut },
  ];

  /**
   * How far the case has actually got - the LAST thing done, not the first
   * thing missing.
   *
   * These are different, and conflating them is misleading at exactly the wrong
   * moment. On a live case with Sign In, Wheeled in and Time Out all recorded
   * but no consent on file, "first thing missing" says *record the consent* -
   * true, but the patient is anaesthetised and the next ACTION is the incision.
   */
  const lastDone = STEPS.reduce((acc, s, i) => (s.done ? i : acc), -1);

  /** The next step forward - used to land on the right phase, not to nag. */
  const nextStep = STEPS.slice(lastDone + 1).find((s) => !s.done) ?? null;

  /**
   * Steps the case has moved PAST without recording - skipped, not pending.
   *
   * Surfaced separately and in warning colour, because a consent that was never
   * recorded on a patient already on the table is not a to-do item, it is a
   * hole in the record that someone has to close.
   */
  const missedSteps = STEPS.slice(0, Math.max(0, lastDone)).filter((s) => !s.done);

  // Open on the phase the case is in; respect a manual choice thereafter.
  const tab = chosenTab ?? (nextStep ? STEP_PHASE[nextStep.key] : PHASES.length - 1);
  const setTab = setChosenTab;

  /** A mark per phase: settled, or still wanting something. */
  const phaseState: ("done" | "todo")[] = [
    done.consent && done.team && done.signIn ? "done" : "todo",
    done.wheeledIn && done.timeOut && done.incision && done.closure && done.procedure ? "done" : "todo",
    done.countsOk && done.signOut && done.wheeledOut ? "done" : "todo",
  ];

  return (
    <Box>
      <PageHeader
        title={surgery?.procedureName || "Case"}
        subtitle={surgery?.patientName
          ? `${surgery.patientName}${surgery.uhid ? ` · ${surgery.uhid}` : ""} - save each section as you go`
          : "The record for this case - save each section as you go"}
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            {/* What has happened to this patient before, without leaving the
                record that is being written about them now. */}
            <PatientHistoryButton patientId={surgery?.patientId} patientName={surgery?.patientName} uhid={surgery?.uhid}
              profilePath={surgery?.patientId ? `${basePath}/patients/${surgery.patientId}` : undefined} />
            <Button startIcon={<ArrowBackRounded />} sx={{ textTransform: "none" }} onClick={() => navigate(-1)}>
              Back to the list
            </Button>
          </Stack>
        }
      />

      {/* A count that does not match is the one thing this screen shouts about,
          on every tab, until it is resolved. */}
      {counts.correct === false && (
        <Alert severity="error" icon={<WarningAmberRounded />} sx={{ mb: 2.5, fontWeight: 600 }}>
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

      {/* Passed over, not pending - the case has moved on without them. Kept
          because a consent never recorded on an anaesthetised patient is a hole
          in the record, not a to-do. Each one goes to the phase that fixes it. */}
      {missedSteps.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2.5, borderRadius: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
            The case has moved past {missedSteps.length === 1 ? "one step" : `${missedSteps.length} steps`} that
            {missedSteps.length === 1 ? " was" : " were"} never recorded
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
            {missedSteps.map((st) => (
              <Button
                key={st.key} size="small" variant="outlined" color="warning"
                onClick={() => setTab(st.phase)}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                {st.text}
              </Button>
            ))}
          </Box>
        </Alert>
      )}

      {/*
        Three phases, not seven topics.
        A case is a timeline; the old tabs sliced it by subject, so "what do I do
        now" had to be translated into "which subject holds that" every time. The
        same forms are all still here - Sign In sits with consent and the team
        because they happen before anaesthesia, and the counts sit with Sign Out
        because that is when they are done.
      */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth"
          sx={{ px: 1, "& .MuiTab-root": { textTransform: "none", fontWeight: 700, minHeight: 60 } }}>
          {PHASES.map((ph, i) => (
            <Tab key={ph.key} label={<TabMark text={`${i + 1}. ${ph.label}`} state={phaseState[i]} />} />
          ))}
          {/* What a case costs is a billing decision, on its own tab. The scrub
              nurse runs the checklist and counts the swabs; she does not set the
              surgeon's fee, and the API refuses it for her too. */}
          {!isNurse && <Tab label="Bill" />}
        </Tabs>
      </Paper>

      {tab === 0 && (
        <>
          <ConsentTab id={id} consents={consentsQ.data ?? []} onSaved={refreshAll}
            formsPath={surgery?.patientId ? `${basePath}/patients/${surgery.patientId}` : undefined} />
          <TeamTab id={id} team={recordQ.data?.team ?? []} onSaved={refreshAll} />
          <ChecklistTab id={id} data={checklistQ.data} onSaved={refreshAll} stages={["SIGN_IN"]} showCounts={false} />
        </>
      )}

      {tab === 1 && (
        <>
          <AnaesthesiaTab id={id} record={recordQ.data?.record} onSaved={refreshAll} show="times" />
          <ChecklistTab id={id} data={checklistQ.data} onSaved={refreshAll} stages={["TIME_OUT"]} showCounts={false} />
          <AnaesthesiaTab id={id} record={recordQ.data?.record} onSaved={refreshAll} show="form" />
          <ProcedureTab id={id} record={recordQ.data?.record} onSaved={refreshAll} />
          <ImplantsTab id={id} implants={recordQ.data?.implants ?? []} onSaved={refreshAll} />
          <ConsumablesTab id={id} consumables={recordQ.data?.consumables ?? []} onSaved={refreshAll} />
        </>
      )}

      {tab === 2 && (
        <>
          {/* Counts first: a short swab blocks the sign-out immediately below. */}
          <ChecklistTab id={id} data={checklistQ.data} onSaved={refreshAll} stages={["SIGN_OUT"]} />
        </>
      )}

      {tab === 3 && !isNurse && <BillingTab id={id} onGoTo={setTab} />}

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

/** A line the case should carry, priced, from /charges/proposed. */
type Proposal = {
  key: string; chargeType: string; label: string; description: string; who: string | null;
  quantity: number; unitPrice: number | null; taxPercent: number;
  priceFrom: "STANDARD" | "TYPED" | "IMPLANT" | "NONE"; hourlyRate?: number; hours?: number; fromNurse?: boolean;
};
/** A line the case cannot have yet, and the part of the record that fixes it. */
type MissingLine = { chargeType: string; label: string; reason: string; fix: "team" | "times" | "anaesthesia"; optional: boolean };

/** Which tab of the record fixes a missing line. */
const FIX_TAB: Record<MissingLine["fix"], number> = { team: 0, times: 1, anaesthesia: 1 };
const FIX_TEXT: Record<MissingLine["fix"], string> = { team: "Open the team", times: "Record the times", anaesthesia: "Record the anaesthesia" };

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * The case's bill: what is on it, what it should have and does not yet, and a
 * hand-entry row for the rest.
 *
 * One list instead of rate boxes plus a build button: each line it should have
 * is shown already priced from the Schedule of Charges, ticked, with its price
 * editable for this case. A line it cannot have yet says why and, on the
 * operative record, links to the tab that fixes it. Reception sees the same
 * list on its own page, without the links (it cannot open the record).
 */
export function BillingTab({ id, onGoTo }: { id: string; onGoTo?: (tab: number) => void }) {
  const toast = useToast();
  // The printed OT bill opens under this panel (hospital or reception).
  const panelBase = usePanelBase();
  const [f, setF] = useState({ chargeType: "OTHER", description: "", unitPrice: "", quantity: "1", taxPercent: "0" });
  // A hand line picked from the Schedule of Charges: the server prices it from
  // the item (with its GST) unless the price is changed here.
  const [socOpen, setSocOpen] = useState(false);
  const [socItem, setSocItem] = useState<{ chargeItemId: string; price: number } | null>(null);
  // Lines unticked, and prices typed for this case, by line key.
  const [skip, setSkip] = useState<Record<string, boolean>>({});
  const [typed, setTyped] = useState<Record<string, string>>({});

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ot-case-charges", id],
    queryFn: async () => (await axiosInstance.get(`/ipd/ot/cases/${id}/charges`)).data.data,
  });
  const proposedQ = useQuery({
    queryKey: ["ot-case-proposed", id],
    queryFn: async () => (await axiosInstance.get(`/ipd/ot/cases/${id}/charges/proposed`)).data.data as { lines: Proposal[]; missing: MissingLine[]; billed?: boolean },
  });
  const refreshAll = () => { refetch(); proposedQ.refetch(); };

  const add = useMutation({
    mutationFn: async () => axiosInstance.post(`/ipd/ot/cases/${id}/charges`, {
      chargeType: f.chargeType, description: f.description.trim(),
      quantity: Number(f.quantity) || 1,
      ...(socItem && Number(f.unitPrice) === socItem.price
        ? { chargeItemId: socItem.chargeItemId }
        : { unitPrice: f.unitPrice ? Number(f.unitPrice) : 0, taxPercent: f.taxPercent ? Number(f.taxPercent) : 0 }),
    }),
    onSuccess: () => { toast.success("Line added"); setF({ ...f, description: "", unitPrice: "", taxPercent: "0" }); setSocItem(null); refreshAll(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not add the line")),
  });
  const remove = useMutation({
    mutationFn: async (chargeId: string) => axiosInstance.delete(`/ipd/ot/cases/${id}/charges/${chargeId}`),
    onSuccess: () => { toast.success("Removed"); refreshAll(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not remove the line")),
  });

  const lines = proposedQ.data?.lines ?? [];
  const missing = proposedQ.data?.missing ?? [];
  const priceOf = (l: Proposal) => typed[l.key] ?? (l.unitPrice != null ? String(l.unitPrice) : "");
  const picked = lines.filter((l) => !skip[l.key]);
  const unpriced = picked.filter((l) => priceOf(l).trim() === "" || Number.isNaN(Number(priceOf(l))));

  const apply = useMutation({
    mutationFn: async () => axiosInstance.post(`/ipd/ot/cases/${id}/charges/auto`, {
      pick: picked.map((l) => {
        const price = Number(priceOf(l));
        return l.unitPrice != null && price === l.unitPrice ? { key: l.key } : { key: l.key, unitPrice: price };
      }),
    }),
    onSuccess: (r) => {
      toast.success(r.data?.data?.note ?? "Added");
      setSkip({}); setTyped({});
      refreshAll();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not add the lines")),
  });

  if (isLoading) return <ListSkeleton />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  const charges = (data?.charges ?? []) as Record<string, string | number | null>[];
  const s = data?.summary ?? {};
  const billedCase = !!proposedQ.data?.billed;

  // Where these charges go: there is no separate theatre bill.
  const kase = (data?.case ?? {}) as { billedOn?: string; invoiceNumber?: string | null; invoiceAmount?: string | null; invoiceStatus?: string | null; admissionNumber?: string | null; status?: string };
  const destination = kase.billedOn === "INVOICE"
    ? { severity: "success" as const, text: `Billed on invoice ${kase.invoiceNumber}${kase.admissionNumber ? " - the patient's discharge bill" : ""} (${rupees(Number(kase.invoiceAmount ?? 0))} in all, ${String(kase.invoiceStatus ?? "").toLowerCase()}). Find it in Billing under the patient.` }
    : kase.billedOn === "DISCHARGE"
      ? { severity: "info" as const, text: `These charges go on the patient's discharge bill${kase.admissionNumber ? ` for stay ${kase.admissionNumber}` : ""}, together with the room, medicines and tests. Mark the case finished on the OT list before discharge.` }
      : { severity: "info" as const, text: "A day case: an invoice for these charges is raised when the case is marked finished on the OT list. It then shows in Billing under the patient." };

  return (
    <>
      <Alert severity={destination.severity} sx={{ mb: 2.5 }}
        action={charges.length > 0 ? (
          <Button size="small" startIcon={<PrintRounded />} sx={{ textTransform: "none", fontWeight: 600 }}
            onClick={() => window.open(`${panelBase}/ipd/ot-cases/${id}/bill/print`, "_blank", "noopener")}>
            Print OT bill
          </Button>
        ) : undefined}>
        {destination.text}
      </Alert>
      <Section title="Charges for this case">
        {charges.length === 0 ? (
          <Empty>
            No lines yet.{s.flatPrice
              ? ` Until there are, this case bills on its package price of ${rupees(Number(s.flatPrice))}.`
              : " Add them from the list below."}
          </Empty>
        ) : (
          <Stack spacing={1.25}>
            {charges.map((c) => (
              <RowCard key={String(c.surgeryChargeId)}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{String(c.description)}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    {String(c.label)}
                    {Number(c.quantity) > 1 ? ` · ${c.quantity} × ${rupees(Number(c.unitPrice))}` : ""}
                    {Number(c.taxPercent) > 0 ? ` · ${c.taxPercent}% tax` : ""}
                    {c.invoiceItemId ? " · on the patient's invoice" : ""}
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {rupees(Number(c.totalPrice))}
                </Typography>
                {!c.invoiceItemId && (
                  <IconButton size="small" onClick={() => remove.mutate(String(c.surgeryChargeId))} aria-label="Remove line">
                    <DeleteOutlineRounded fontSize="small" />
                  </IconButton>
                )}
              </RowCard>
            ))}
            <Box sx={{ display: "flex", justifyContent: "space-between", pt: 2, mt: 0.5, borderTop: "1px solid", borderColor: "divider" }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Total {Number(s.tax) > 0 ? `(including ${rupees(Number(s.tax))} tax)` : ""}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 800 }}>{rupees(Number(s.total ?? 0))}</Typography>
            </Box>
            {Number(s.billed) > 0 && (
              <Alert severity="info">
                {s.billed} of {charges.length} lines are already on the patient's invoice and can no longer be removed here.
              </Alert>
            )}
          </Stack>
        )}
      </Section>

      {billedCase ? (
        <Alert severity="info" sx={{ mb: 2.5 }}>
          This case is already on the patient's invoice. Anything more is charged on the patient's bill in Billing.
        </Alert>
      ) : (
        <>
          <Section
            title="Ready to add"
            description="Priced from the Schedule of Charges. Change a price for this case, or untick a line to leave it off."
            footer={lines.length > 0 ? (
              <Button variant="contained" size="large" sx={{ textTransform: "none", fontWeight: 700 }}
                disabled={apply.isPending || picked.length === 0 || unpriced.length > 0} onClick={() => apply.mutate()}>
                {apply.isPending ? "Adding…" : `Add ${picked.length} line${picked.length === 1 ? "" : "s"} to the charges`}
              </Button>
            ) : undefined}
          >
            {proposedQ.isLoading ? <ListSkeleton /> : (
              <Stack spacing={1.25}>
                {lines.length === 0 && (
                  <Empty>Nothing more to add - every line this case can have is on the bill.</Empty>
                )}
                {lines.map((l) => {
                  const on = !skip[l.key];
                  const price = priceOf(l);
                  const changed = l.unitPrice != null && price !== "" && Number(price) !== l.unitPrice;
                  const note = l.priceFrom === "NONE"
                    ? (l.fromNurse ? "Recorded as used in theatre - enter a price" : "No standard rate - enter a price")
                    : changed ? `Changed for this case (standard ${rupees(l.unitPrice!)})`
                    : l.priceFrom === "IMPLANT" ? "Price recorded with the implant"
                    : l.fromNurse ? "Recorded as used in theatre - standard rate"
                    : l.hours != null && l.hourlyRate != null ? `${l.hours} hours × ${rupees(l.hourlyRate)} - standard rate`
                    : "Standard rate";
                  return (
                    <RowCard key={l.key}>
                      <Checkbox checked={on} onChange={(e) => setSkip({ ...skip, [l.key]: !e.target.checked })}
                        inputProps={{ "aria-label": `Add ${l.description}` }} />
                      <Box sx={{ flex: 1, minWidth: 0, opacity: on ? 1 : 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{l.description}</Typography>
                        <Typography variant="caption" sx={{ color: l.priceFrom === "NONE" && on && price === "" ? "warning.main" : "text.secondary", display: "block" }}>
                          {l.label} · {note}
                          {l.quantity > 1 ? ` · ${l.quantity} × the price` : ""}
                          {l.taxPercent > 0 ? ` · ${l.taxPercent}% tax` : ""}
                        </Typography>
                      </Box>
                      <TextField size="small" label={l.quantity > 1 ? "Each (₹)" : "Price (₹)"} value={price} disabled={!on}
                        onChange={(e) => setTyped({ ...typed, [l.key]: e.target.value })}
                        error={on && (price.trim() === "" || Number.isNaN(Number(price)))}
                        sx={{ width: 130 }} inputProps={{ inputMode: "decimal" }} />
                    </RowCard>
                  );
                })}

                {missing.length > 0 && (
                  <Box sx={{ pt: lines.length ? 1 : 0 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, display: "block", mb: 1 }}>
                      Not ready yet
                    </Typography>
                    <Stack spacing={1}>
                      {missing.map((m) => (
                        <Box key={m.chargeType} sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                          <Typography variant="body2" sx={{ flex: 1, minWidth: 200 }}>
                            <b>{m.label}</b>: {m.reason}{m.optional ? " (only if one was there)" : ""}
                          </Typography>
                          {onGoTo ? (
                            <Button size="small" variant="outlined" sx={{ textTransform: "none" }} onClick={() => onGoTo(FIX_TAB[m.fix])}>
                              {FIX_TEXT[m.fix]}
                            </Button>
                          ) : (
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>The theatre team records this</Typography>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            )}
          </Section>

          <Section
            title="Add a line by hand"
            description="For anything not listed above: the procedure itself, consumables, theatre drugs, a technician's fee."
            footer={
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" size="large" sx={{ textTransform: "none", fontWeight: 700 }} onClick={() => setSocOpen(true)}>
                  From Schedule of Charges
                </Button>
                <Button variant="contained" size="large" startIcon={<AddRounded />} sx={{ textTransform: "none", fontWeight: 700 }}
                  disabled={!f.description.trim() || add.isPending} onClick={() => add.mutate()}>
                  Add the line
                </Button>
              </Stack>
            }
          >
            <Grid container spacing={2.5}>
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
                  helperText={socItem && Number(f.unitPrice) === socItem.price ? "From the Schedule of Charges item" : "Charged on top"} />
              </Grid>
            </Grid>
            <SocChargePicker
              open={socOpen}
              onClose={() => setSocOpen(false)}
              preferCategories={["procedure", "surgery", "operation", "theatre", "consumable"]}
              onPick={(c) => {
                setF((prev) => ({ ...prev, description: c.itemName, unitPrice: String(c.price), taxPercent: String(c.taxPercent) }));
                setSocItem({ chargeItemId: c.chargeItemId, price: c.price });
                setSocOpen(false);
              }}
            />
          </Section>
        </>
      )}
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

/**
 * The three moments a case passes through.
 *
 * Deliberately not the seven subjects the record is made of. The subjects are
 * still all here - they are grouped by WHEN they are used rather than by what
 * they are about, which is the order the person filling this in is working in.
 */
const PHASES = [
  { key: "before", label: "Before" },
  { key: "theatre", label: "In theatre" },
  { key: "after", label: "Sign out" },
] as const;

/** Which phase each step of the case belongs to. */
const STEP_PHASE: Record<string, number> = {
  consent: 0, team: 0, signIn: 0,
  wheeledIn: 1, timeOut: 1, incision: 1, closure: 1, procedure: 1,
  signOut: 2, wheeledOut: 2,
};

/** The one gutter every card uses, so the left edges line up down the page. */
const GUTTER = { xs: 2, md: 3 };

/**
 * A tab label carrying whether that section is settled.
 *
 * A tick, not a colour alone - a dot on its own says "something", and which
 * something is exactly what a person mid-case has no attention to spare for.
 * Tabs with no required state (Implants, Billing) get no mark at all rather
 * than a permanent "incomplete".
 */
function TabMark({ text, state }: { text: string; state: "done" | "todo" | null }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
      {text}
      {state === "done" && <CheckCircleRounded sx={{ fontSize: 15, color: SEMANTIC.success }} />}
      {state === "todo" && (
        <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: SEMANTIC.warning, flexShrink: 0 }} />
      )}
    </Box>
  );
}

/**
 * One card, with a header / body / footer that are actually distinct.
 *
 * Every section used to be a flat block: a bold line, then content, then a
 * large contained button floating at the bottom-LEFT of a body whose height
 * varies from four rows to twelve. So the primary action landed somewhere
 * different on every tab, and with no rule under the heading the title read as
 * just another line of text.
 *
 * Header and footer are now separated by rules and the footer is right-aligned
 * on a tinted ground, which puts "save" in the same place on every card - and
 * lets the intro sentences move out of the body into `description`, where they
 * belong, instead of being the first child with an ad-hoc margin.
 */
const Section = ({ title, description, children, action, footer }: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
}) => (
  <Paper
    elevation={0}
    sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", mb: 2.5, overflow: "hidden" }}
  >
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, px: GUTTER, py: 2 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.35 }}>{title}</Typography>
        {description && (
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>{description}</Typography>
        )}
      </Box>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Box>
    <Divider />
    <Box sx={{ px: GUTTER, py: 2.5 }}>{children}</Box>
    {footer && (
      <>
        <Divider />
        <Box
          sx={{
            px: GUTTER, py: 2,
            display: "flex", alignItems: "center", justifyContent: "flex-end",
            gap: 2, flexWrap: "wrap",
            bgcolor: alpha(NEUTRAL.muted, 0.04),
          }}
        >
          {footer}
        </Box>
      </>
    )}
  </Paper>
);

/**
 * What an empty list says. Three sections each phrased and spaced it their own
 * way ("None recorded.", "Nothing recorded yet.", "Nobody recorded yet.") with
 * a bare paragraph and a stray vertical padding.
 */
const Empty = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center", py: 3 }}>
    {children}
  </Typography>
);

/**
 * A row in one of the three lists (team, implants, consent), which had the same
 * box repeated three times with slightly different padding each time.
 */
const RowCard = ({ tone, children }: { tone?: string; children: React.ReactNode }) => (
  <Box
    sx={{
      display: "flex", alignItems: "center", gap: 1.5,
      px: 2, py: 1.5, borderRadius: 2,
      border: "1px solid", borderColor: tone ?? "divider",
      ...(tone ? { bgcolor: alpha(tone, 0.04) } : null),
    }}
  >
    {children}
  </Box>
);

// ── Safety checklist ─────────────────────────────────────────────────────────

function ChecklistTab({ id, data, onSaved, stages, showCounts = true }: {
  id: string;
  data: Record<string, never> | undefined;
  onSaved: () => void;
  /** Which WHO stages to show. Omitted = all three, as before. */
  stages?: string[];
  showCounts?: boolean;
}) {
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
        <Typography
          variant="caption"
          sx={{
            display: "block", mb: 1,
            fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
            color: mismatched ? SEMANTIC.danger : "text.secondary",
          }}
        >
          {label}
        </Typography>
        {/* fullWidth on both so the pair splits its third evenly instead of
            each taking MUI's default width and overflowing the column. */}
        <Stack direction="row" spacing={1}>
          <TextField fullWidth size="small" label="In" type="number" value={inVal}
            onChange={(e) => setCountForm({ ...countForm, [inKey]: e.target.value })} />
          <TextField fullWidth size="small" label="Out" type="number" value={outVal}
            error={mismatched}
            onChange={(e) => setCountForm({ ...countForm, [outKey]: e.target.value })} />
        </Stack>
      </Grid>
    );
  };

  return (
    <>
      {stageMeta.filter((m) => !stages || stages.includes(m.stage)).map((m) => {
        const signedAt = cl?.[m.atKey] as string | undefined;
        const stageItems = items?.[m.stage] ?? [];
        // Start from what was actually signed, not from an empty form. A
        // signed stage that renders every box unticked is not just wrong to
        // look at - pressing "Re-sign" would record the whole stage as NOT
        // done and quietly erase the record.
        const saved = (cl?.[m.itemsKey] as unknown as Record<string, boolean> | null) ?? {};
        const current = ticks[m.stage] ?? saved;
        const allTicked = stageItems.length > 0 && stageItems.every((k) => current[k]);
        return (
          <Section
            key={m.stage}
            title={m.title}
            description={m.when}
            action={signedAt
              ? <Chip size="small" icon={<CheckCircleRounded />} label={`Signed ${clock(signedAt)}`}
                  sx={{ bgcolor: `${SEMANTIC.success}1a`, color: SEMANTIC.success, fontWeight: 700 }} />
              : <Chip size="small" label="Not signed" sx={{ bgcolor: `${NEUTRAL.muted}1a`, color: NEUTRAL.muted, fontWeight: 700 }} />}
            footer={
              <>
                {!allTicked && stageItems.length > 0 && (
                  <Typography variant="caption" sx={{ color: "text.secondary", flex: 1, minWidth: 200 }}>
                    Signing records exactly what is ticked - unticked items are recorded as not done.
                  </Typography>
                )}
                <Button
                  variant="contained" size="large" sx={{ textTransform: "none", fontWeight: 700 }}
                  disabled={sign.isPending}
                  onClick={() => sign.mutate({
                    stage: m.stage,
                    items: current,
                    extra: m.stage === "SIGN_IN" ? { siteMarked: !!current.SITE_MARKED, laterality: laterality || undefined } : undefined,
                  })}
                >
                  {/* The stage titles are already verbs - "Sign In", "Time Out",
                      "Sign Out" - so prefixing "Sign" produced "Sign Sign In". */}
                  {signedAt ? `Re-confirm ${m.title}` : `Confirm ${m.title}`}
                </Button>
              </>
            }
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
          </Section>
        );
      })}

      {showCounts && (
      <Section
        title="Counts"
        description="Counted in at the start and out at the end. A count that does not match blocks sign-out."
        footer={
          <Button variant="contained" size="large" sx={{ textTransform: "none", fontWeight: 700 }}
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
        }
      >
        <Grid container spacing={2.5}>
          {countRow("Swabs", "swabCountInitial", "swabCountFinal")}
          {countRow("Instruments", "instrumentCountInitial", "instrumentCountFinal")}
          {countRow("Needles", "needleCountInitial", "needleCountFinal")}
        </Grid>
        {counts.correct === false && (
          <Alert severity="error" sx={{ mt: 2.5 }}>
            {counts.mismatches.join(" and ")} short. Recount, and record what was found.
          </Alert>
        )}
        {counts.correct === true && (
          <Alert severity="success" sx={{ mt: 2.5 }}>All counts match.</Alert>
        )}
        <TextField fullWidth multiline minRows={2} sx={{ mt: 2.5 }} label="Note (what happened, what was found)"
          defaultValue={cl?.countDiscrepancyNote ?? ""}
          onChange={(e) => setCountForm({ ...countForm, countDiscrepancyNote: e.target.value })} />
      </Section>
      )}
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
        <Empty>Nobody recorded yet.</Empty>
      ) : (
        <Stack spacing={1.25}>
          {team.map((t) => (
            <RowCard key={t.surgeryTeamMemberId}>
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
            </RowCard>
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
    // The same doctor list the booking screens hold for two minutes; it was
    // re-downloaded (5+ server queries) on every dialog open.
    staleTime: 2 * 60_000,
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
            helperText="A visiting surgeon or agency nurse has no login - name them instead">
            <MenuItem value="doctor">A doctor here</MenuItem>
            <MenuItem value="staff">A staff member here</MenuItem>
            <MenuItem value="external">Someone visiting</MenuItem>
          </TextField>
          {who === "doctor" && (
            <SearchableSelect
              label="Doctor" name="doctorId"
              value={doctorId} onChange={(e) => setDoctorId(e.target.value)}
              placeholder={loadingDoctors ? "Loading…" : "Pick a doctor"}
              searchPlaceholder="Search doctors…"
              options={doctors.map((d) => ({
                value: d.doctorId,
                label: `Dr. ${d.user?.firstName || "Unknown"} ${d.user?.lastName || ""}`.trim(),
              }))}
              helperText={loadingDoctors ? "Loading…" : doctors.length ? undefined : "No doctors found"}
            />
          )}
          {who === "staff" && (
            <SearchableSelect
              label="Staff member" name="userId"
              value={userId} onChange={(e) => setUserId(e.target.value)}
              placeholder={loadingStaff ? "Loading…" : "Pick a staff member"}
              searchPlaceholder="Search by name or role…"
              options={staffRows.map((s) => ({
                value: s.userId, label: s.name, secondary: s.roleName, keywords: s.roleName,
              }))}
              helperText={loadingStaff ? "Loading…" : staffRows.length ? undefined : "No staff found"}
            />
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

// ── The six times ────────────────────────────────────────────────────────────

/**
 * The six operative times, each recordable now OR at the time it actually
 * happened, and each correctable afterwards.
 *
 * This was six large buttons that stamped `now` and stayed enabled. Three
 * things were wrong with that in a real theatre:
 *
 *  1. A SECOND TAP SILENTLY OVERWROTE a correct time with the current one. No
 *     confirmation, no undo, and with gloved hands on a wall display a mis-tap
 *     is not a remote possibility. The server's ordering check caught some of
 *     them; re-tapping the most recent stamp passed validation and destroyed it.
 *  2. A TIME THAT HAD ALREADY PASSED COULD NOT BE ENTERED. The scrub nurse is
 *     scrubbed at the moment of incision and cannot reach the screen, so the
 *     stamp was either late - and wrong - or never made. The API has always
 *     accepted any past instant; only this screen insisted on `now`.
 *  3. THE DURATIONS WERE NEVER SHOWN BACK. Six stamps exist to answer "how long
 *     did this take", and answering it meant subtracting clock faces by eye.
 *
 * So: one tap still records now, which is the common case and the whole point
 * at the wheel events. A recorded time becomes a value with an Edit beside it
 * rather than a live button. And the three intervals are shown as they become
 * computable.
 */
function TimesSection({ record, stamp }: {
  record: Record<string, string | number | null> | null;
  stamp: { mutate: (b: Record<string, unknown>) => void; isPending: boolean };
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const at = (k: string) => (record?.[k] as string | undefined) || null;

  const open = (key: string) => { setEditing(key); setDraft(toLocalInput(at(key))); };
  const commit = (key: string) => {
    if (!draft) return;
    const d = new Date(draft);
    if (isNaN(d.getTime())) return;
    stamp.mutate({ [key]: d.toISOString() });
    setEditing(null);
  };

  const spans = SPANS.map((s) => ({ ...s, value: gap(at(s.from), at(s.to)) })).filter((s) => s.value);

  return (
    <Section
      title="The six times"
      description="Record each as it happens, or set the time it actually happened. Utilisation and turnaround are computed from these, and nothing else can produce them."
    >
      <Stack divider={<Divider />} sx={{ mx: -1 }}>
        {TIMES.map((t, i) => {
          const value = at(t.key);
          const isEditing = editing === t.key;
          return (
            <Box key={t.key} sx={{ px: 1, py: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                {/* Numbered because the six ARE a sequence - the server rejects
                    a time that falls out of this order, so the order is a rule
                    the nurse is held to and should be able to see. */}
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: "monospace", fontWeight: 700, color: value ? BRAND.action : "text.disabled",
                    width: 18, flexShrink: 0,
                  }}
                >
                  {i + 1}
                </Typography>

                <Box sx={{ flex: 1, minWidth: 150 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{t.label}</Typography>
                  {MOVES_PATIENT.has(t.key) && (
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      Also moves the patient
                    </Typography>
                  )}
                </Box>

                {value ? (
                  <>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: SEMANTIC.success }}
                    >
                      {clock(value)}
                    </Typography>
                    <Button
                      size="small" sx={{ textTransform: "none", fontWeight: 600 }}
                      onClick={() => (isEditing ? setEditing(null) : open(t.key))}
                    >
                      {isEditing ? "Cancel" : "Edit"}
                    </Button>
                  </>
                ) : (
                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                    <Button
                      variant="contained" size="large"
                      startIcon={<ScheduleRounded />}
                      sx={{ textTransform: "none", fontWeight: 700 }}
                      disabled={stamp.isPending}
                      onClick={() => stamp.mutate({ [t.key]: new Date().toISOString() })}
                    >
                      Now
                    </Button>
                    <Button
                      size="small" sx={{ textTransform: "none", fontWeight: 600 }}
                      onClick={() => (isEditing ? setEditing(null) : open(t.key))}
                    >
                      {isEditing ? "Cancel" : "Earlier…"}
                    </Button>
                  </Stack>
                )}
              </Box>

              <Collapse in={isEditing} unmountOnExit>
                <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1.5, pl: { xs: 0, sm: "34px" }, flexWrap: "wrap" }}>
                  <TextField
                    type="datetime-local" size="small" label={`${t.label} - actual time`}
                    value={draft} onChange={(e) => setDraft(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 230 }}
                  />
                  <Button
                    variant="contained" sx={{ textTransform: "none", fontWeight: 700 }}
                    disabled={!draft || stamp.isPending}
                    onClick={() => commit(t.key)}
                  >
                    {value ? "Correct it" : "Record it"}
                  </Button>
                </Stack>
              </Collapse>
            </Box>
          );
        })}
      </Stack>

      {spans.length > 0 && (
        <Box
          sx={{
            mt: 2.5, px: 2, py: 1.5, borderRadius: 2,
            border: "1px solid", borderColor: "divider",
            display: "flex", gap: 3, flexWrap: "wrap",
          }}
        >
          {spans.map((s) => (
            <Box key={s.label}>
              <Typography
                variant="caption"
                sx={{ display: "block", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, color: "text.secondary" }}
              >
                {s.label}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {s.value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Section>
  );
}

// ── Anaesthesia, with the six timestamps ─────────────────────────────────────

function AnaesthesiaTab({ id, record, onSaved, show = "both" }: {
  id: string;
  record: Record<string, string | number | null> | null;
  onSaved: () => void;
  /** The times are stamped as the case runs; the anaesthetic is written up. */
  show?: "times" | "form" | "both";
}) {
  const toast = useToast();
  const save = useSectionSave(id, onSaved, "Anaesthesia saved");
  // Wheeling in and out moves the patient as well as recording the time, so
  // the toast has to say so - a button that quietly does two things is a
  // button people stop trusting.
  const stampTime = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      (await axiosInstance.put(`/ipd/ot/cases/${id}/record`, body)).data,
    onSuccess: (res) => {
      const m = (res as { movement?: { status?: string } } | undefined)?.movement?.status;
      toast.success(
        m === "moved" ? "Time recorded - the patient has been moved, and the ward board now shows it"
          : m === "no-theatre" ? "Time recorded. No theatre is booked for this case, so the patient was not moved"
          : m === "theatre-busy" ? "Time recorded. The theatre is not free, so the patient was not moved - check the theatre board"
          : m === "no-admission" ? "Time recorded (day case - there is no ward bed to move them from)"
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
      {show !== "form" && <TimesSection record={record} stamp={stampTime} />}

      {show !== "times" && (
      <Section
        title="Anaesthesia"
        footer={
          <Button variant="contained" size="large" sx={{ textTransform: "none", fontWeight: 700 }}
            disabled={save.isPending} onClick={() => save.mutate(f)}>
            Save this section
          </Button>
        }
      >
        <Grid container spacing={2.5}>
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
      </Section>
      )}
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
    <Section
      title="What was done"
      footer={
        <Button variant="contained" size="large" sx={{ textTransform: "none", fontWeight: 700 }}
          disabled={save.isPending}
          onClick={() => save.mutate({ ...f, ...(f.bloodLossMl !== undefined ? { bloodLossMl: f.bloodLossMl === "" ? null : Number(f.bloodLossMl) } : {}) })}>
          Save this section
        </Button>
      }
    >
      <Grid container spacing={2.5}>
        {field("preOpDiagnosis", "Pre-operative diagnosis", { half: true })}
        {field("postOpDiagnosis", "Post-operative diagnosis", { half: true, helper: "Kept separate - the difference is the point" })}
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
    </Section>
  );
}

// ── Implants ─────────────────────────────────────────────────────────────────

function ImplantsTab({ id, implants, onSaved }: { id: string; implants: Record<string, string | number | null>[]; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ implantName: "", manufacturer: "", batchNumber: "", serialNumber: "", quantity: "1", price: "", taxPercent: "0" });
  // Picked from the Schedule of Charges: the server prices it from the item, GST included.
  const [socOpen, setSocOpen] = useState(false);
  const [socItemId, setSocItemId] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: async () => axiosInstance.post(`/ipd/ot/cases/${id}/implants`, {
      implantName: f.implantName.trim(),
      manufacturer: f.manufacturer.trim() || undefined,
      batchNumber: f.batchNumber.trim() || undefined,
      serialNumber: f.serialNumber.trim() || undefined,
      quantity: Number(f.quantity) || 1,
      ...(socItemId
        ? { chargeItemId: socItemId }
        : { price: f.price ? Number(f.price) : undefined, taxPercent: f.taxPercent ? Number(f.taxPercent) : 0 }),
    }),
    onSuccess: () => {
      toast.success("Implant recorded");
      setF({ implantName: "", manufacturer: "", batchNumber: "", serialNumber: "", quantity: "1", price: "", taxPercent: "0" });
      setSocItemId(null);
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
          <Empty>None recorded.</Empty>
        ) : (
          <Stack spacing={1.25}>
            {implants.map((im) => {
              const traceable = !!(im.batchNumber || im.serialNumber);
              return (
                <RowCard key={String(im.surgeryImplantId)} tone={traceable ? undefined : SEMANTIC.warning}>
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
                        No batch or serial - this one cannot be found in a recall
                      </Typography>
                    )}
                  </Box>
                  <IconButton size="small" onClick={() => remove.mutate(String(im.surgeryImplantId))} aria-label="Remove implant">
                    <DeleteOutlineRounded fontSize="small" />
                  </IconButton>
                </RowCard>
              );
            })}
          </Stack>
        )}
      </Section>

      <Section
        title="Record an implant"
        footer={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="large" sx={{ textTransform: "none", fontWeight: 700 }} onClick={() => setSocOpen(true)}>
              From Schedule of Charges
            </Button>
            <Button variant="contained" size="large" startIcon={<AddRounded />} sx={{ textTransform: "none", fontWeight: 700 }}
              disabled={!f.implantName.trim() || add.isPending} onClick={() => add.mutate()}>
              Record it
            </Button>
          </Stack>
        }
      >
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth required label="Implant" value={f.implantName} onChange={(e) => setF({ ...f, implantName: e.target.value })} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Manufacturer" value={f.manufacturer} onChange={(e) => setF({ ...f, manufacturer: e.target.value })} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Batch number" value={f.batchNumber} onChange={(e) => setF({ ...f, batchNumber: e.target.value })}
              helperText="This is what a recall is searched by" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Serial number" value={f.serialNumber} onChange={(e) => setF({ ...f, serialNumber: e.target.value })} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth type="number" label="Quantity" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField fullWidth label="Price" value={f.price} disabled={!!socItemId} onChange={(e) => setF({ ...f, price: e.target.value })}
              helperText={socItemId ? "From the Schedule of Charges" : undefined} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <TextField fullWidth label="GST %" value={f.taxPercent} disabled={!!socItemId} onChange={(e) => setF({ ...f, taxPercent: e.target.value })} />
          </Grid>
          {socItemId && (
            <Grid size={{ xs: 12 }}>
              <Button size="small" sx={{ textTransform: "none" }} onClick={() => { setSocItemId(null); setF({ ...f, price: "", taxPercent: "0" }); }}>
                Enter the price by hand instead
              </Button>
            </Grid>
          )}
        </Grid>
        <SocChargePicker
          open={socOpen}
          onClose={() => setSocOpen(false)}
          preferCategories={["implant", "prosthe"]}
          onPick={(c) => {
            setF((prev) => ({ ...prev, implantName: c.itemName, price: String(c.price), taxPercent: String(c.taxPercent) }));
            setSocItemId(c.chargeItemId);
            setSocOpen(false);
          }}
        />
      </Section>
    </>
  );
}

// ── Consumables ──────────────────────────────────────────────────────────────

type CatalogItem = { chargeItemId: string; itemName: string; isActive?: boolean; category?: { categoryName: string } | null };

/**
 * What was used in theatre, as the nurse counts it - sutures, drapes, theatre
 * drugs. No prices here: picked from the Schedule of Charges, an item is priced
 * from there on the Bill tab; typed by name, whoever bills the case prices it.
 */
function ConsumablesTab({ id, consumables, onSaved }: { id: string; consumables: Record<string, string | number | boolean | null>[]; onSaved: () => void }) {
  const toast = useToast();
  const [picked, setPicked] = useState<CatalogItem | string | null>(null);
  const [text, setText] = useState("");
  const [quantity, setQuantity] = useState("1");
  const term = useDebouncedValue(text.trim());

  const options = useQuery({
    queryKey: ["soc-search", term],
    queryFn: async () => ((await axiosInstance.get("/hospital/soc/search", { params: { q: term } })).data.data?.items ?? []) as CatalogItem[],
    enabled: term.length >= 2,
    staleTime: 60_000,
  });

  const add = useMutation({
    mutationFn: async () => {
      const qty = Number(quantity) || 1;
      if (picked && typeof picked === "object") return axiosInstance.post(`/ipd/ot/cases/${id}/consumables`, { chargeItemId: picked.chargeItemId, quantity: qty });
      return axiosInstance.post(`/ipd/ot/cases/${id}/consumables`, { itemName: (typeof picked === "string" ? picked : text).trim(), quantity: qty });
    },
    onSuccess: () => {
      toast.success("Recorded");
      setPicked(null); setText(""); setQuantity("1");
      onSaved();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not record it")),
  });
  const remove = useMutation({
    mutationFn: async (consumableId: string) => axiosInstance.delete(`/ipd/ot/cases/${id}/consumables/${consumableId}`),
    onSuccess: () => { toast.success("Removed"); onSaved(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not remove it")),
  });

  const name = picked && typeof picked === "object" ? picked.itemName : (typeof picked === "string" ? picked : text);

  return (
    <>
      <Section title="Consumables used" description="Sutures, drapes, theatre drugs - what was used and how many. Billing prices them.">
        {consumables.length === 0 ? (
          <Empty>None recorded.</Empty>
        ) : (
          <Stack spacing={1.25}>
            {consumables.map((c) => (
              <RowCard key={String(c.surgeryConsumableId)}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {String(c.itemName)} {Number(c.quantity) > 1 ? `× ${c.quantity}` : ""}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                    {c.chargeItemId ? "From the Schedule of Charges" : "Typed by name - billing sets its price"}
                    {c.onBill ? " · on the bill" : ""}
                  </Typography>
                </Box>
                {!c.onBill && (
                  <IconButton size="small" onClick={() => remove.mutate(String(c.surgeryConsumableId))} aria-label="Remove item">
                    <DeleteOutlineRounded fontSize="small" />
                  </IconButton>
                )}
              </RowCard>
            ))}
          </Stack>
        )}
      </Section>

      <Section
        title="Record a consumable"
        footer={
          <Button variant="contained" size="large" startIcon={<AddRounded />} sx={{ textTransform: "none", fontWeight: 700 }}
            disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}>
            Record it
          </Button>
        }
      >
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, sm: 9 }}>
            <Autocomplete
              freeSolo
              options={(options.data ?? []).filter((o) => o.isActive !== false)}
              value={picked}
              inputValue={text}
              onInputChange={(_e, v) => setText(v)}
              onChange={(_e, v) => setPicked(v)}
              filterOptions={(o) => o}
              loading={options.isFetching}
              getOptionLabel={(o) => (typeof o === "string" ? o : o.itemName)}
              isOptionEqualToValue={(a, b) => typeof a !== "string" && typeof b !== "string" && a.chargeItemId === b.chargeItemId}
              renderOption={(props, o) => (
                <li {...props} key={typeof o === "string" ? o : o.chargeItemId}>
                  <Box>
                    <Typography variant="body2">{typeof o === "string" ? o : o.itemName}</Typography>
                    {typeof o !== "string" && o.category?.categoryName && (
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>{o.category.categoryName}</Typography>
                    )}
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} required label="Item"
                  helperText="Search the Schedule of Charges, or type a name if it is not there" />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField fullWidth type="number" label="How many" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputProps={{ min: 1 }} />
          </Grid>
        </Grid>
      </Section>
    </>
  );
}

// ── Consent ──────────────────────────────────────────────────────────────────

function ConsentTab({ id, consents, onSaved, formsPath }: {
  id: string; consents: Record<string, string | boolean>[]; onSaved: () => void;
  /**
   * The patient's profile in this panel. The printable consent forms (the
   * paper the patient actually signs) live on its Forms tab; this screen only
   * records that consent was taken. The button opens that tab directly.
   */
  formsPath?: string;
}) {
  const toast = useToast();
  const navigate = useNavigate();
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
      <Section
        title="Consent on file"
        action={formsPath && (
          <Button variant="outlined" size="small" startIcon={<DescriptionRounded />} sx={{ textTransform: "none" }}
            onClick={() => navigate(formsPath, { state: { tab: "forms" } })}>
            Consent forms
          </Button>
        )}
      >
        {consents.length === 0 ? (
          <Empty>Nothing recorded yet.</Empty>
        ) : (
          <Stack spacing={1.25}>
            {consents.map((c) => (
              <RowCard key={String(c.surgeryConsentId)} tone={c.isActive ? undefined : SEMANTIC.danger}>
                {c.isActive ? <CheckCircleRounded sx={{ color: SEMANTIC.success }} /> : <RadioButtonUncheckedRounded sx={{ color: SEMANTIC.danger }} />}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {CONSENT_TYPES.find((t) => t.value === c.consentType)?.label ?? String(c.consentType)}
                    {!c.isActive && " - withdrawn"}
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
              </RowCard>
            ))}
          </Stack>
        )}
      </Section>

      <Section
        title="Record consent"
        footer={
          <Button variant="contained" size="large" sx={{ textTransform: "none", fontWeight: 700 }}
            disabled={add.isPending || (needsGiver && (!f.giverName.trim() || !f.relationship.trim()))}
            onClick={() => add.mutate()}>
            Record consent
          </Button>
        }
      >
        <Grid container spacing={2.5}>
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
 * The same move the bed board offers - this is the second door, and it exists
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
            They have no bed - their old one was released on the way in. Choose one.
          </Alert>
        )}
        <SearchableSelect
          label="Bed" name="toBedId" required={!heldBed}
          value={toBedId} onChange={(e) => setToBedId(e.target.value)}
          placeholder={heldBed ? `Back to bed ${heldBed}` : "Pick a bed"}
          // The held bed stays a real, selectable option - it is the default
          // and the common answer, not an absence of one.
          emptyOption={heldBed ? { value: "", label: `Back to bed ${heldBed}` } : undefined}
          searchPlaceholder="Search by ward, room or bed…"
          options={beds.map((b) => ({ value: b.bedId, label: b.label || b.bedNumber }))}
          helperText={isLoading ? "Loading…" : beds.length ? "Beds free right now" : "No bed is free"}
        />
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
