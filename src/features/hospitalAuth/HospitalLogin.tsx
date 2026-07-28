import { useState } from "react";
import { keyframes } from "@emotion/react";
import { NEUTRAL } from "@/styles/accents";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  Box, Button, TextField, Typography, InputAdornment, IconButton, Link,
} from "@mui/material";
import {
  Visibility, VisibilityOff, KeyboardCapslockRounded, ShieldOutlined,
} from "@mui/icons-material";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { axiosInstance } from "@/api/axios";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import AuthBrand from "@/components/AuthBrand";

// Same clinical accent as the reception realm — kept as the ONE spot of colour on
// an otherwise pure-white, minimalist page.
const ACCENT = "#0891b2";
const ACCENT_DARK = "#0e7490";
const TEXT = NEUTRAL.textPrimary;
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// One quiet entrance — a gentle fade-up, disabled under reduced motion.
const kfReveal = keyframes`from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; }`;

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
    mb: 0.5,
    "& .MuiInputLabel-root.Mui-focused": { color: ACCENT },
    "& .MuiOutlinedInput-root": {
      borderRadius: 2.5,
      "& fieldset": { borderColor: "rgba(15,23,42,0.14)" },
      "&:hover fieldset": { borderColor: "rgba(15,23,42,0.28)" },
      "&.Mui-focused fieldset": { borderColor: ACCENT, boxShadow: `0 0 0 3px ${ACCENT}1a` },
    },
  };

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#fff", px: 3, py: 6 }}>
      <Box
        sx={{
          width: "100%", maxWidth: 420,
          "@media (prefers-reduced-motion: no-preference)": { animation: `${kfReveal} 0.5s cubic-bezier(0.22,1,0.36,1) both` },
        }}
      >
        <AuthBrand accent={ACCENT} accentDark={ACCENT_DARK} />

        {/* Names the portal so it's never mistaken for the platform-admin login
            (which uses the indigo accent at /login). */}
        <Typography sx={{ color: ACCENT, fontWeight: 700, fontSize: "0.72rem", letterSpacing: "1.6px", textTransform: "uppercase", mb: 1.25 }}>
          Hospital Staff Portal
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: "1.85rem", letterSpacing: "-0.8px", color: TEXT }}>
          Welcome back
        </Typography>
        <Typography sx={{ color: "text.secondary", fontSize: "0.95rem", mt: 0.75, mb: 3 }}>
          Sign in to continue to your workspace.
        </Typography>

        <form onSubmit={handleLogin} noValidate>
          <TextField
            fullWidth variant="outlined" label="Email" type="email" margin="dense"
            value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)}
            error={emailError} helperText={emailError ? "Enter a valid email address" : " "}
            disabled={isLoading} required sx={fieldSx} inputProps={{ autoComplete: "email" }}
          />
          <TextField
            fullWidth variant="outlined" label="Password" type={showPassword ? "text" : "password"} margin="dense"
            value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyUp={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
            disabled={isLoading} required sx={fieldSx} inputProps={{ autoComplete: "current-password" }}
            helperText={capsOn ? "Caps Lock is on" : " "}
            FormHelperTextProps={{ sx: { color: capsOn ? "warning.main" : undefined } }}
            InputProps={{
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
              py: 1.4, fontWeight: 700, fontSize: "0.98rem", textTransform: "none", borderRadius: 2.5, color: "#fff",
              bgcolor: ACCENT,
              "&:hover": { bgcolor: ACCENT_DARK },
              "&.Mui-disabled": { bgcolor: "rgba(15,23,42,0.10)", color: "rgba(15,23,42,0.4)" },
              transition: "background-color 0.2s ease",
            }}
          >
            {isLoading ? <HeartbeatLoader size={22} /> : "Sign In"}
          </Button>
        </form>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 3, color: "text.secondary" }}>
          <ShieldOutlined sx={{ fontSize: 15 }} />
          <Typography variant="caption">Encrypted · session-bound access</Typography>
        </Box>
      </Box>
    </Box>
  );
}
