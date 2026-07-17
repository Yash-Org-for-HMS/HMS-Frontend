import { useState } from "react";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  Box, Button, TextField, Typography, InputAdornment, IconButton, Link, Fade,
} from "@mui/material";
import {
  Visibility, VisibilityOff, LockOutlined, EmailOutlined, LocalHospitalRounded,
  KeyboardCapslockRounded, ShieldRounded,
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
const BG = "#F5F5F7"; // matches theme.palette.background.default
const TEXT = "#0F172A";
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Slim animated pulse line — the clinical signature, pure SVG/CSS (no wasm).
// Uses a gradient stroke so it stays a "gradient accent" on a light card.
function PulseLine() {
  const d = "M0,16 L40,16 L48,16 L54,6 L60,26 L66,16 L96,16 L102,12 L108,16 L150,16 L158,16 L164,7 L170,25 L176,16 L200,16";
  return (
    <Box component="svg" viewBox="0 0 200 32" aria-hidden sx={{
      width: 160, height: 22, display: "block", mx: "auto", my: 1.5,
      "& path": { fill: "none", stroke: "url(#pulseGrad)", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round", strokeDasharray: 240, animation: "pulseDraw 3.5s linear infinite" },
      "@keyframes pulseDraw": { from: { strokeDashoffset: 240 }, to: { strokeDashoffset: 0 } },
    }}>
      <defs>
        <linearGradient id="pulseGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={ACCENT} stopOpacity={0.25} />
          <stop offset="50%" stopColor={ACCENT} />
          <stop offset="100%" stopColor={ACCENT_DARK} stopOpacity={0.25} />
        </linearGradient>
      </defs>
      <path d={d} />
    </Box>
  );
}

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
    // Product-matching gray page background — plus soft cyan gradient glows so
    // it doesn't read as flat, echoing the accent used across the reception realm.
    <Box
      sx={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        p: 2, position: "relative", overflow: "hidden", bgcolor: BG,
      }}
    >
      <Box aria-hidden sx={{ position: "absolute", width: 620, height: 620, borderRadius: "50%", top: -220, left: -180, background: `radial-gradient(circle, ${ACCENT}26, transparent 70%)`, filter: "blur(10px)" }} />
      <Box aria-hidden sx={{ position: "absolute", width: 520, height: 520, borderRadius: "50%", bottom: -200, right: -160, background: `radial-gradient(circle, ${ACCENT}1a, transparent 70%)`, filter: "blur(10px)" }} />

      <Fade in timeout={500}>
        <Box
          sx={{
            position: "relative", zIndex: 1, width: "100%", maxWidth: 500, p: { xs: 3, sm: 4.5 },
            borderRadius: 4, textAlign: "center", bgcolor: "#fff",
            border: "1px solid rgba(15,23,42,0.06)",
            boxShadow: "0 24px 60px -20px rgba(15,23,42,0.18)",
          }}
        >
          <Box sx={{ width: 50, height: 50, mx: "auto", mb: 1.5, borderRadius: "15px", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`, boxShadow: `0 12px 24px -8px ${ACCENT}80` }}>
            <LocalHospitalRounded sx={{ color: "#fff", fontSize: 26 }} />
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: "-0.5px", color: TEXT }}>Welcome back</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            Sign in to your hospital staff portal
          </Typography>

          <PulseLine />

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

            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.25, mb: 1.5 }}>
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

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, mt: 2, color: "text.secondary" }}>
            <ShieldRounded sx={{ fontSize: 16 }} />
            <Typography variant="caption">Encrypted · session-bound access</Typography>
          </Box>
          <Typography variant="caption" sx={{ color: "text.secondary", opacity: 0.7, display: "block", textAlign: "center", mt: 0.75 }}>
            © {new Date().getFullYear()} HMS SaaS
          </Typography>
        </Box>
      </Fade>
    </Box>
  );
}
