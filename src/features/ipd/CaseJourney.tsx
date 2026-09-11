import { Box, Typography, Paper, Button, Stack, Chip } from "@mui/material";
import {
  CheckCircleRounded, RadioButtonUncheckedRounded, ArrowForwardRounded,
  HotelRounded, MedicalServicesRounded, MeetingRoomRounded, EventNoteRounded,
} from "@mui/icons-material";
import { SEMANTIC, NEUTRAL, BRAND } from "@/styles/accents";
import { stageOf, type CaseStage, type JourneyInput } from "./caseStage";

/**
 * Where this case has got to, and the one thing to do next.
 *
 * The actions for moving a patient had ended up on three different screens —
 * the bed board's menu, a button under a tab called "Anaesthesia", and an item
 * on the operating list that set a status and moved nobody. Each was added
 * where it was convenient rather than where somebody would look, and between
 * them there was no screen that answered "where is this case up to".
 *
 * This is that screen. The steps are the journey a patient actually makes, the
 * current one is marked, and the single next action is a button — so the case
 * can be driven from beginning to end without knowing which screen hides which
 * verb.
 */

const STEPS: { key: CaseStage; label: string; icon: React.ReactNode }[] = [
  { key: "BOOKED", label: "On the list", icon: <EventNoteRounded fontSize="small" /> },
  { key: "IN_THEATRE", label: "In theatre", icon: <MedicalServicesRounded fontSize="small" /> },
  { key: "IN_RECOVERY", label: "In recovery", icon: <MeetingRoomRounded fontSize="small" /> },
  { key: "BACK_IN_BED", label: "Back in a bed", icon: <HotelRounded fontSize="small" /> },
];

export default function CaseJourney({ j, onAction, busy = false, canAct = true }: {
  j: JourneyInput;
  /** The one next action, or null when there is nothing to do from here. */
  onAction: (a: "WHEEL_IN" | "WHEEL_OUT" | "PLACE_IN_BED") => void;
  busy?: boolean;
  canAct?: boolean;
}) {
  const stage = stageOf(j);

  if (stage === "CANCELLED") {
    return (
      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "action.hover" }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NEUTRAL.muted }}>
          This case was cancelled — there is nothing to record.
        </Typography>
      </Paper>
    );
  }

  const reached = STEPS.findIndex((s) => s.key === stage);

  // What to do from here. Deliberately ONE thing: a row of equally-weighted
  // buttons is how the actions got scattered in the first place.
  const next = stage === "BOOKED"
    ? { action: "WHEEL_IN" as const, label: j.theatreName ? `Wheel in to ${j.theatreName}` : "Wheel in", hint: "Records the time and moves the patient — the ward board will show them away" }
    : stage === "IN_THEATRE"
      ? { action: "WHEEL_OUT" as const, label: "Wheel out to recovery", hint: "Frees the theatre for cleaning; their bed stays held" }
      : stage === "IN_RECOVERY"
        ? { action: "PLACE_IN_BED" as const, label: "Place in a bed", hint: j.bedNumber ? `Bed ${j.bedNumber} is being held for them` : "They have no bed — choose one" }
        : null;

  return (
    <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
        {/* The journey. Reads left to right, like the journey does. */}
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.5, flex: 1, minWidth: 0 }}>
          {STEPS.map((s, i) => {
            const done = i < reached;
            const here = i === reached;
            const color = here ? BRAND.action : done ? SEMANTIC.success : NEUTRAL.muted;
            return (
              <Box key={s.key} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box sx={{
                  display: "flex", alignItems: "center", gap: 0.6, px: 1.25, py: 0.6, borderRadius: 2,
                  bgcolor: here ? `${BRAND.action}14` : "transparent",
                  border: here ? `1px solid ${BRAND.action}44` : "1px solid transparent",
                }}>
                  <Box sx={{ color, display: "flex" }}>
                    {done ? <CheckCircleRounded fontSize="small" /> : here ? s.icon : <RadioButtonUncheckedRounded fontSize="small" />}
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: here ? 800 : 600, color: here ? "text.primary" : "text.secondary" }} noWrap>
                    {s.label}
                  </Typography>
                </Box>
                {i < STEPS.length - 1 && (
                  <ArrowForwardRounded sx={{ fontSize: 14, color: NEUTRAL.muted, opacity: 0.5 }} />
                )}
              </Box>
            );
          })}
        </Box>

        {/* Where they are right now, in words, for anyone scanning. */}
        <Chip
          size="small"
          label={
            stage === "IN_THEATRE" ? `In ${j.theatreName || "theatre"}`
              : stage === "IN_RECOVERY" ? "In recovery"
              : stage === "BACK_IN_BED" ? (j.bedNumber ? `In bed ${j.bedNumber}` : "Back on the ward")
              : j.bedNumber ? `In bed ${j.bedNumber}` : "Not yet in theatre"
          }
          sx={{ fontWeight: 700, bgcolor: `${BRAND.action}14`, color: BRAND.action }}
        />

        {next && canAct && (
          <Box sx={{ textAlign: { md: "right" } }}>
            <Button variant="contained" size="large" disabled={busy}
              sx={{ textTransform: "none", fontWeight: 700, whiteSpace: "nowrap" }}
              onClick={() => onAction(next.action)}>
              {busy ? "Working…" : next.label}
            </Button>
            <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 0.5, maxWidth: 260 }}>
              {next.hint}
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
