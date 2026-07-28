import { useState } from "react";
import { keyframes } from "@emotion/react";
import { NEUTRAL } from "@/styles/accents";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  Box, Button, TextField, Typography, InputAdornment, IconButton, Link, Stack,
} from "@mui/material";
import {
  Visibility, VisibilityOff, LockOutlined, EmailOutlined, LocalHospitalRounded,
  KeyboardCapslockRounded, ShieldRounded, MonitorHeartRounded, GridViewRounded,
} from "@mui/icons-material";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { axiosInstance } from "@/api/axios";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "@/components/HeartbeatLoader";

// Same accent as the reception realm (src/styles/accents.ts) — this is the
// staff portal, so the login should read as the same product, not a one-off.
const ACCENT = "#0891b2";
const ACCENT_DARK = "#0e7490";
const ACCENT_LIGHT = "#06b6d4";
const TEXT = NEUTRAL.textPrimary;
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// ── Motion (all gated behind prefers-reduced-motion at the call site) ──────────
const kfReveal = keyframes`from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; }`;
const kfDriftA = keyframes`from { transform: translate(0,0) scale(1); } to { transform: translate(34px, 22px) scale(1.08); }`;
const kfDriftB = keyframes`from { transform: translate(0,0); } to { transform: translate(-28px,-20px); }`;
const kfSheen = keyframes`0% { transform: translateX(-60%) rotate(9deg); } 100% { transform: translateX(220%) rotate(9deg); }`;
const kfBlink = keyframes`0%,100% { opacity: 1; } 50% { opacity: 0.3; }`;

// Staggered entrance for a hero element — no-op under reduced motion (stays visible).
const reveal = (delay: number) => ({
  "@media (prefers-reduced-motion: no-preference)": {
    opacity: 0,
    animation: `${kfReveal} 0.6s ${delay}s cubic-bezier(0.22,1,0.36,1) both`,
  },
});

// Slim animated pulse line — the clinical signature, pure SVG/CSS (no wasm).
function PulseLine({ tone = "accent" as "accent" | "light", width = 180 }) {
  const d = "M0,16 L40,16 L48,16 L54,6 L60,26 L66,16 L96,16 L102,12 L108,16 L150,16 L158,16 L164,7 L170,25 L176,16 L200,16";
  const id = `pulseGrad-${tone}`;
  return (
    <Box component="svg" viewBox="0 0 200 32" aria-hidden sx={{
      width, height: width * 0.14, display: "block",
      "& path": { fill: "none", stroke: `url(#${id})`, strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round", strokeDasharray: 240, animation: "pulseDraw 3.5s linear infinite" },
      "@keyframes pulseDraw": { from: { strokeDashoffset: 240 }, to: { strokeDashoffset: 0 } },
      "@media (prefers-reduced-motion: reduce)": { "& path": { animation: "none", strokeDashoffset: 0 } },
    }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          {tone === "light" ? (
            <>
              <stop offset="0%" stopColor="#fff" stopOpacity={0.15} />
              <stop offset="50%" stopColor="#fff" />
              <stop offset="100%" stopColor="#fff" stopOpacity={0.15} />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.25} />
              <stop offset="50%" stopColor={ACCENT} />
              <stop offset="100%" stopColor={ACCENT_DARK} stopOpacity={0.25} />
            </>
          )}
        </linearGradient>
      </defs>
      <path d={d} />
    </Box>
  );
}

// A stylized glimpse of the actual product — the live reception queue — so the
// hero shows what the app does, not just claims it. Purely decorative.
function QueueGlimpse() {
  const rows = [
    { token: "A-05", name: "Rina Patel", state: "waiting" },
    { token: "A-06", name: "Sunil Kumar", state: "waiting" },
  ];
  return (
    <Box sx={{
      p: 2, borderRadius: 3, maxWidth: 320,
      background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.22)",
      backdropFilter: "blur(8px)", boxShadow: "0 20px 40px -24px rgba(0,0,0,0.5)",
    }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80", "@media (prefers-reduced-motion: no-preference)": { animation: `${kfBlink} 2s ease-in-out infinite` } }} />
        <Typography sx={{ fontSize: "0.72rem", letterSpacing: "0.5px", textTransform: "uppercase", opacity: 0.85, fontWeight: 700 }}>Reception · Live queue</Typography>
      </Box>

      {/* Now-serving row */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1, borderRadius: 2, background: "rgba(255,255,255,0.16)" }}>
        <Box sx={{ px: 1, py: 0.25, borderRadius: 1.5, background: "rgba(255,255,255,0.9)", color: ACCENT_DARK, fontWeight: 800, fontSize: "0.85rem" }}>A-04</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, lineHeight: 1.2 }}>Rohan Shah</Typography>
          <Typography sx={{ fontSize: "0.72rem", opacity: 0.8 }}>Dr. Mehta · Cardiology</Typography>
        </Box>
        <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, px: 0.75, py: 0.25, borderRadius: 1, background: "rgba(74,222,128,0.22)", color: "#dcfce7", whiteSpace: "nowrap" }}>Now serving</Typography>
      </Box>

      {rows.map((r) => (
        <Box key={r.token} sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1, py: 0.75, opacity: 0.72 }}>
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, width: 34 }}>{r.token}</Typography>
          <Typography sx={{ fontSize: "0.8rem", flex: 1 }}>{r.name}</Typography>
          <Typography sx={{ fontSize: "0.68rem", opacity: 0.8 }}>{r.state}</Typography>
        </Box>
      ))}
    </Box>
  );
}

const FEATURES = [
  { icon: MonitorHeartRounded, title: "Real-time by design", desc: "Queue, billing & MAR update live." },
  { icon: GridViewRounded, title: "One system, every department", desc: "Reception, clinical, lab, pharmacy, IPD." },
  { icon: ShieldRounded, title: "Secure & session-bound", desc: "Encrypted, tenant-isolated access." },
];

export default function HospitalLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [touched, setTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const { login } = useHospitalAuth();
  const navigate = useNavigate();

  const emailError = touched && email.length > 0 && !isValidEmail(email);
  const canSubmit = isValidEmail(email) && password.length > 0 && !isLoading;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isValidEmail(email) || !password) return;
    setIsLoading(true);
    try {
      const response = await axiosInstance.post("/hospital-auth/login", { email, password });
      const data = response.data.data;
      if (data.requiresPasswordChange) {
        sessionStorage.setItem("hospitalTempToken", data.tempToken);
        navigate("/hospital/change-password");
        return;
      }
      login(
        data.tokens.accessToken,
        data.tokens.refreshToken,
        data.user,
        data.hospital,
        data.branch,
        data.sessionId,
      );
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to login. Please check your credentials."));
    } finally {
      setIsLoading(false);
    }
  };

  const fieldSx = {
    "& .MuiInputLabel-root.Mui-focused": { color: ACCENT },
    "& .MuiOutlinedInput-root": {
      borderRadius: 2,
      "&:hover fieldset": { borderColor: ACCENT },
      "&.Mui-focused fieldset": { borderColor: ACCENT, boxShadow: `0 0 0 3px ${ACCENT}1f` },
    },
  };

  const glowBase = { position: "absolute", borderRadius: "50%" } as const;

  return (
    // Lock to the real viewport height (dvh handles mobile browser chrome) and
    // hide overflow so the page never scrolls; the form panel below scrolls
    // internally on very short screens, and the decorative hero simply clips.
    <Box sx={{ height: "100dvh", minHeight: "100dvh", display: "flex", overflow: "hidden" }}>
      {/* ── LEFT: brand / hero panel (hidden on small screens) ─────────────── */}
      <Box
        aria-hidden
        sx={{
          display: { xs: "none", md: "flex" },
          flexDirection: "column", justifyContent: "center", gap: 4,
          flex: "1 1 46%", position: "relative", overflow: "hidden",
          p: { md: 5, lg: 6 }, color: "#fff",
          background: `linear-gradient(150deg, ${ACCENT_LIGHT} 0%, ${ACCENT} 45%, ${ACCENT_DARK} 100%)`,
        }}
      >
        {/* ambient: slowly drifting glows */}
        <Box sx={{ ...glowBase, width: 560, height: 560, top: -220, left: -160, background: "radial-gradient(circle, rgba(255,255,255,0.22), transparent 70%)", filter: "blur(8px)", "@media (prefers-reduced-motion: no-preference)": { animation: `${kfDriftA} 22s ease-in-out infinite alternate` } }} />
        <Box sx={{ ...glowBase, width: 460, height: 460, bottom: -180, right: -120, background: "radial-gradient(circle, rgba(0,0,0,0.18), transparent 70%)", "@media (prefers-reduced-motion: no-preference)": { animation: `${kfDriftB} 26s ease-in-out infinite alternate` } }} />
        {/* ambient: faint sheen sweeping across */}
        <Box sx={{ position: "absolute", top: "-50%", left: 0, width: "45%", height: "200%", pointerEvents: "none", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)", "@media (prefers-reduced-motion: no-preference)": { animation: `${kfSheen} 14s ease-in-out infinite` } }} />
        {/* faint grid texture */}
        <Box sx={{ position: "absolute", inset: 0, opacity: 0.1, backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />

        {/* wordmark */}
        <Box sx={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 1.5, ...reveal(0.05) }}>
          <Box sx={{ width: 44, height: 44, borderRadius: "13px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.35)", backdropFilter: "blur(6px)" }}>
            <LocalHospitalRounded sx={{ color: "#fff", fontSize: 24 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: "1.25rem", letterSpacing: "-0.5px", lineHeight: 1 }}>HMS</Typography>
            <Typography sx={{ fontSize: "0.7rem", letterSpacing: "2px", opacity: 0.85, textTransform: "uppercase" }}>Staff Portal</Typography>
          </Box>
        </Box>

        {/* headline + glimpse + features */}
        <Box sx={{ position: "relative", zIndex: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: { md: "1.8rem", lg: "2.1rem" }, lineHeight: 1.15, letterSpacing: "-0.8px", maxWidth: 460, ...reveal(0.15) }}>
            Everything your hospital runs on, in one place.
          </Typography>
          <Box sx={reveal(0.25)}><PulseLine tone="light" width={170} /></Box>

          <Box sx={{ mt: 3, ...reveal(0.35) }}><QueueGlimpse /></Box>

          <Stack spacing={1.75} sx={{ mt: 3, maxWidth: 440 }}>
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <Box key={f.title} sx={{ display: "flex", gap: 1.5, alignItems: "center", ...reveal(0.45 + i * 0.08) }}>
                  <Box sx={{ width: 34, height: 34, flexShrink: 0, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}>
                    <Icon sx={{ fontSize: 18, color: "#fff" }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", lineHeight: 1.2 }}>{f.title}</Typography>
                    <Typography sx={{ fontSize: "0.8rem", opacity: 0.8, lineHeight: 1.35 }}>{f.desc}</Typography>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Box>

        {/* footer */}
        <Typography sx={{ position: "relative", zIndex: 1, fontSize: "0.78rem", opacity: 0.75, ...reveal(0.7) }}>
          © {new Date().getFullYear()} HMS SaaS · Encrypted, session-bound access
        </Typography>
      </Box>

      {/* ── RIGHT: form panel ─────────────────────────────────────────────── */}
      <Box
        sx={{
          flex: { xs: "1 1 100%", md: "1 1 54%" },
          display: "flex", alignItems: "center", justifyContent: "center",
          bgcolor: "#fff", p: { xs: 3, sm: 5 }, position: "relative",
          overflowX: "hidden", overflowY: "auto",
        }}
      >
        {/* faint accent glow so the white side isn't flat on mobile (where the hero is hidden) */}
        <Box aria-hidden sx={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", top: -180, right: -140, background: `radial-gradient(circle, ${ACCENT}14, transparent 70%)`, display: { xs: "block", md: "none" } }} />

        <Box sx={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 400, ...reveal(0.12) }}>
          {/* compact logo — shown only when the hero panel is hidden (mobile) */}
          <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1.25, mb: 3 }}>
            <Box sx={{ width: 42, height: 42, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`, boxShadow: `0 10px 20px -8px ${ACCENT}80` }}>
              <LocalHospitalRounded sx={{ color: "#fff", fontSize: 23 }} />
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: "1.15rem", letterSpacing: "-0.5px", color: TEXT }}>HMS</Typography>
          </Box>

          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: "-0.8px", color: TEXT }}>Welcome back</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.75, mb: 3.5 }}>
            Sign in to your hospital staff portal.
          </Typography>

          <form onSubmit={handleLogin} noValidate>
            <TextField
              fullWidth variant="outlined" label="Email" type="email" margin="dense"
              value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)}
              error={emailError} helperText={emailError ? "Enter a valid email address" : " "}
              disabled={isLoading} required sx={fieldSx} inputProps={{ autoComplete: "email" }}
              InputProps={{ startAdornment: (<InputAdornment position="start"><EmailOutlined sx={{ color: "text.secondary" }} /></InputAdornment>) }}
            />
            <TextField
              fullWidth variant="outlined" label="Password" type={showPassword ? "text" : "password"} margin="dense"
              value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyUp={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
              disabled={isLoading} required sx={fieldSx} inputProps={{ autoComplete: "current-password" }}
              helperText={capsOn ? "Caps Lock is on" : " "}
              FormHelperTextProps={{ sx: { color: capsOn ? "warning.main" : undefined } }}
              InputProps={{
                startAdornment: (<InputAdornment position="start"><LockOutlined sx={{ color: "text.secondary" }} /></InputAdornment>),
                endAdornment: (
                  <InputAdornment position="end">
                    {capsOn && <KeyboardCapslockRounded fontSize="small" sx={{ color: "warning.main", mr: 0.5 }} />}
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.25, mb: 2 }}>
              <Link
                component="button" type="button" underline="hover"
                onClick={() => toast.info("Please contact your hospital administrator to reset your password.")}
                sx={{ fontSize: "0.85rem", color: ACCENT, fontWeight: 600 }}
              >
                Forgot password?
              </Link>
            </Box>

            <Button
              fullWidth type="submit" disableElevation disabled={!canSubmit}
              sx={{
                py: 1.5, fontWeight: 700, fontSize: "1rem", textTransform: "none", borderRadius: 2, color: "#fff",
                background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_DARK})`,
                boxShadow: `0 12px 24px -10px ${ACCENT}99`,
                "&:hover": { background: `linear-gradient(90deg, ${ACCENT_DARK}, ${ACCENT_DARK})`, boxShadow: `0 14px 28px -10px ${ACCENT}b3` },
                "&.Mui-disabled": { background: "rgba(15,23,42,0.12)", color: "rgba(15,23,42,0.4)", boxShadow: "none" },
                transition: "all 0.2s ease-in-out",
              }}
            >
              {isLoading ? <HeartbeatLoader size={22} /> : "Sign In"}
            </Button>
          </form>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, mt: 3, color: "text.secondary" }}>
            <ShieldRounded sx={{ fontSize: 16 }} />
            <Typography variant="caption">Encrypted · session-bound access</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
