import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  FormControlLabel, Radio, RadioGroup, Checkbox, FormGroup, Typography, Stack, Autocomplete,
} from "@mui/material";
import { CampaignRounded } from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import SoftChip from "@/components/SoftChip";
import ErrorState from "@/components/ErrorState";
import Mascot from "@/components/Mascot";
import { TableRowsSkeleton } from "@/components/TableRowsSkeleton";
import { axiosInstance } from "@/api/axios";
import { apiErrorText, getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import { SEMANTIC, NEUTRAL } from "@/styles/accents";

const PANELS = ["hospital", "reception", "nurse", "doctor", "lab", "pharmacy"] as const;
const PANEL_LABEL: Record<string, string> = {
  hospital: "Hospital Admin", reception: "Reception", nurse: "Nurse",
  doctor: "Doctor", lab: "Lab", pharmacy: "Pharmacy",
};

interface Row {
  announcementId: string;
  title: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  audienceScope: string;
  panelScope: string;
  panels: string[];
  tenants: { hospitalId: string; hospitalName: string }[];
  publishAt: string;
  expiresAt: string | null;
  isRevoked: boolean;
  readCount: number;
  audienceSize: number;
}

interface HospitalOption { hospitalId: string; hospitalName: string }

const TONE = {
  INFO: { color: SEMANTIC.info, bg: "rgba(59,130,246,0.12)" },
  WARNING: { color: SEMANTIC.warning, bg: "rgba(245,158,11,0.14)" },
  CRITICAL: { color: SEMANTIC.danger, bg: "rgba(239,68,68,0.14)" },
} as const;

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Live, expired, scheduled or withdrawn - derived the same way the API does. */
function statusOf(r: Row): { label: string; color: string; bg: string } {
  if (r.isRevoked) return { label: "Withdrawn", color: NEUTRAL.muted, bg: "rgba(100,116,139,0.12)" };
  const now = Date.now();
  if (new Date(r.publishAt).getTime() > now) return { label: "Scheduled", color: SEMANTIC.info, bg: "rgba(59,130,246,0.12)" };
  if (r.expiresAt && new Date(r.expiresAt).getTime() <= now) return { label: "Expired", color: NEUTRAL.muted, bg: "rgba(100,116,139,0.12)" };
  return { label: "Live", color: SEMANTIC.success, bg: "rgba(16,185,129,0.12)" };
}

export default function AnnouncementsAdmin() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => (await axiosInstance.get("/announcements", { params: { limit: 50 } })).data.data as Row[],
  });

  const { data: hospitals = [] } = useQuery<HospitalOption[]>({
    queryKey: ["announcement-hospital-options"],
    queryFn: async () => (await axiosInstance.get("/hospitals", { params: { limit: 500 } })).data.data,
    enabled: open,
  });

  const revoke = useMutation({
    mutationFn: (id: string) => axiosInstance.patch(`/announcements/${id}/revoke`),
    onSuccess: () => {
      toast.success("Announcement withdrawn");
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not complete that action.")),
  });

  const rows = data ?? [];

  return (
    <PageContainer>
      <PageHeader
        title="Announcements"
        subtitle="Messages shown to tenant staff inside their own panel"
        actions={
          <Button variant="contained" startIcon={<CampaignRounded />} onClick={() => setOpen(true)}>
            New announcement
          </Button>
        }
      />

      {error ? (
        <ErrorState message={apiErrorText(error)} onRetry={refetch} />
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 2 }}>
          <TableContainer sx={{ maxHeight: 620 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {["Announcement", "Audience", "Panels", "Published", "Read", "Status", ""].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRowsSkeleton rows={5} columns={7} />
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Mascot pose="nothing-here-yet" title="Nothing sent yet" subtitle="Compose one to reach tenant staff." />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const st = statusOf(r);
                    const tone = TONE[r.severity] ?? TONE.INFO;
                    return (
                      <TableRow key={r.announcementId} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <SoftChip label={r.severity} bg={tone.bg} color={tone.color} />
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.title}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          {r.audienceScope === "ALL_TENANTS"
                            ? "All tenants"
                            : r.tenants.map((t) => t.hospitalName).join(", ") || "—"}
                        </TableCell>
                        <TableCell>
                          {r.panelScope === "ALL_PANELS"
                            ? "All panels"
                            : r.panels.map((p) => PANEL_LABEL[p] ?? p).join(", ")}
                        </TableCell>
                        <TableCell>{shortDate(r.publishAt)}</TableCell>
                        <TableCell>
                          {/* The denominator is who can see it now, not who existed when it was sent. */}
                          <Typography variant="body2">{r.readCount} of {r.audienceSize}</Typography>
                        </TableCell>
                        <TableCell><SoftChip label={st.label} bg={st.bg} color={st.color} /></TableCell>
                        <TableCell align="right">
                          {!r.isRevoked && (
                            <Button size="small" color="inherit" disabled={revoke.isPending}
                              onClick={() => revoke.mutate(r.announcementId)}>
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
      )}

      <ComposeDialog
        open={open}
        hospitals={hospitals}
        onClose={() => setOpen(false)}
        onSent={() => {
          setOpen(false);
          queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
        }}
      />
    </PageContainer>
  );
}

function ComposeDialog({ open, hospitals, onClose, onSent }: {
  open: boolean;
  hospitals: HospitalOption[];
  onClose: () => void;
  onSent: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState("INFO");
  const [audienceScope, setAudienceScope] = useState("ALL_TENANTS");
  const [selectedHospitals, setSelectedHospitals] = useState<HospitalOption[]>([]);
  const [panelScope, setPanelScope] = useState("ALL_PANELS");
  const [panels, setPanels] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");

  const reset = () => {
    setTitle(""); setBody(""); setSeverity("INFO");
    setAudienceScope("ALL_TENANTS"); setSelectedHospitals([]);
    setPanelScope("ALL_PANELS"); setPanels([]); setExpiresAt("");
  };

  const send = useMutation({
    mutationFn: () =>
      axiosInstance.post("/announcements", {
        title, body, severity, audienceScope, panelScope,
        hospitalIds: audienceScope === "SELECTED_TENANTS" ? selectedHospitals.map((h) => h.hospitalId) : [],
        panels: panelScope === "SELECTED_PANELS" ? panels : [],
        expiresAt: expiresAt || null,
      }),
    onSuccess: () => { toast.success("Announcement published"); reset(); onSent(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not complete that action.")),
  });

  const togglePanel = (p: string) =>
    setPanels((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  // Mirrors the server's own refusal to publish something addressed to nobody.
  const incomplete =
    !title.trim() || !body.trim() ||
    (audienceScope === "SELECTED_TENANTS" && selectedHospitals.length === 0) ||
    (panelScope === "SELECTED_PANELS" && panels.length === 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>New announcement</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 0.5 }}>
          <TextField label="Title" fullWidth value={title} onChange={(e) => setTitle(e.target.value)}
            inputProps={{ maxLength: 160 }} autoFocus />
          <TextField label="Message" fullWidth multiline minRows={3} value={body}
            onChange={(e) => setBody(e.target.value)} inputProps={{ maxLength: 4000 }} />
          <TextField select label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <MenuItem value="INFO">Notice</MenuItem>
            <MenuItem value="WARNING">Important</MenuItem>
            <MenuItem value="CRITICAL">Urgent</MenuItem>
          </TextField>

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Who receives it</Typography>
            <RadioGroup row value={audienceScope} onChange={(e) => setAudienceScope(e.target.value)}>
              <FormControlLabel value="ALL_TENANTS" control={<Radio size="small" />} label="All tenants" />
              <FormControlLabel value="SELECTED_TENANTS" control={<Radio size="small" />} label="Selected tenants" />
            </RadioGroup>
            {audienceScope === "SELECTED_TENANTS" && (
              <Autocomplete
                multiple size="small" options={hospitals} value={selectedHospitals}
                onChange={(_, v) => setSelectedHospitals(v)}
                getOptionLabel={(o) => o.hospitalName}
                isOptionEqualToValue={(a, b) => a.hospitalId === b.hospitalId}
                renderInput={(params) => <TextField {...params} placeholder="Choose hospitals" />}
              />
            )}
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
            label="Stop showing after" type="datetime-local" value={expiresAt}
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
