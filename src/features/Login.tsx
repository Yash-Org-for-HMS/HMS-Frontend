import { useState } from "react";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  Box, Button, TextField, Typography, InputAdornment, IconButton,
} from "@mui/material";
import {
  Visibility, VisibilityOff, KeyboardCapslockRounded, ShieldOutlined,
  MailOutlined, LockOutlined,
} from "@mui/icons-material";
import { useAuth } from "@/providers/AuthContext";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "@/components/HeartbeatLoader";

// Admin/platform realm accent (src/styles/accents.ts: admin indigo) — distinct
// from the cyan hospital staff login, so the two portals read as different realms
// of the same product.
const ACCENT = "#4F46E5";
const ACCENT_DARK = "#4338CA";
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
    "& .MuiInputLabel-root": { fontWeight: 600 },
    "& .MuiInputLabel-root.Mui-focused": { color: ACCENT },
    "& .MuiOutlinedInput-root": {
      borderRadius: "14px",
      // Frosted-white fill so fields read cleanly over the soft background image
      // without needing a card container around them.
      backgroundColor: "rgba(255,255,255,0.82)",
      backdropFilter: "blur(6px)",
      transition: "box-shadow 0.2s ease, border-color 0.2s ease",
      "& fieldset": { borderColor: "rgba(15,23,42,0.12)" },
      "&:hover fieldset": { borderColor: "rgba(15,23,42,0.28)" },
      "&.Mui-focused fieldset": { borderColor: ACCENT, borderWidth: "1.5px", boxShadow: `0 0 0 4px ${ACCENT}1f` },
    },
    "& .MuiOutlinedInput-input": { paddingTop: "14px", paddingBottom: "14px" },
    "& .MuiOutlinedInput-root.Mui-focused .field-lead-icon": { color: ACCENT },
  };

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", px: 3, py: 6, backgroundImage: "url('/login.jpg')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}>
      {/* Minimalist: the form sits directly on the background image — no card. */}
      <Box sx={{ width: "100%", maxWidth: 400 }}>

        <Typography sx={{ color: "#0F172A", fontWeight: 800, fontSize: "1.7rem", letterSpacing: "-0.3px", lineHeight: 1.15, textAlign: "center" }}>
          Welcome back
        </Typography>
        {/* Names the portal so it's never mistaken for the hospital staff login
            (which uses the cyan accent at /hospital/login). */}
        <Typography sx={{ color: "#0F172A", fontSize: "0.95rem", textAlign: "center", mt: 0.5, mb: 3.5 }}>
          Platform Admin
        </Typography>

        <form onSubmit={handleLogin} noValidate>
          <TextField
            fullWidth variant="outlined" label="Email" type="email" margin="dense"
            value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)}
            error={emailError} helperText={emailError ? "Enter a valid email address" : " "}
            disabled={isLoading} required sx={fieldSx} inputProps={{ autoComplete: "email" }}
            InputLabelProps={{ shrink: true }} placeholder="admin@hms.io"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <MailOutlined fontSize="small" className="field-lead-icon" sx={{ color: "text.secondary" }} />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            fullWidth variant="outlined" label="Password" type={showPassword ? "text" : "password"} margin="dense"
            value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyUp={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
            disabled={isLoading} required sx={fieldSx} inputProps={{ autoComplete: "current-password" }}
            InputLabelProps={{ shrink: true }} placeholder="Enter your password"
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

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 3.5, color: "text.secondary" }}>
          <ShieldOutlined sx={{ fontSize: 15 }} />
          <Typography variant="caption">Encrypted · platform access</Typography>
        </Box>
      </Box>
    </Box>
  );
}
