import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Paper, Stack, Typography, TextField, Button, Switch, FormControlLabel,
  Divider, Alert, MenuItem, CircularProgress,
} from "@mui/material";
import { CheckCircleRounded, SendRounded, WarningAmberRounded, LockOutlined } from "@mui/icons-material";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import SoftChip from "@/components/SoftChip";
import { SEMANTIC, NEUTRAL } from "@/styles/accents";

/**
 * Messaging setup, for one hospital or for the platform.
 *
 * The same screen serves both because they are the same decisions - a gateway,
 * a sender ID, and the approved text of each message. Only the scope differs,
 * and with it who is allowed to change the wording.
 *
 * Under TRAI DLT a template is approved against whoever owns the header. So a
 * hospital sending through the platform's gateway sees the text but cannot edit
 * it: an edit would save happily here and then be refused by the gateway on
 * every single send, silently, long after whoever typed it had moved on.
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
  scope: "PLATFORM" | "TENANT";
  credentialStorageAvailable: boolean;
  canEditTemplates: boolean;
  settings: { smsEnabled: boolean; emailEnabled: boolean; whatsappEnabled: boolean } | null;
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
 * Deliberately a simplified copy of the server's counter rather than a request
 * per keystroke. The server counts authoritatively when the message is sent, so
 * the worst case here is a preview that is slightly off - never a wrong charge.
 * What it must get right is the expensive surprise: one character outside GSM-7
 * drops the segment size from 160 to 70.
 */
const GSM = new Set(
  "@£$¥èéùìòÇ\nØø\rÅå_ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€",
);
function previewSegments(text: string): { segments: number; unicode: boolean; offender: string | null } {
  let offender: string | null = null;
  for (const ch of text) if (!GSM.has(ch)) { offender = ch; break; }
  const unicode = offender !== null;
  const single = unicode ? 70 : 160;
  const concat = unicode ? 67 : 153;
  const segments = text.length === 0 ? 0 : text.length <= single ? 1 : Math.ceil(text.length / concat);
  return { segments, unicode, offender };
}

export default function MessagingSettings({ base = "/hospital/messaging" }: { base?: string }) {
  const queryClient = useQueryClient();
  const key = ["messaging-status", base];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const { data, isLoading, error, refetch } = useQuery<Status>({
    queryKey: key,
    queryFn: async () => (await axiosInstance.get(base)).data.data,
  });

  if (isLoading) return <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={28} /></Box>;
  if (error) {
    return <Alert severity="error" action={<Button onClick={() => refetch()}>Retry</Button>}>
      {getApiErrorMessage(error, "Could not load messaging settings.")}
    </Alert>;
  }
  if (!data) return null;

  const isPlatform = data.scope === "PLATFORM";
  // A tenant also needs SMS switched on in its own settings; the platform has no
  // such switch, since it is the supplier rather than a sender.
  const live = data.sms.configured && data.sms.isActive && (isPlatform || data.settings?.smsEnabled === true);

  return (
    <Stack spacing={3}>
      {!data.credentialStorageAvailable && (
        <Alert severity="warning">
          This server cannot store gateway credentials yet — <code>CREDENTIALS_ENCRYPTION_KEY</code> is not set.
          Ask whoever runs the server to set one; until then the form below cannot be saved.
        </Alert>
      )}

      <Alert severity={live ? "success" : "info"} icon={live ? <CheckCircleRounded /> : <WarningAmberRounded />}>
        {isPlatform
          ? live
            ? "This gateway is live. Every hospital that has not connected its own sends through it."
            : "No platform gateway yet. Until one is set up, hospitals can only send if they connect their own."
          : live
            ? "SMS is live. Messages sent from reception will reach patients."
            : "SMS is not live yet. Messages are recorded but not delivered — the screens say so when that happens."}
      </Alert>

      <GatewayCard base={base} status={data} onSaved={invalidate} />

      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Message text</Typography>
        <Typography variant="body2" sx={{ color: NEUTRAL.muted, mb: 2 }}>
          {data.canEditTemplates
            ? "Under TRAI rules the delivered message must match a template you have registered on the DLT portal, word for word. Paste the approved text here along with the template ID the portal gave you."
            : "These messages go out on the platform's gateway, so their wording is registered with the regulator by the platform. You can see exactly what your patients receive, but it is not editable here."}
        </Typography>

        {!data.canEditTemplates && (
          <Alert severity="info" icon={<LockOutlined />} sx={{ mb: 2 }}>
            To write your own wording you need your own SMS gateway and DLT registration. Connect one
            above and these become editable.
          </Alert>
        )}

        <Stack spacing={2}>
          {data.kinds.map((k) => (
            <TemplateCard key={k.key} base={base} kind={k} readOnly={!data.canEditTemplates} onSaved={invalidate} />
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}

function GatewayCard({ base, status, onSaved }: { base: string; status: Status; onSaved: () => void }) {
  const toast = useToast();
  const sms = status.sms;
  const configured = sms.configured;
  const isPlatform = status.scope === "PLATFORM";

  // Only prefill from a gateway this scope actually OWNS. A tenant looking at
  // the platform gateway is not editing it — saving this form creates their own
  // — so putting someone else's registered sender ID in an editable field
  // invites them to adopt a header they have no right to send under.
  const own = configured && sms.isOwnConfig;

  const [provider, setProvider] = useState(own ? sms.provider : "MSG91");
  const [senderId, setSenderId] = useState(own ? sms.senderId ?? "" : "");
  const [dltEntityId, setDltEntityId] = useState(own ? sms.dltEntityId ?? "" : "");
  const [authKey, setAuthKey] = useState("");
  const [isActive, setIsActive] = useState(own ? sms.isActive : true);
  const [testPhone, setTestPhone] = useState("");

  const save = useMutation({
    mutationFn: () =>
      axiosInstance.put(`${base}/config`, {
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
    mutationFn: () => axiosInstance.post(`${base}/test`, { channel: "SMS", phone: testPhone }),
    onSuccess: (r) => { toast.success(`Test sent to ${r.data.data.sentTo}`); onSaved(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "The test message could not be sent.")),
  });

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }} flexWrap="wrap" useFlexGap>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {isPlatform ? "Platform SMS gateway" : "SMS gateway"}
        </Typography>
        {configured && sms.verifiedAt ? (
          <SoftChip label="Verified" bg="rgba(16,185,129,0.12)" color={SEMANTIC.success} />
        ) : configured ? (
          <SoftChip label="Not yet tested" bg="rgba(245,158,11,0.14)" color={SEMANTIC.warning} />
        ) : null}
        {configured && !isPlatform && !sms.isOwnConfig && (
          <SoftChip label="Using the platform gateway" bg="rgba(59,130,246,0.12)" color={SEMANTIC.info} />
        )}
      </Stack>

      <Typography variant="body2" sx={{ color: NEUTRAL.muted, mb: 2 }}>
        {isPlatform
          ? "Used by every hospital that has not connected a gateway of its own. Patients see this sender ID, so it should be recognisable."
          : "Connect your own gateway only if you have your own DLT registration. Otherwise the platform's is used."}
      </Typography>

      <Stack spacing={2}>
        <TextField select label="Provider" value={provider} onChange={(e) => setProvider(e.target.value)} size="small">
          <MenuItem value="MSG91">MSG91</MenuItem>
        </TextField>

        <TextField
          label="Sender ID (DLT header)" value={senderId} onChange={(e) => setSenderId(e.target.value)}
          size="small" inputProps={{ maxLength: 11 }}
          helperText="The header registered on the DLT portal. This is the name that appears on the patient's phone."
        />

        <TextField
          label="DLT entity ID" value={dltEntityId} onChange={(e) => setDltEntityId(e.target.value)}
          size="small" helperText="The Principal Entity ID from the DLT portal."
        />

        <TextField
          label={own ? "Auth key (leave blank to keep the current one)" : "Auth key"}
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
            {save.isPending ? "Saving…" : own || isPlatform ? "Save gateway" : "Connect our own gateway"}
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

function TemplateCard({ base, kind, readOnly, onSaved }: {
  base: string; kind: Kind; readOnly: boolean; onSaved: () => void;
}) {
  const toast = useToast();
  const [body, setBody] = useState(kind.template?.bodyTemplate ?? kind.sample);
  const [dltTemplateId, setDltTemplateId] = useState(kind.template?.dltTemplateId ?? "");

  const preview = useMemo(() => previewSegments(body), [body]);

  const save = useMutation({
    mutationFn: () =>
      axiosInstance.put(`${base}/templates`, {
        channel: "SMS", templateKey: kind.key, bodyTemplate: body, dltTemplateId, isActive: true,
      }),
    onSuccess: () => { toast.success(`${kind.label} saved`); onSaved(); },
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not save the template.")),
  });

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }} flexWrap="wrap" useFlexGap>
        <Typography sx={{ fontWeight: 700 }}>{kind.label}</Typography>
        {kind.template ? (
          <SoftChip label="Saved" bg="rgba(16,185,129,0.12)" color={SEMANTIC.success} />
        ) : (
          <SoftChip label="Not set up" bg="rgba(100,116,139,0.12)" color={NEUTRAL.muted} />
        )}
        {readOnly && (
          <SoftChip label="Set by the platform" icon={<LockOutlined sx={{ fontSize: 14 }} />}
            bg="rgba(59,130,246,0.12)" color={SEMANTIC.info} />
        )}
      </Stack>
      <Typography variant="body2" sx={{ color: NEUTRAL.muted, mb: 2 }}>{kind.description}</Typography>

      <Stack spacing={1.5}>
        <TextField
          label="Message text" value={body} onChange={(e) => setBody(e.target.value)}
          multiline minRows={3} fullWidth size="small"
          disabled={readOnly}
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

        {!readOnly && (
          <>
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
          </>
        )}
      </Stack>
    </Paper>
  );
}
