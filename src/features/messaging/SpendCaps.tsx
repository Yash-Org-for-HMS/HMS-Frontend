import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Paper, Stack, Typography, TextField, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Alert, CircularProgress, LinearProgress,
} from "@mui/material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import SoftChip from "@/components/SoftChip";
import { SEMANTIC, NEUTRAL } from "@/styles/accents";
import { inrFromMicros } from "@/features/hospitalAuth/MessagingSettings";

/**
 * What each hospital may spend on messaging in a month.
 *
 * The platform pays the gateway and invoices the hospital afterwards, so without
 * this a single tenant can run up an unbounded bill on someone else's account
 * before anyone notices. Set here and nowhere else: a cap the capped party can
 * raise is not a cap.
 */

interface TenantRow {
  hospitalId: string;
  hospitalName: string;
  hasOwnCap: boolean;
  capMicros: number | null;
  spentMicros: number;
  remainingMicros: number | null;
  isWarning: boolean;
  isExceeded: boolean;
}

interface Overview {
  billingPeriod: string;
  platformDefault: { monthlyCapMicros: number | null; warnAtPercent: number; isSet: boolean };
  tenants: TenantRow[];
}

export default function SpendCaps() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [draftCap, setDraftCap] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [tenantCap, setTenantCap] = useState("");

  const { data, isLoading, error, refetch } = useQuery<Overview>({
    queryKey: ["messaging-quotas"],
    queryFn: async () => (await axiosInstance.get("/platform-messaging/quotas")).data.data,
  });

  const saveDefault = useMutation({
    mutationFn: (rupees: string) =>
      axiosInstance.put("/platform-messaging/quota", { monthlyCapRupees: rupees === "" ? null : Number(rupees) }),
    onSuccess: () => {
      toast.success("Default cap saved");
      setDraftCap(null);
      queryClient.invalidateQueries({ queryKey: ["messaging-quotas"] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not save the cap.")),
  });

  const saveTenant = useMutation({
    mutationFn: ({ hospitalId, rupees }: { hospitalId: string; rupees: string }) =>
      axiosInstance.put(`/platform-messaging/quota/${hospitalId}`, {
        monthlyCapRupees: rupees === "" ? null : Number(rupees),
      }),
    onSuccess: () => {
      toast.success("Cap saved");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["messaging-quotas"] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not save the cap.")),
  });

  if (isLoading) return <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box>;
  if (error) {
    return <Alert severity="error" action={<Button onClick={() => refetch()}>Retry</Button>}>
      {getApiErrorMessage(error, "Could not load spend caps.")}
    </Alert>;
  }
  if (!data) return null;

  const defaultRupees =
    data.platformDefault.monthlyCapMicros === null ? "" : String(data.platformDefault.monthlyCapMicros / 1e6);
  const shown = draftCap ?? defaultRupees;
  const uncapped = !data.platformDefault.isSet || data.platformDefault.monthlyCapMicros === null;

  return (
    <Stack spacing={3}>
      {uncapped && (
        <Alert severity="warning">
          No default cap is set, so a hospital can send without limit on your gateway — and the bill
          reaches you before the invoice reaches them.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Monthly cap</Typography>
        <Typography variant="body2" sx={{ color: NEUTRAL.muted, mb: 2 }}>
          Applied to every hospital that does not have a cap of its own. A message that would take a
          hospital over is not sent — it is recorded with the reason, and never billed.
        </Typography>

        <Stack direction="row" spacing={1} alignItems="flex-start">
          <TextField
            size="small" label="Rupees per month" value={shown}
            onChange={(e) => setDraftCap(e.target.value)}
            placeholder="No limit" sx={{ maxWidth: 220 }}
            helperText="Leave blank for no limit."
          />
          <Button variant="contained" disabled={saveDefault.isPending}
            onClick={() => saveDefault.mutate(shown)} sx={{ mt: 0.25 }}>
            {saveDefault.isPending ? "Saving…" : "Save"}
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
        <Box sx={{ p: 2.5, pb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>This month, by hospital</Typography>
          <Typography variant="body2" sx={{ color: NEUTRAL.muted }}>
            {data.billingPeriod} · the ones about to stop sending are listed first
          </Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {["Hospital", "Used", "Cap", "", "Set a cap"].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.tenants.map((t) => {
                const pct = t.capMicros ? Math.min((t.spentMicros / t.capMicros) * 100, 100) : 0;
                return (
                  <TableRow key={t.hospitalId} hover>
                    <TableCell>{t.hospitalName}</TableCell>
                    <TableCell>{inrFromMicros(t.spentMicros)}</TableCell>
                    <TableCell>
                      {t.capMicros === null ? (
                        <Typography variant="body2" sx={{ color: NEUTRAL.muted }}>No limit</Typography>
                      ) : (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2">{inrFromMicros(t.capMicros)}</Typography>
                          {t.hasOwnCap && <SoftChip label="Own" bg="rgba(59,130,246,0.12)" color={SEMANTIC.info} />}
                        </Stack>
                      )}
                    </TableCell>
                    <TableCell sx={{ width: 160 }}>
                      {t.capMicros !== null && (
                        <Stack spacing={0.5}>
                          <LinearProgress
                            variant="determinate" value={pct}
                            sx={{
                              height: 6, borderRadius: 3,
                              "& .MuiLinearProgress-bar": {
                                bgcolor: t.isExceeded ? SEMANTIC.danger : t.isWarning ? SEMANTIC.warning : SEMANTIC.success,
                              },
                            }}
                          />
                          {t.isExceeded && <SoftChip label="Stopped" bg="rgba(239,68,68,0.14)" color={SEMANTIC.danger} />}
                          {t.isWarning && <SoftChip label="Nearly out" bg="rgba(245,158,11,0.14)" color={SEMANTIC.warning} />}
                        </Stack>
                      )}
                    </TableCell>
                    <TableCell>
                      {editing === t.hospitalId ? (
                        <Stack direction="row" spacing={0.5}>
                          <TextField size="small" value={tenantCap} onChange={(e) => setTenantCap(e.target.value)}
                            placeholder="Blank = no limit" sx={{ width: 130 }} />
                          <Button size="small" disabled={saveTenant.isPending}
                            onClick={() => saveTenant.mutate({ hospitalId: t.hospitalId, rupees: tenantCap })}>
                            Save
                          </Button>
                          <Button size="small" color="inherit" onClick={() => setEditing(null)}>Cancel</Button>
                        </Stack>
                      ) : (
                        <Button size="small" onClick={() => {
                          setEditing(t.hospitalId);
                          setTenantCap(t.hasOwnCap && t.capMicros !== null ? String(t.capMicros / 1e6) : "");
                        }}>
                          {t.hasOwnCap ? "Change" : "Override"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Stack>
  );
}
