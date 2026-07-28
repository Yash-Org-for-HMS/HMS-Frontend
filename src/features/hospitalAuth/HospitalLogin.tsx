import { useState } from "react";
import { NEUTRAL } from "@/styles/accents";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  Box, Button, TextField, Typography, InputAdornment, IconButton, Link, Fade, Stack,
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

// Slim animated pulse line — the clinical signature, pure SVG/CSS (no wasm).
// `tone` switches the stroke for the light form side vs the dark gradient panel.
function PulseLine({ tone = "accent" as "accent" | "light", width = 180 }) {
  const d = "M0,16 L40,16 L48,16 L54,6 L60,26 L66,16 L96,16 L102,12 L108,16 L150,16 L158,16 L164,7 L170,25 L176,16 L200,16";
  const id = `pulseGrad-${tone}`;
  return (
    <Box component="svg" viewBox="0 0 200 32" aria-hidden sx={{
      width, height: width * 0.14, display: "block",
      "& path": { fill: "none", stroke: `url(#${id})`, strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round", strokeDasharray: 240, animation: "pulseDraw 3.5s linear infinite" },
      "@keyframes pulseDraw": { from: { strokeDashoffset: 240 }, to: { strokeDashoffset: 0 } },
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

const FEATURES = [
  { icon: MonitorHeartRounded, title: "Real-time by design", desc: "Queue, billing, dispensary & MAR update live across every panel." },
  { icon: GridViewRounded, title: "One system, every department", desc: "Reception, clinical, lab, pharmacy and IPD in a single workspace." },
  { icon: ShieldRounded, title: "Secure & session-bound", desc: "Encrypted access, tenant-isolated, with per-session revocation." },
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

  return (
    <Box sx={{ minHeight: "100vh", display: "flex" }}>
      {/* ── LEFT: brand / hero panel (hidden on small screens) ─────────────── */}
      <Box
        aria-hidden
        sx={{
          display: { xs: "none", md: "flex" },
          flexDirection: "column", justifyContent: "space-between",
          flex: "1 1 46%", position: "relative", overflow: "hidden",
          p: { md: 5, lg: 7 }, color: "#fff",
          background: `linear-gradient(150deg, ${ACCENT_LIGHT} 0%, ${ACCENT} 45%, ${ACCENT_DARK} 100%)`,
        }}
      >
        {/* soft glows */}
        <Box sx={{ position: "absolute", width: 560, height: 560, borderRadius: "50%", top: -220, left: -160, background: "radial-gradient(circle, rgba(255,255,255,0.22), transparent 70%)", filter: "blur(8px)" }} />
        <Box sx={{ position: "absolute", width: 460, height: 460, borderRadius: "50%", bottom: -180, right: -120, background: "radial-gradient(circle, rgba(0,0,0,0.18), transparent 70%)" }} />
        {/* faint grid texture */}
        <Box sx={{ position: "absolute", inset: 0, opacity: 0.12, backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />

        {/* wordmark */}
        <Box sx={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: "13px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.35)", backdropFilter: "blur(6px)" }}>
            <LocalHospitalRounded sx={{ color: "#fff", fontSize: 24 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: "1.25rem", letterSpacing: "-0.5px", lineHeight: 1 }}>HMS</Typography>
            <Typography sx={{ fontSize: "0.7rem", letterSpacing: "2px", opacity: 0.85, textTransform: "uppercase" }}>Staff Portal</Typography>
          </Box>
        </Box>

        {/* headline + features */}
        <Box sx={{ position: "relative", zIndex: 1, my: 4 }}>
          <Typography sx={{ fontWeight: 800, fontSize: { md: "1.9rem", lg: "2.3rem" }, lineHeight: 1.15, letterSpacing: "-0.8px", maxWidth: 460 }}>
            Everything your hospital runs on, in one place.
          </Typography>
          <PulseLine tone="light" width={180} />

          <Stack spacing={2.25} sx={{ mt: 4, maxWidth: 440 }}>
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <Box key={f.title} sx={{ display: "flex", gap: 1.75, alignItems: "flex-start" }}>
                  <Box sx={{ mt: 0.25, width: 38, height: 38, flexShrink: 0, borderRadius: "11px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}>
                    <Icon sx={{ fontSize: 20, color: "#fff" }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>{f.title}</Typography>
                    <Typography sx={{ fontSize: "0.85rem", opacity: 0.82, lineHeight: 1.45 }}>{f.desc}</Typography>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Box>

        {/* footer */}
        <Typography sx={{ position: "relative", zIndex: 1, fontSize: "0.78rem", opacity: 0.75 }}>
          © {new Date().getFullYear()} HMS SaaS · Encrypted, session-bound access
        </Typography>
      </Box>

      {/* ── RIGHT: form panel ─────────────────────────────────────────────── */}
      <Box
        sx={{
          flex: { xs: "1 1 100%", md: "1 1 54%" },
          display: "flex", alignItems: "center", justifyContent: "center",
          bgcolor: "#fff", p: { xs: 3, sm: 5 }, position: "relative", overflow: "hidden",
        }}
      >
        {/* faint accent glow so the white side isn't flat on mobile (where the hero is hidden) */}
        <Box aria-hidden sx={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", top: -180, right: -140, background: `radial-gradient(circle, ${ACCENT}14, transparent 70%)`, display: { xs: "block", md: "none" } }} />

        <Fade in timeout={500}>
          <Box sx={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 400 }}>
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
        </Fade>
      </Box>
    </Box>
  );
}
