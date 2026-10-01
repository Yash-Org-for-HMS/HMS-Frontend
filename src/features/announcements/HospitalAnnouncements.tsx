import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  FormControlLabel, Radio, RadioGroup, Checkbox, FormGroup, Typography, Stack, Autocomplete,
} from "@mui/material";
import SoftChip from "@/components/SoftChip";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { axiosInstance } from "@/api/axios";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import { useHospitalAuth, type AllowedBranch } from "@/providers/HospitalAuthContext";
import { SEMANTIC, NEUTRAL } from "@/styles/accents";
import { ANNOUNCEMENTS_KEY, ANNOUNCEMENT_BADGE_KEY, SENT_ANNOUNCEMENTS_KEY as SENT_KEY } from "./useAnnouncementBadge";

/**
 * The hospital's own announcements to its staff (multi-branch plan, phase 7):
 * what the hospital and branch admins have said, and the dialog to say more.
 * The hospital admin writes to every branch or to some; a branch admin to the
 * branches they work at. The API holds both rules — this screen only offers
 * the choices it would accept.
 */

const PANELS = ["hospital", "reception", "nurse", "doctor", "lab", "pharmacy"] as const;
const PANEL_LABEL: Record<string, string> = {
  hospital: "Hospital Admin", reception: "Reception", nurse: "Nurse",
  doctor: "Doctor", lab: "Lab", pharmacy: "Pharmacy",
};
const SEVERITY_LABEL = { INFO: "Notice", WARNING: "Important", CRITICAL: "Urgent" } as const;
const TONE = {
  INFO: { color: SEMANTIC.info, bg: "rgba(59,130,246,0.12)" },
  WARNING: { color: SEMANTIC.warning, bg: "rgba(245,158,11,0.14)" },
  CRITICAL: { color: SEMANTIC.danger, bg: "rgba(239,68,68,0.14)" },
} as const;

interface SentRow {
  announcementId: string;
  title: string;
  severity: keyof typeof TONE;
  panelScope: string;
  panels: string[];
  branchScope: "ALL_BRANCHES" | "SELECTED_BRANCHES";
  branches: { branchId: string; branchName: string }[];
  publishAt: string;
  expiresAt: string | null;
  isRevoked: boolean;
  writtenBy: string | null;
  readCount: number;
  canWithdraw: boolean;
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function statusOf(r: SentRow): { label: string; color: string; bg: string } {
  if (r.isRevoked) return { label: "Withdrawn", color: NEUTRAL.muted, bg: "rgba(100,116,139,0.12)" };
  const now = Date.now();
  if (new Date(r.publishAt).getTime() > now) return { label: "Scheduled", color: SEMANTIC.info, bg: "rgba(59,130,246,0.12)" };
  if (r.expiresAt && new Date(r.expiresAt).getTime() <= now) return { label: "Expired", color: NEUTRAL.muted, bg: "rgba(100,116,139,0.12)" };
  return { label: "Live", color: SEMANTIC.success, bg: "rgba(16,185,129,0.12)" };
}

export function SentAnnouncements() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: SENT_KEY,
    queryFn: async () => (await axiosInstance.get("/hospital/announcements/sent")).data.data as SentRow[],
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => axiosInstance.patch(`/hospital/announcements/${id}/revoke`),
    onSuccess: () => {
      toast.success("Announcement withdrawn");
      queryClient.invalidateQueries({ queryKey: SENT_KEY });
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENT_BADGE_KEY });
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not withdraw it.")),
  });

  if (error) return <ErrorState message={apiErrorText(error)} onRetry={refetch} />;
  const rows = data ?? [];
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2 }}>
      <TableContainer sx={{ maxHeight: 620 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {["Announcement", "Branches", "Panels", "Written by", "Published", "Read by", "Status", ""].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRowsSkeleton rows={4} columns={8} />
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Mascot pose="nothing-here-yet" title="Nothing sent yet" subtitle="Write one to reach your staff — every branch, or just some." />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const st = statusOf(r);
                const tone = TONE[r.severity] ?? TONE.INFO;
                return (
                  // The title takes the slack; the short cells stay on one line.
                  <TableRow key={r.announcementId} hover sx={{ "& td:not(:first-of-type)": { whiteSpace: "nowrap" } }}>
                    <TableCell sx={{ minWidth: 220 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <SoftChip label={SEVERITY_LABEL[r.severity] ?? r.severity} bg={tone.bg} color={tone.color} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.title}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{r.branchScope === "ALL_BRANCHES" ? "Every branch" : r.branches.map((b) => b.branchName).join(", ")}</TableCell>
                    <TableCell>{r.panelScope === "ALL_PANELS" ? "All panels" : r.panels.map((p) => PANEL_LABEL[p] ?? p).join(", ")}</TableCell>
                    <TableCell>{r.writtenBy ?? "—"}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{shortDate(r.publishAt)}</TableCell>
                    <TableCell>{r.readCount.toLocaleString("en-IN")}</TableCell>
                    <TableCell><SoftChip label={st.label} bg={st.bg} color={st.color} /></TableCell>
                    <TableCell align="right">
                      {r.canWithdraw && (
                        <Button size="small" color="inherit" disabled={withdraw.isPending} onClick={() => withdraw.mutate(r.announcementId)}>
                          Withdraw
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export function HospitalComposeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isOrgAdmin, availableBranches } = useHospitalAuth();
  // A branch admin always names their branches; the hospital admin starts at every branch.
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState("INFO");
  const [branchScope, setBranchScope] = useState<"ALL_BRANCHES" | "SELECTED_BRANCHES">(isOrgAdmin ? "ALL_BRANCHES" : "SELECTED_BRANCHES");
  const [branches, setBranches] = useState<AllowedBranch[]>(isOrgAdmin || availableBranches.length !== 1 ? [] : availableBranches);
  const [panelScope, setPanelScope] = useState("ALL_PANELS");
  const [panels, setPanels] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");

  const send = useMutation({
    mutationFn: () =>
      axiosInstance.post("/hospital/announcements", {
        title, body, severity, branchScope, panelScope,
        branchIds: branchScope === "SELECTED_BRANCHES" ? branches.map((b) => b.branchId) : [],
        panels: panelScope === "SELECTED_PANELS" ? panels : [],
        expiresAt: expiresAt || null,
      }),
    onSuccess: () => {
      toast.success("Announcement published");
      queryClient.invalidateQueries({ queryKey: SENT_KEY });
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENT_BADGE_KEY });
      onClose();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not publish it.")),
  });

  const togglePanel = (p: string) => setPanels((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  // Mirrors the server's refusal to publish something addressed to nobody.
  const incomplete =
    !title.trim() || !body.trim() ||
    (branchScope === "SELECTED_BRANCHES" && branches.length === 0) ||
    (panelScope === "SELECTED_PANELS" && panels.length === 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>New announcement</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 0.5 }}>
          <TextField id="hospital-announcement-title" label="Title" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} inputProps={{ maxLength: 160 }} autoFocus />
          <TextField id="hospital-announcement-body" label="Message" fullWidth multiline minRows={3} value={body} onChange={(e) => setBody(e.target.value)} inputProps={{ maxLength: 4000 }} />
          <TextField id="hospital-announcement-severity" select label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <MenuItem value="INFO">Notice</MenuItem>
            <MenuItem value="WARNING">Important</MenuItem>
            <MenuItem value="CRITICAL">Urgent</MenuItem>
          </TextField>

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Which branches</Typography>
            {isOrgAdmin ? (
              <RadioGroup row value={branchScope} onChange={(e) => setBranchScope(e.target.value as typeof branchScope)}>
                <FormControlLabel value="ALL_BRANCHES" control={<Radio size="small" />} label="Every branch" />
                <FormControlLabel value="SELECTED_BRANCHES" control={<Radio size="small" />} label="Selected branches" />
              </RadioGroup>
            ) : (
              <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mb: 1 }}>
                As a branch admin you write to the branches you work at.
              </Typography>
            )}
            {branchScope === "SELECTED_BRANCHES" && (
              <Autocomplete
                id="hospital-announcement-branches"
                multiple size="small" options={availableBranches} value={branches}
                onChange={(_, v) => setBranches(v)}
                getOptionLabel={(o) => o.branchName}
                isOptionEqualToValue={(a, b) => a.branchId === b.branchId}
                renderInput={(params) => <TextField {...params} placeholder="Choose branches" />}
              />
            )}
            <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 0.75 }}>
              It reaches the people who work at those branches, wherever they are working today.
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Which panels</Typography>
            <RadioGroup row value={panelScope} onChange={(e) => setPanelScope(e.target.value)}>
              <FormControlLabel value="ALL_PANELS" control={<Radio size="small" />} label="All panels" />
              <FormControlLabel value="SELECTED_PANELS" control={<Radio size="small" />} label="Selected panels" />
            </RadioGroup>
            {panelScope === "SELECTED_PANELS" && (
              <FormGroup row>
                {PANELS.map((p) => (
                  <FormControlLabel key={p} label={PANEL_LABEL[p]}
                    control={<Checkbox size="small" checked={panels.includes(p)} onChange={() => togglePanel(p)} />} />
                ))}
              </FormGroup>
            )}
          </Box>

          <TextField
            id="hospital-announcement-expires" label="Stop showing after" type="datetime-local" value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)} InputLabelProps={{ shrink: true }}
            helperText="Optional. Leave empty to keep it visible until you withdraw it."
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button variant="contained" disabled={incomplete || send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? "Publishing…" : "Publish"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
