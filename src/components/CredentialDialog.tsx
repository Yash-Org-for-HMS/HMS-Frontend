import { ACCENTS } from "../styles/accents";
import { useState } from "react";
import { Box, Button, Dialog, DialogContent, IconButton, Tooltip, Typography } from "@mui/material";
import { CheckCircleRounded, ContentCopyRounded, InfoOutlined } from "@mui/icons-material";

interface CredentialDialogProps {
  open: boolean;
  onClose: () => void;
  /** The one-time password to display. */
  password: string;
  /** Login email/username — omit for password-only resets. */
  email?: string;
  /** Recipient name, shown in the "share with …" line. */
  name?: string;
  /** Heading (default: "Account Created"). */
  title?: string;
  /** Extra note shown in the info banner. */
  note?: string;
}

const GREEN = "#10b981";
const INDIGO = ACCENTS.admin;

/**
 * One-time credentials dialog shown after creating a user/hospital or resetting
 * a password. Replaces the three near-identical hand-rolled versions (staff
 * user form, RBAC user form, lead→hospital conversion) with a single copyable,
 * consistent surface.
 */
export default function CredentialDialog({
  open, onClose, password, email, name, title = "Account Created", note,
}: CredentialDialogProps) {
  const [copied, setCopied] = useState<"email" | "password" | "all" | null>(null);

  const copy = async (text: string, which: "email" | "password" | "all") => {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
  };

  const allText = email
    ? `Login: ${email}\nPassword: ${password}\n\nNote: You will be asked to change your password on first login.`
    : password;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, backgroundImage: "none", overflow: "hidden" } }}
    >
      <Box sx={{ height: 4, bgcolor: GREEN }} />
      <DialogContent sx={{ p: 4 }}>
        {/* Success header */}
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Box
            sx={{
              width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 2,
              display: "flex", alignItems: "center", justifyContent: "center",
              bgcolor: `${GREEN}1a`, border: `2px solid ${GREEN}66`,
            }}
          >
            <CheckCircleRounded sx={{ color: GREEN, fontSize: 32 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>{title}</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {name
              ? <>Share these login credentials with <Box component="span" sx={{ color: INDIGO, fontWeight: 600 }}>{name}</Box></>
              : "Share these login credentials securely."}
          </Typography>
        </Box>

        {/* Credentials */}
        <Box sx={{ p: 3, borderRadius: 2, bgcolor: `${INDIGO}0d`, border: `1px solid ${INDIGO}33`, mb: 3 }}>
          <Typography variant="caption" sx={{ color: INDIGO, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", mb: 2, display: "block" }}>
            Login Credentials
          </Typography>

          {email && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>Email / Username</Typography>
              <CredentialRow value={email} copied={copied === "email"} onCopy={() => copy(email, "email")} />
            </Box>
          )}

          <Box>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>Temporary Password</Typography>
            <CredentialRow value={password} mono copied={copied === "password"} onCopy={() => copy(password, "password")} />
          </Box>
        </Box>

        {/* Info banner */}
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", p: 2, borderRadius: 2, bgcolor: "action.hover", mb: 3 }}>
          <InfoOutlined sx={{ color: "text.secondary", fontSize: 18, mt: 0.1, flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.6 }}>
            {note || "They will be required to change this password on first login. Make sure to share these credentials securely."}
          </Typography>
        </Box>

        {/* Actions */}
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            fullWidth variant="outlined"
            startIcon={copied === "all" ? <CheckCircleRounded /> : <ContentCopyRounded />}
            onClick={() => copy(allText, "all")}
            sx={{ textTransform: "none", fontWeight: 600, color: copied === "all" ? GREEN : "text.secondary", borderColor: copied === "all" ? GREEN : "divider" }}
          >
            {copied === "all" ? "Copied!" : "Copy All"}
          </Button>
          <Button
            fullWidth variant="contained" onClick={onClose}
            sx={{ textTransform: "none", fontWeight: 600, bgcolor: INDIGO, "&:hover": { bgcolor: "#4f46e5" } }}
          >
            Done
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function CredentialRow({ value, mono, copied, onCopy }: { value: string; mono?: boolean; copied: boolean; onCopy: () => void }) {
  return (
    <Box
      sx={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        mt: 0.5, p: 1.5, borderRadius: 1.5,
        bgcolor: "background.paper", border: "1px solid", borderColor: "divider",
      }}
    >
      <Typography sx={{ fontFamily: "monospace", fontSize: "0.875rem", fontWeight: mono ? 700 : 400, letterSpacing: mono ? 1 : 0, wordBreak: "break-all" }}>
        {value}
      </Typography>
      <Tooltip title={copied ? "Copied!" : "Copy"}>
        <IconButton size="small" onClick={onCopy} aria-label="Copy to clipboard" sx={{ color: copied ? GREEN : "text.secondary", ml: 1 }}>
          {copied ? <CheckCircleRounded fontSize="small" /> : <ContentCopyRounded fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}
