import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Paper, Stack, Typography, TextField, Button, Switch, FormControlLabel,
  Divider, Alert, MenuItem, CircularProgress,
} from "@mui/material";
import { CheckCircleRounded, SendRounded, WarningAmberRounded } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import SoftChip from "@/components/SoftChip";
import { SEMANTIC, NEUTRAL } from "@/styles/accents";

/**
 * Where a hospital connects its SMS gateway and writes the text of each message.
 *
 * Both halves are needed before anything can be delivered, and under TRAI DLT
 * both depend on registrations this screen cannot perform - so it is written to
 * show plainly which piece is still missing rather than to imply that filling
 * the form is sufficient.
 */

interface TemplateView {
  templateId: string;
  isOwnTemplate: boolean;
  bodyTemplate: string;
  dltTemplateId: string | null;
  isActive: boolean;
  segments: number;
}

interface Kind {
  key: string;
  label: string;
  description: string;
  variables: string[];
  sample: string;
  template: TemplateView | null;
}

interface Status {
  credentialStorageAvailable: boolean;
  settings: { smsEnabled: boolean; emailEnabled: boolean; whatsappEnabled: boolean };
  sms:
    | { configured: false }
    | {
        configured: true; isOwnConfig: boolean; provider: string; senderId: string | null;
        dltEntityId: string | null; isActive: boolean; verifiedAt: string | null;
      };
  kinds: Kind[];
}

/**
 * A rough segment count, for live feedback as someone types.
 *
 * Deliberately a simplified copy of the server's counter rather than a call per
 * keystroke. The server counts authoritatively when the message is sent, so the
 * worst case here is a preview that is slightly off - never a wrong charge. What
 * it must get right is the expensive surprise: one character outside GSM-7 drops
 * the segment size from 160 to 70.
 */
const GSM = new Set(
  "@£$¥èéùìòÇ\nØø\rÅå_ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€",
);
function previewSegments(text: string): { segments: number; unicode: boolean; offender: string | null } {
  let offender: string | null = null;
  for (const ch of text) if (!GSM.has(ch)) { offender = ch; break; }
  const unicode = offender !== null;
  const len = unicode ? text.length : text.length;
  const single = unicode ? 70 : 160;
  const concat = unicode ? 67 : 153;
  const segments = len === 0 ? 0 : len <= single ? 1 : Math.ceil(len / concat);
  return { segments, unicode, offender };
}

export default function MessagingSettings() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<Status>({
    queryKey: ["messaging-status"],
    queryFn: async () => (await axiosInstance.get("/hospital/messaging")).data.data,
  });

  if (isLoading) return <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box>;
  if (error) {
    return <Alert severity="error" action={<Button onClick={() => refetch()}>Retry</Button>}>
      {getApiErrorMessage(error, "Could not load messaging settings.")}
    </Alert>;
  }
  if (!data) return null;

  const live = data.sms.configured && data.sms.isActive && data.settings.smsEnabled;

  return (
    <Stack spacing={3}>
      {!data.credentialStorageAvailable && (
        <Alert severity="warning">
          This server cannot store gateway credentials yet — <code>CREDENTIALS_ENCRYPTION_KEY</code> is not set.
          Ask whoever runs the server to set one; until then the form below cannot be saved.
        </Alert>
      )}

      <Alert
        severity={live ? "success" : "info"}
        icon={live ? <CheckCircleRounded /> : <WarningAmberRounded />}
      >
        {live
          ? "SMS is live. Messages sent from reception will reach patients."
          : "SMS is not live yet. Messages are recorded but not delivered — the screens say so when that happens."}
      </Alert>

      <GatewayCard status={data} onSaved={() => queryClient.invalidateQueries({ queryKey: ["messaging-status"] })} />

      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Message text</Typography>
        <Typography variant="body2" sx={{ color: NEUTRAL.muted, mb: 2 }}>
          Under TRAI rules the delivered message must match a template you have registered on the DLT
          portal, word for word. Paste the approved text here along with the template ID the portal
          gave you.
        </Typography>
        <Stack spacing={2}>
          {data.kinds.map((k) => (
            <TemplateCard
              key={k.key}
              kind={k}
              onSaved={() => queryClient.invalidateQueries({ queryKey: ["messaging-status"] })}
            />
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}

function GatewayCard({ status, onSaved }: { status: Status; onSaved: () => void }) {
  const toast = useToast();
  const sms = status.sms;
  const configured = sms.configured;

  const [provider, setProvider] = useState(configured ? sms.provider : "MSG91");
  const [senderId, setSenderId] = useState(configured ? sms.senderId ?? "" : "");
  const [dltEntityId, setDltEntityId] = useState(configured ? sms.dltEntityId ?? "" : "");
  const [authKey, setAuthKey] = useState("");
  const [isActive, setIsActive] = useState(configured ? sms.isActive : true);
  const [testPhone, setTestPhone] = useState("");

  const save = useMutation({
    mutationFn: () =>
      axiosInstance.put("/hospital/messaging/config", {
        channel: "SMS", provider, senderId, dltEntityId,
        // Blank means "keep the key you already have" — it is never sent back to
        // the browser, so there is nothing to round-trip.
        authKey: authKey || undefined,
        isActive,
      }),
    onSuccess: () => { setAuthKey(""); toast.success("Gateway saved"); onSaved(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not save the gateway.")),
  });

  const test = useMutation({
    mutationFn: () => axiosInstance.post("/hospital/messaging/test", { channel: "SMS", phone: testPhone }),
    onSuccess: (r) => { toast.success(`Test sent to ${r.data.data.sentTo}`); onSaved(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "The test message could not be sent.")),
  });

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>SMS gateway</Typography>
        {configured && sms.verifiedAt ? (
          <SoftChip label="Verified" bg="rgba(16,185,129,0.12)" color={SEMANTIC.success} />
        ) : configured ? (
          <SoftChip label="Not yet tested" bg="rgba(245,158,11,0.14)" color={SEMANTIC.warning} />
        ) : null}
        {configured && !sms.isOwnConfig && (
          <SoftChip label="Using the platform default" bg="rgba(59,130,246,0.12)" color={SEMANTIC.info} />
        )}
      </Stack>

      <Stack spacing={2}>
        <TextField select label="Provider" value={provider} onChange={(e) => setProvider(e.target.value)} size="small">
          <MenuItem value="MSG91">MSG91</MenuItem>
        </TextField>

        <TextField
          label="Sender ID (DLT header)" value={senderId} onChange={(e) => setSenderId(e.target.value)}
          size="small" inputProps={{ maxLength: 11 }}
          helperText="The 6-character header registered on the DLT portal, e.g. RADHEH. This is the name the patient sees."
        />

        <TextField
          label="DLT entity ID" value={dltEntityId} onChange={(e) => setDltEntityId(e.target.value)}
          size="small"
          helperText="Your Principal Entity ID from the DLT portal."
        />

        <TextField
          label={configured ? "Auth key (leave blank to keep the current one)" : "Auth key"}
          value={authKey} onChange={(e) => setAuthKey(e.target.value)}
          size="small" type="password" autoComplete="new-password"
          helperText="Stored encrypted and never shown again. Changing it means the gateway has to be tested afresh."
        />

        <FormControlLabel
          control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
          label="Use this gateway"
        />

        <Box>
          <Button variant="contained" disabled={save.isPending || !status.credentialStorageAvailable}
            onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save gateway"}
          </Button>
        </Box>

        <Divider />

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Send a test message</Typography>
          <Typography variant="body2" sx={{ color: NEUTRAL.muted, mb: 1.5 }}>
            The only way to know the setup works. DLT will accept a header and a template that look
            correct and still refuse the send.
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="Mobile number" value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)} sx={{ maxWidth: 240 }} />
            <Button variant="outlined" startIcon={<SendRounded />}
              disabled={!testPhone || test.isPending || !configured}
              onClick={() => test.mutate()}>
              {test.isPending ? "Sending…" : "Send test"}
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

function TemplateCard({ kind, onSaved }: { kind: Kind; onSaved: () => void }) {
  const toast = useToast();
  const [body, setBody] = useState(kind.template?.bodyTemplate ?? kind.sample);
  const [dltTemplateId, setDltTemplateId] = useState(kind.template?.dltTemplateId ?? "");

  const preview = useMemo(() => previewSegments(body), [body]);

  const save = useMutation({
    mutationFn: () =>
      axiosInstance.put("/hospital/messaging/templates", {
        channel: "SMS", templateKey: kind.key, bodyTemplate: body, dltTemplateId, isActive: true,
      }),
    onSuccess: () => { toast.success(`${kind.label} saved`); onSaved(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not save the template.")),
  });

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <Typography sx={{ fontWeight: 700 }}>{kind.label}</Typography>
        {kind.template ? (
          <SoftChip label="Saved" bg="rgba(16,185,129,0.12)" color={SEMANTIC.success} />
        ) : (
          <SoftChip label="Not set up" bg="rgba(100,116,139,0.12)" color={NEUTRAL.muted} />
        )}
      </Stack>
      <Typography variant="body2" sx={{ color: NEUTRAL.muted, mb: 2 }}>{kind.description}</Typography>

      <Stack spacing={1.5}>
        <TextField
          label="Message text" value={body} onChange={(e) => setBody(e.target.value)}
          multiline minRows={3} fullWidth size="small"
        />

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="caption" sx={{ color: NEUTRAL.muted }}>
            {body.length} characters · {preview.segments} segment{preview.segments === 1 ? "" : "s"}
          </Typography>
          {preview.unicode && (
            <SoftChip
              label={`"${preview.offender}" forces Unicode — 70 characters per segment instead of 160`}
              bg="rgba(245,158,11,0.14)" color={SEMANTIC.warning}
            />
          )}
        </Stack>

        <Typography variant="caption" sx={{ color: NEUTRAL.muted }}>
          Available: {kind.variables.map((v) => `{{${v}}}`).join("  ")}
        </Typography>

        <TextField
          label="DLT template ID" value={dltTemplateId} onChange={(e) => setDltTemplateId(e.target.value)}
          size="small" sx={{ maxWidth: 320 }}
          helperText="From the DLT portal, once this exact text is approved."
        />

        <Box>
          <Button variant="outlined" size="small" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}
