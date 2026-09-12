import { useState } from "react";
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Typography, Box, Tooltip,
} from "@mui/material";
import { HistoryRounded, CloseRounded } from "@mui/icons-material";
import ClinicalTimeline from "./ClinicalTimeline";

/**
 * "Patient history" - the same door, wherever a patient is on the screen.
 *
 * The unified timeline already existed, but only on the doctor's own profile.
 * So a surgeon could see what had happened to a patient and the scrub nurse
 * beside them could not, and a nurse about to give a drug on a treatment chart
 * had no way to check what the patient had already been given, reacted to, or
 * been admitted for. Every screen that names a patient can now open it.
 *
 * Read-only, deliberately. This is a window onto records authored elsewhere,
 * each behind its own panel's guard; nothing here writes.
 *
 * Two exports, because a menu cannot own its own dialog: closing the Menu
 * unmounts everything inside it, and the dialog would go with it before it ever
 * painted. So a row menu renders a plain MenuItem and holds the dialog itself
 * via `PatientHistoryDialog`; everywhere else uses the self-contained button.
 */

export interface PatientRef {
  patientId?: string | null;
  patientName?: string | null;
  uhid?: string | null;
}

/** Controlled. Use this when the opener lives somewhere that unmounts (a Menu). */
export function PatientHistoryDialog({
  open,
  onClose,
  patientId,
  patientName,
  uhid,
  basePath = "/clinical/patients",
}: PatientRef & { open: boolean; onClose: () => void; basePath?: string }) {
  return (
    <Dialog open={open && !!patientId} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pr: 6 }}>
        <Typography component="div" variant="h6" sx={{ fontWeight: 800 }}>
          {patientName || "Patient history"}
        </Typography>
        {/* The name alone is not identification - two patients share one often
            enough that the UHID has to be on the dialog somebody reads before
            giving a drug. */}
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {uhid ? `${uhid} · ` : ""}Everything on record, most recent first
        </Typography>
        <IconButton onClick={onClose} aria-label="Close" sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseRounded />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {/* Mounted only while open, so opening it is what fetches - a board of
            twenty beds does not make twenty timeline requests on load. */}
        <Box sx={{ minHeight: 120 }}>
          {open && patientId && <ClinicalTimeline patientId={patientId} basePath={basePath} />}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Self-contained opener. `variant="icon"` for a table row where a label will
 * not fit, `"button"` for a header action.
 *
 * Renders nothing at all without a patientId. A button that opens an empty
 * dialog is worse than no button: it teaches people the feature is broken.
 */
export default function PatientHistoryButton({
  patientId,
  patientName,
  uhid,
  variant = "button",
  basePath = "/clinical/patients",
}: PatientRef & { variant?: "button" | "icon"; basePath?: string }) {
  const [open, setOpen] = useState(false);
  if (!patientId) return null;

  const label = "Patient history";
  const openIt = (e: React.MouseEvent) => { e.stopPropagation(); setOpen(true); };

  return (
    <>
      {variant === "icon" ? (
        <Tooltip title={label}>
          <IconButton size="small" onClick={openIt} aria-label={label}>
            <HistoryRounded fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <Button size="small" startIcon={<HistoryRounded />} onClick={openIt}
          sx={{ textTransform: "none", fontWeight: 700 }}>
          {label}
        </Button>
      )}
      <PatientHistoryDialog open={open} onClose={() => setOpen(false)}
        patientId={patientId} patientName={patientName} uhid={uhid} basePath={basePath} />
    </>
  );
}
