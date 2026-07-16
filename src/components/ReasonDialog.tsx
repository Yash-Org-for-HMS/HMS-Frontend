import { useEffect, useState } from "react";
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Typography, Button, Select, MenuItem, type ButtonProps } from "@mui/material";
import { useToast } from "../contexts/ToastContext";

interface Props {
  open: boolean;
  title: string;
  /** Explanatory line under the title. */
  description: string;
  /** Label above the reason dropdown, e.g. "Reason for cancellation". */
  reasonLabel: string;
  /** Reason options. Include the literal "Other" to reveal a free-text field. */
  reasons: string[];
  confirmLabel: string;
  busyLabel: string;
  confirmColor?: ButtonProps["color"];
  onClose: () => void;
  /** Perform the action; resolve `true` to close the dialog, `false` to keep it open. */
  onConfirm: (reason: string) => Promise<boolean>;
}

/**
 * A pick-a-reason confirmation dialog (dropdown of preset reasons, plus an
 * "Other → free text" option). Extracted from the two near-identical
 * cancel-order / dismiss-prescription dialogs in DispensaryPOS; the caller owns
 * the actual action via `onConfirm`, this owns only the reason form + submitting
 * state.
 */
export default function ReasonDialog({
  open, title, description, reasonLabel, reasons, confirmLabel, busyLabel, confirmColor = "error", onClose, onConfirm,
}: Props) {
  const toast = useToast();
  const [reasonType, setReasonType] = useState(reasons[0] ?? "");
  const [reasonText, setReasonText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fresh form each open (matches the previous reset on the trigger buttons).
  useEffect(() => {
    if (open) {
      setReasonType(reasons[0] ?? "");
      setReasonText("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleConfirm = async () => {
    const finalReason = reasonType === "Other" ? reasonText : reasonType;
    if (!finalReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    try {
      setSubmitting(true);
      if (await onConfirm(finalReason)) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography variant="body2" color="text.secondary">{description}</Typography>

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>{reasonLabel}</Typography>
          <Select fullWidth size="small" value={reasonType} onChange={(e) => setReasonType(e.target.value)}>
            {reasons.map((r) => (
              <MenuItem key={r} value={r}>{r === "Other" ? "Other (Specify)" : r}</MenuItem>
            ))}
          </Select>
        </Box>

        {reasonType === "Other" && (
          <TextField fullWidth size="small" label="Specify Reason" value={reasonText} onChange={(e) => setReasonText(e.target.value)} />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Close</Button>
        <Button onClick={handleConfirm} variant="contained" color={confirmColor} disabled={submitting}>
          {submitting ? busyLabel : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
