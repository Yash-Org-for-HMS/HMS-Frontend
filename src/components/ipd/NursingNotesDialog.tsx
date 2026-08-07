import { useState } from "react";
import { ACCENTS } from "@/styles/accents";
import { getApiErrorMessage } from "@/utils/apiError";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack, Typography, Box, Divider,
} from "@mui/material";
import { DescriptionRounded, AddRounded, PersonRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "../HeartbeatLoader";

interface Props {
  open: boolean;
  onClose: () => void;
  admission: any; // { admissionId, patientName }
}

// Per-admission nursing documentation. APPEND-ONLY: notes can be added and read,
// never edited or deleted (a nursing record is medico-legal).
export default function NursingNotesDialog({ open, onClose, admission }: Props) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: notes = [], isFetching, refetch } = useQuery<any[]>({
    queryKey: ["ipd-nursing-notes", admission?.admissionId],
    queryFn: async () => (await axiosInstance.get(`/ipd/admissions/${admission.admissionId}/nursing-notes`)).data.data,
    enabled: open && !!admission?.admissionId,
  });

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await axiosInstance.post(`/ipd/admissions/${admission.admissionId}/nursing-notes`, { noteText: text.trim() });
      toast.success("Note added");
      setText("");
      refetch();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to add note"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <DescriptionRounded sx={{ color: ACCENTS.ipd }} /> Nursing Notes
        {isFetching && <HeartbeatLoader size={18} />}
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {admission?.patientName} — nursing observations & handover for this stay. Notes are permanent (append-only): they can't be edited or deleted.
        </Typography>

        <Stack spacing={1.5} sx={{ mb: 2 }}>
          <TextField label="New note" value={text} onChange={(e) => setText(e.target.value)} multiline minRows={2} fullWidth
            placeholder="e.g. Patient stable, afebrile. Dressing changed, tolerating orals." autoFocus />
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="contained" onClick={submit} disabled={saving || !text.trim()}
              startIcon={saving ? <HeartbeatLoader size={20} /> : <AddRounded />}
              sx={{ bgcolor: ACCENTS.ipd, "&:hover": { bgcolor: ACCENTS.ipdDark } }}>Add note</Button>
          </Box>
        </Stack>

        <Divider sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase" }}>
            {notes.length} note{notes.length === 1 ? "" : "s"}
          </Typography>
        </Divider>

        {notes.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic", textAlign: "center", py: 3 }}>No nursing notes yet.</Typography>
        ) : (
          <Stack spacing={1.5}>
            {notes.map((n) => (
              <Box key={n.nursingNoteId} sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "background.default" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
                  <PersonRounded sx={{ fontSize: 15, color: "text.disabled" }} />
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>{n.author}</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>· {dayjs(n.createdAt).format("DD MMM YYYY · HH:mm")}</Typography>
                </Box>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{n.noteText}</Typography>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={saving}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
