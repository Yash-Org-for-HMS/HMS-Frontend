import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack, Typography, Box, Divider,
} from "@mui/material";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import { getApiErrorMessage } from "@/utils/apiError";
import { SEMANTIC } from "@/styles/accents";
import SoftChip from "@/components/SoftChip";
import HeartbeatLoader from "@/components/HeartbeatLoader";

/**
 * Progress notes on the ward round (backend /ward-round/admissions/:id/notes).
 * A resident's note goes to the consultant to co-sign; each note says whether
 * it has been.
 */

export interface RoundNote {
  noteId: string;
  noteText: string;
  createdAt: string;
  authorName: string | null;
  cosign: { needed: false } | { needed: true; cosignedAt: string | null; cosignedBy: string | null; overdue: boolean };
}

interface Props {
  open: boolean;
  onClose: () => void;
  admission: { admissionId: string; patientName: string };
  /** A resident: the note goes to the consultant to co-sign. */
  resident: boolean;
}

function CosignChip({ c }: { c: RoundNote["cosign"] }) {
  if (!c.needed) return null;
  if (c.cosignedAt) return <SoftChip label={`Co-signed${c.cosignedBy ? ` by Dr. ${c.cosignedBy}` : ""}`} bg={`${SEMANTIC.success}1f`} color={SEMANTIC.success} />;
  return c.overdue
    ? <SoftChip label="Co-sign overdue" bg={`${SEMANTIC.danger}1f`} color={SEMANTIC.danger} />
    : <SoftChip label="Awaiting co-sign" bg={`${SEMANTIC.warning}22`} color={SEMANTIC.warningDark} />;
}

export default function WardRoundNotesDialog({ open, onClose, admission, resident }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const key = ["ward-round-notes", admission.admissionId];
  const { data: notes = [], isLoading, isError, error } = useQuery<RoundNote[]>({
    queryKey: key,
    queryFn: async () => (await axiosInstance.get(`/ward-round/admissions/${admission.admissionId}/notes`)).data.data,
    enabled: open,
  });

  const add = async () => {
    setSaving(true);
    try {
      await axiosInstance.post(`/ward-round/admissions/${admission.admissionId}/notes`, { noteText: text.trim() });
      setText("");
      toast.success(resident ? "Note saved — sent to the consultant to co-sign" : "Note saved");
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["role-home", "ward-round"] });
      qc.invalidateQueries({ queryKey: ["ward-round-cosign"] });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Couldn't save the note"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Round notes · {admission.patientName}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <TextField
            id="round-note"
            label="Today's note"
            multiline
            minRows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            inputProps={{ maxLength: 4000 }}
            helperText={resident ? "Goes to the patient's consultant to co-sign within 24 hours." : undefined}
          />
          <Divider />
          {isLoading ? (
            <Box sx={{ py: 3, display: "flex", justifyContent: "center" }}><HeartbeatLoader /></Box>
          ) : isError ? (
            <Typography variant="body2" sx={{ color: SEMANTIC.danger }}>{getApiErrorMessage(error, "Couldn't load the notes")}</Typography>
          ) : !notes.length ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>No round notes for this stay yet.</Typography>
          ) : notes.map((n) => (
            <Box key={n.noteId}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>{n.authorName ? `Dr. ${n.authorName}` : "Doctor"}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>{dayjs(n.createdAt).format("DD MMM, h:mm A")}</Typography>
                <CosignChip c={n.cosign} />
              </Box>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{n.noteText}</Typography>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saving}>Close</Button>
        <Button variant="contained" onClick={add} disabled={saving || !text.trim()}>{saving ? "Saving…" : "Save note"}</Button>
      </DialogActions>
    </Dialog>
  );
}
