import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography,
  TextField, IconButton, Chip, Paper, Divider, Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  SwapHorizRounded, ChevronLeftRounded, ChevronRightRounded, SendRounded,
  CheckCircleRounded, RadioButtonUncheckedRounded,
} from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { SEMANTIC, BRAND, NEUTRAL } from "@/styles/accents";
import ErrorState from "@/components/ErrorState";
import { ListSkeleton } from "@/components/TableRowsSkeleton";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import dayjs from "dayjs";

/**
 * The shift handover sheet — what one shift leaves for the next.
 *
 * Its value is that named people put their name to it, so every signature shows
 * WHO signed and WHEN, and an unsigned role is visible as unsigned rather than
 * quietly absent. A signature can never be replaced.
 *
 * Notes append. A correction is another note, exactly as another line gets added
 * on paper rather than the previous one being scrubbed out.
 */

interface Props { open: boolean; admission: any; onClose: () => void; readOnly?: boolean }

export default function HandoverDialog({ open, admission, onClose, readOnly = false }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const admissionId = admission?.admissionId;

  const [dayOffset, setDayOffset] = useState(0);
  const date = dayjs().add(dayOffset, "day");
  const dateStr = date.format("YYYY-MM-DD");

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ipd-handover", admissionId, dateStr],
    queryFn: async () =>
      (await axiosInstance.get(`/ipd/admissions/${admissionId}/handover`, { params: { date: dateStr } })).data.data,
    enabled: open && !!admissionId,
  });

  const shifts: any[] = data?.shifts ?? [];

  const addNote = useMutation({
    mutationFn: async ({ shiftName, noteText }: { shiftName: string; noteText: string }) =>
      (await axiosInstance.post(`/ipd/admissions/${admissionId}/handover`, { shiftName, noteText, chartDate: dateStr })).data,
    onSuccess: (_d, v) => {
      setDrafts((p) => ({ ...p, [v.shiftName]: "" }));
      qc.invalidateQueries({ queryKey: ["ipd-handover", admissionId] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const sign = useMutation({
    mutationFn: async ({ shiftName, role }: { shiftName: string; role: string }) =>
      (await axiosInstance.post(`/ipd/admissions/${admissionId}/handover/sign`, { shiftName, role, chartDate: dateStr })).data,
    onSuccess: () => {
      toast.success("Signed");
      qc.invalidateQueries({ queryKey: ["ipd-handover", admissionId] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle component="div" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <SwapHorizRounded sx={{ color: BRAND.action }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Shift handover — {admission?.patientName}</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>{admission?.uhid} · {admission?.bed?.label || "—"}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <IconButton size="small" aria-label="Previous chart day" onClick={() => setDayOffset((d) => d - 1)}><ChevronLeftRounded /></IconButton>
          <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 110, textAlign: "center" }}>
            {dayOffset === 0 ? "Today" : date.format("DD MMM YYYY")}
          </Typography>
          <IconButton size="small" aria-label="Next chart day" onClick={() => setDayOffset((d) => d + 1)} disabled={dayOffset >= 0}><ChevronRightRounded /></IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: "background.default" }}>
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : isError ? (
          <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {shifts.map((s) => (
              <Paper key={s.shiftName} elevation={0}
                sx={{ borderRadius: 3, border: "1px solid", borderColor: s.fullySigned ? alpha(SEMANTIC.success, 0.4) : "divider", overflow: "hidden" }}>
                <Box sx={{
                  px: 2.5, py: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2,
                  flexWrap: "wrap", bgcolor: s.fullySigned ? alpha(SEMANTIC.success, 0.06) : "background.paper",
                  borderBottom: "1px solid", borderColor: "divider",
                }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{s.shiftName}</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{s.shiftStart} – {s.shiftEnd}</Typography>
                  </Box>
                  {s.fullySigned && (
                    <Chip size="small" icon={<CheckCircleRounded />} label="Fully signed"
                      sx={{ bgcolor: alpha(SEMANTIC.success, 0.14), color: SEMANTIC.success, fontWeight: 700 }} />
                  )}
                </Box>

                <Box sx={{ px: 2.5, py: 2 }}>
                  {s.notes.length === 0 ? (
                    <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic" }}>
                      Nothing handed over for this shift yet.
                    </Typography>
                  ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                      {s.notes.map((n: any) => (
                        <Box key={n.handoverEntryId} sx={{ pl: 1.5, borderLeft: "3px solid", borderColor: alpha(BRAND.action, 0.35) }}>
                          <Typography variant="body2" sx={{ color: "text.primary", whiteSpace: "pre-wrap" }}>{n.noteText}</Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {n.author} · {dayjs(n.createdAt).format("DD MMM, HH:mm")}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {!readOnly && (
                    <Box sx={{ display: "flex", gap: 1, mt: 2, alignItems: "flex-start" }}>
                      <TextField
                        size="small" fullWidth multiline minRows={2} placeholder="What should the next shift know or do?"
                        value={drafts[s.shiftName] ?? ""}
                        onChange={(e) => setDrafts({ ...drafts, [s.shiftName]: e.target.value })}
                      />
                      <Button
                        variant="contained" startIcon={<SendRounded />} sx={{ textTransform: "none", mt: 0.25 }}
                        disabled={!(drafts[s.shiftName] ?? "").trim() || addNote.isPending}
                        onClick={() => addNote.mutate({ shiftName: s.shiftName, noteText: (drafts[s.shiftName] ?? "").trim() })}
                      >
                        Add
                      </Button>
                    </Box>
                  )}

                  <Divider sx={{ my: 2 }} />

                  {/* Every configured role gets a slot, signed or not — an
                      unsigned handover has to be visible as unsigned. */}
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 1 }}>
                    Sign-off
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {s.signOffs.map((so: any) =>
                      so.signed ? (
                        <Tooltip key={so.role} title={`Signed ${dayjs(so.at).format("DD MMM, HH:mm")}`}>
                          <Chip
                            icon={<CheckCircleRounded />} label={`${so.role} — ${so.by}`}
                            sx={{ bgcolor: alpha(SEMANTIC.success, 0.12), color: SEMANTIC.success, fontWeight: 600 }}
                          />
                        </Tooltip>
                      ) : (
                        <Chip
                          key={so.role} icon={<RadioButtonUncheckedRounded />} label={so.role}
                          variant="outlined" clickable={!readOnly}
                          onClick={readOnly ? undefined : () => sign.mutate({ shiftName: s.shiftName, role: so.role })}
                          sx={{ color: NEUTRAL.muted, borderStyle: "dashed" }}
                        />
                      ),
                    )}
                  </Box>
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Notes are added, never edited. A signature records who signed and when, and cannot be replaced.
        </Typography>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
