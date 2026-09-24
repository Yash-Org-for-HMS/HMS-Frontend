import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box, Paper, Stack, Typography, TextField, Button, Alert, AlertTitle, Switch,
  FormControlLabel, CircularProgress, ToggleButton, ToggleButtonGroup, IconButton, Tooltip,
} from "@mui/material";
import { ContentCopyRounded, CheckRounded } from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import { axiosInstance } from "@/api/axios";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/providers/ToastContext";
import SoftChip from "@/components/SoftChip";
import { SEMANTIC, NEUTRAL, alpha } from "@/styles/accents";

/**
 * The platform's Razorpay credentials.
 *
 * Scope is narrow on purpose: this gateway exists so HOSPITALS can pay US for
 * their subscription. Patients never pay through it — patient billing is
 * recorded at the desk, deliberately — so there is one merchant account and no
 * per-tenant credentials anywhere on this screen.
 *
 * Secrets are write-only. Once saved they are sealed and cannot be read back,
 * not even masked, so the two secret fields always render empty and an empty
 * field means "leave what is stored" rather than "clear it".
 */

interface Status {
  configured: boolean;
  isActive: boolean;
  mode: "TEST" | "LIVE";
  keyId: string | null;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  verifiedAt: string | null;
  updatedAt: string | null;
  webhookUrl: string;
  blockers: string[];
}

function CopyField({ label, value, help }: { label: string; value: string; help?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Box>
      <Typography variant="caption" sx={{ color: NEUTRAL.muted, fontWeight: 700, display: "block", mb: 0.5 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          fullWidth size="small" value={value}
          InputProps={{ readOnly: true, sx: { fontFamily: "monospace", fontSize: "0.875rem" } }}
        />
        <Tooltip title={copied ? "Copied" : "Copy"}>
          <IconButton
            size="small"
            onClick={() => {
              navigator.clipboard?.writeText(value);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <CheckRounded fontSize="small" sx={{ color: SEMANTIC.success }} /> : <ContentCopyRounded fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Stack>
      {help && <Typography variant="caption" sx={{ color: NEUTRAL.muted, mt: 0.5, display: "block" }}>{help}</Typography>}
    </Box>
  );
}

export default function PaymentGatewaySettings() {
  const toast = useToast();
  const qc = useQueryClient();

  const [mode, setMode] = useState<"TEST" | "LIVE" | null>(null);
  const [keyId, setKeyId] = useState<string | null>(null);
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  // Shown once, immediately after minting. Never retrievable afterwards.
  const [freshSecret, setFreshSecret] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<Status>({
    queryKey: ["payment-gateway"],
    queryFn: async () => (await axiosInstance.get("/payment-gateway")).data.data,
  });

  const done = (msg: string) => {
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["payment-gateway"] });
  };
  const failed = (e: unknown) => toast.error(getApiErrorMessage(e));

  const save = useMutation({
    mutationFn: async () =>
      (await axiosInstance.put("/payment-gateway", {
        mode: mode ?? data?.mode,
        keyId: keyId ?? data?.keyId ?? "",
        keySecret,
        webhookSecret,
      })).data,
    onSuccess: (res) => {
      setKeySecret("");
      setWebhookSecret("");
      done(res.message ?? "Saved.");
    },
    onError: failed,
  });

  const mint = useMutation({
    mutationFn: async () => (await axiosInstance.post("/payment-gateway/webhook-secret")).data,
    onSuccess: (res) => {
      setFreshSecret(res.data.webhookSecret);
      done("Webhook secret generated.");
    },
    onError: failed,
  });

  const verify = useMutation({
    mutationFn: async () => (await axiosInstance.post("/payment-gateway/verify")).data,
    onSuccess: (res) => done(res.message ?? "Verified."),
    onError: failed,
  });

  const toggle = useMutation({
    mutationFn: async (isActive: boolean) =>
      (await axiosInstance.post("/payment-gateway/active", { isActive })).data,
    onSuccess: (res) => done(res.message ?? "Updated."),
    onError: failed,
  });

  if (isLoading) {
    return (
      <PageContainer>
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      </PageContainer>
    );
  }
  if (error || !data) {
    return (
      <PageContainer>
        <Alert severity="error">{getApiErrorMessage(error)}</Alert>
      </PageContainer>
    );
  }

  const shownMode = mode ?? data.mode;
  const shownKeyId = keyId ?? data.keyId ?? "";
  const canActivate = data.configured && data.hasWebhookSecret && Boolean(data.verifiedAt);

  return (
    <PageContainer>
      <PageHeader
        title="Payment Gateway"
        subtitle="How hospitals pay you for their subscription"
      />

      {/* State first — an operator opening this page is asking one question:
          can hospitals pay right now? */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <SoftChip
            label={data.isActive ? "Collecting payments" : "Not collecting"}
            color={data.isActive ? SEMANTIC.success : NEUTRAL.muted}
            bg={alpha(data.isActive ? SEMANTIC.success : NEUTRAL.muted, 0.12)}
          />
          <SoftChip
            label={shownMode === "LIVE" ? "LIVE — real money" : "TEST mode"}
            color={shownMode === "LIVE" ? SEMANTIC.warning : NEUTRAL.muted}
            bg={alpha(shownMode === "LIVE" ? SEMANTIC.warning : NEUTRAL.muted, 0.12)}
          />
          {data.verifiedAt && (
            <Typography variant="caption" sx={{ color: NEUTRAL.muted }}>
              Credentials verified {new Date(data.verifiedAt).toLocaleString()}
            </Typography>
          )}
        </Stack>

        {data.blockers.length > 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <AlertTitle>Before hospitals can pay online</AlertTitle>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {data.blockers.map((b) => <li key={b}>{b}</li>)}
            </Box>
          </Alert>
        )}

        <FormControlLabel
          sx={{ mt: 2 }}
          control={
            <Switch
              checked={data.isActive}
              disabled={!canActivate || toggle.isPending}
              onChange={(e) => toggle.mutate(e.target.checked)}
            />
          }
          label={
            canActivate
              ? "Let hospitals pay their subscription online"
              : "Add and verify the credentials first"
          }
        />
      </Paper>

      {/* Credentials */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>Razorpay credentials</Typography>
        <Typography variant="body2" sx={{ color: NEUTRAL.muted, mb: 3 }}>
          From the Razorpay dashboard, under Settings → API Keys. Test keys work without KYC.
        </Typography>

        <Stack spacing={3}>
          <Box>
            <Typography variant="caption" sx={{ color: NEUTRAL.muted, fontWeight: 700, display: "block", mb: 1 }}>
              Mode
            </Typography>
            <ToggleButtonGroup
              exclusive size="small" value={shownMode}
              onChange={(_e, v) => v && setMode(v)}
            >
              <ToggleButton value="TEST">Test</ToggleButton>
              <ToggleButton value="LIVE">Live</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" sx={{ color: NEUTRAL.muted, ml: 2 }}>
              The key itself decides which one is really used — this must match it.
            </Typography>
          </Box>

          <TextField
            fullWidth label="Key ID" value={shownKeyId}
            onChange={(e) => setKeyId(e.target.value)}
            placeholder="rzp_test_xxxxxxxxxxxx"
            helperText="Public — it is sent to the browser. Safe to read back."
          />

          <TextField
            fullWidth type="password" label="Key Secret" value={keySecret}
            onChange={(e) => setKeySecret(e.target.value)}
            placeholder={data.hasKeySecret ? "•••••••• stored — leave blank to keep it" : "Paste the secret"}
            helperText={
              data.hasKeySecret
                ? "Stored and encrypted. It cannot be shown again; leave blank unless you are replacing it."
                : "Shown only once by Razorpay when the key pair is generated."
            }
          />

          <Box>
            <TextField
              fullWidth type="password" label="Webhook Secret" value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={data.hasWebhookSecret ? "•••••••• stored — leave blank to keep it" : "Choose one, or generate"}
              helperText="You invent this, then paste the same value into Razorpay. It is what proves a payment callback really came from them."
            />
            <Button size="small" sx={{ mt: 1 }} onClick={() => mint.mutate()} disabled={mint.isPending}>
              Generate one for me
            </Button>
          </Box>

          {freshSecret && (
            <Alert severity="warning">
              <AlertTitle>Copy this into Razorpay now</AlertTitle>
              <Typography variant="body2" sx={{ mb: 1 }}>
                It is already saved here, encrypted, and cannot be shown again.
              </Typography>
              <CopyField label="Webhook secret" value={freshSecret} />
            </Alert>
          )}

          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>
              Save credentials
            </Button>
            <Button
              variant="outlined"
              onClick={() => verify.mutate()}
              disabled={verify.isPending || !data.configured}
            >
              Verify against Razorpay
            </Button>
          </Stack>
          <Typography variant="caption" sx={{ color: NEUTRAL.muted }}>
            Saving always switches collection off and clears verification — a changed key is an
            unproven key, and an unproven key would fail at the bank rather than here.
          </Typography>
        </Stack>
      </Paper>

      {/* Webhook */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>Webhook</Typography>
        <Typography variant="body2" sx={{ color: NEUTRAL.muted, mb: 3 }}>
          In Razorpay: Settings → Webhooks → Add. Paste this URL, paste the webhook secret above,
          and subscribe to <strong>payment_link.paid</strong>. Without it a hospital can pay and the
          invoice would stay unpaid here.
        </Typography>
        <CopyField
          label="Webhook URL"
          value={data.webhookUrl}
          help={
            data.webhookUrl.startsWith("http")
              ? "Razorpay must be able to reach this from the internet."
              : "Incomplete — set PUBLIC_API_URL on the server so this resolves to a full address."
          }
        />
      </Paper>
    </PageContainer>
  );
}
