import { useState } from "react";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  Box, Button, TextField, Typography, InputAdornment, IconButton, Link,
} from "@mui/material";
import {
  Visibility, VisibilityOff, KeyboardCapslockRounded, ShieldOutlined,
  MailOutlined, LockOutlined,
} from "@mui/icons-material";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { axiosInstance } from "@/api/axios";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "@/components/HeartbeatLoader";

// Same clinical accent as the reception realm — kept as the ONE spot of colour on
// an otherwise pure-white, minimalist page.
const ACCENT = "#0891b2";
// The submit button is solid ink rather than the accent colour — the strongest
// possible contrast for the primary action, per the reference login card.
const INK = "#111827";
const INK_DARK = "#000000";
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

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

  // Pill-shaped, near-borderless fields (placeholder-only, no floating label) —
  // kept from the reference-inspired redesign: soft neutral fill, fully rounded
  // corners, colour reserved for focus/errors.
  const fieldSx = {
    mb: 0.5,
    "& .MuiOutlinedInput-root": {
      borderRadius: "999px",
      backgroundColor: "#F5F5F7",
      transition: "box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease",
      "& fieldset": { borderColor: "transparent" },
      "&:hover fieldset": { borderColor: "rgba(15,23,42,0.14)" },
      "&.Mui-focused": { backgroundColor: "#fff" },
      "&.Mui-focused fieldset": { borderColor: ACCENT, borderWidth: "1.5px", boxShadow: `0 0 0 4px ${ACCENT}1a` },
      "&.Mui-error fieldset": { borderColor: "#ef4444" },
    },
    "& .MuiOutlinedInput-input": { paddingTop: "14.5px", paddingBottom: "14.5px" },
    "& .MuiOutlinedInput-root.Mui-focused .field-lead-icon": { color: ACCENT },
  } as const;

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", px: 3, py: 6, backgroundImage: "url('/login.jpg')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}>
      {/* Minimalist: the form sits directly on the background image — no card. */}
      <Box sx={{ width: "100%", maxWidth: 400 }}>

        <Typography sx={{ color: "#0F172A", fontWeight: 800, fontSize: "1.7rem", letterSpacing: "-0.3px", lineHeight: 1.15, textAlign: "center" }}>
          Hospital Staff Portal
        </Typography>
        {/* Names the portal so it's never mistaken for the platform-admin login
            (which uses the indigo accent at /login). */}
        <Typography sx={{ color: "#0F172A", fontSize: "0.95rem", textAlign: "center", mt: 0.5, mb: 3.5 }}>
           Welcome back
        </Typography>

        <form onSubmit={handleLogin} noValidate>
          <TextField
            fullWidth variant="outlined" type="email" margin="dense"
            value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)}
            error={emailError} helperText={emailError ? "Enter a valid email address" : " "}
            disabled={isLoading} required sx={fieldSx} inputProps={{ autoComplete: "email", "aria-label": "Email" }}
            placeholder="you@hospital.com"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <MailOutlined fontSize="small" className="field-lead-icon" sx={{ color: "text.secondary" }} />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            fullWidth variant="outlined" type={showPassword ? "text" : "password"} margin="dense"
            value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyUp={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
            disabled={isLoading} required sx={fieldSx} inputProps={{ autoComplete: "current-password", "aria-label": "Password" }}
            placeholder="Enter your password"
            helperText={capsOn ? "Caps Lock is on" : " "}
            FormHelperTextProps={{ sx: { color: capsOn ? "warning.main" : undefined } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlined fontSize="small" className="field-lead-icon" sx={{ color: "text.secondary" }} />
                </InputAdornment>
              ),
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

          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.25, mb: 2.5 }}>
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
              py: 1.5, fontWeight: 700, fontSize: "0.98rem", textTransform: "none", borderRadius: 999, color: "#fff",
              bgcolor: INK,
              "&:hover": { bgcolor: INK_DARK },
              "&.Mui-disabled": { bgcolor: "rgba(15,23,42,0.12)", color: "rgba(15,23,42,0.4)" },
              transition: "background-color 0.2s ease",
            }}
          >
            {isLoading ? <HeartbeatLoader size={22} /> : "Sign In"}
          </Button>
        </form>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 3.5, color: "text.secondary" }}>
          <ShieldOutlined sx={{ fontSize: 15 }} />
          <Typography variant="caption">Encrypted · session-bound access</Typography>
        </Box>
      </Box>
    </Box>
  );
}
