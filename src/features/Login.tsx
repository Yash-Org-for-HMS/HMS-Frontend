import { useState } from "react";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  Box, Button, TextField, Typography, InputAdornment, IconButton,
} from "@mui/material";
import {
  Visibility, VisibilityOff, KeyboardCapslockRounded, ShieldOutlined,
} from "@mui/icons-material";
import { useAuth } from "@/providers/AuthContext";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import AuthBrand from "@/components/AuthBrand";

// Admin/platform realm accent (src/styles/accents.ts: admin indigo) — distinct
// from the cyan hospital staff login, so the two portals read as different realms
// of the same product.
const ACCENT = "#4F46E5";
const ACCENT_DARK = "#4338CA";
const TEXT = "#0F172A";
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);


export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [touched, setTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const { login } = useAuth();

  const emailError = touched && email.length > 0 && !isValidEmail(email);
  const canSubmit = isValidEmail(email) && password.length > 0 && !isLoading;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isValidEmail(email) || !password) return;
    setIsLoading(true);
    try {
      const response = await axiosInstance.post("/auth/login", { email, password });
      const { user, tokens } = response.data.data;
      login(tokens.accessToken, tokens.refreshToken, user);
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
    <Box sx={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#f8fafc", px: 3, py: 6 }}>
      <Box
        sx={{
          width: "100%", maxWidth: 480, p: { xs: 3, sm: 4.5 }, border: "1px solid rgba(15,23,42,0.08)", borderRadius: 4, bgcolor: "#fff", boxShadow: "0 12px 40px -18px rgba(15,23,42,0.18)",
        }}
      >
        <AuthBrand />

        {/* Names the portal so it's never mistaken for the hospital staff login
            (which uses the cyan accent at /hospital/login). */}
        <Typography sx={{ color: ACCENT, fontWeight: 700, fontSize: "0.7rem", letterSpacing: "1.5px", textTransform: "uppercase", mb: 1.75 }}>
          Platform Admin
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: "2rem", letterSpacing: "-1px", lineHeight: 1.08, color: TEXT }}>
          Welcome back
        </Typography>
        <Typography sx={{ color: "text.secondary", fontSize: "0.95rem", lineHeight: 1.55, mt: 1, mb: 3.25 }}>
          Sign in to HMS platform administration.
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

          <Button
            fullWidth type="submit" disableElevation disabled={!canSubmit}
            sx={{
              py: 1.4, mt: 2.5, fontWeight: 700, fontSize: "0.98rem", textTransform: "none", borderRadius: 2.5, color: "#fff",
              bgcolor: ACCENT,
              "&:hover": { bgcolor: ACCENT_DARK },
              "&.Mui-disabled": { bgcolor: "rgba(15,23,42,0.10)", color: "rgba(15,23,42,0.4)" },
              transition: "background-color 0.2s ease",
            }}
          >
            {isLoading ? <HeartbeatLoader size={22} /> : "Sign In"}
          </Button>
        </form>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 4, color: "text.secondary" }}>
          <ShieldOutlined sx={{ fontSize: 15 }} />
          <Typography variant="caption">Encrypted · platform access</Typography>
        </Box>
      </Box>
    </Box>
  );
}
