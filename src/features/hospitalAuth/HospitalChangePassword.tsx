import { useState, useEffect } from "react";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  Box, Button, TextField, Typography, InputAdornment, IconButton,
} from "@mui/material";
import {
  Visibility, VisibilityOff, KeyboardCapslockRounded, ShieldOutlined, LockOutlined,
} from "@mui/icons-material";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { axiosInstance } from "@/api/axios";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "@/components/HeartbeatLoader";

const ACCENT = "#0891b2";
const TEXT = "#0F172A";

export default function HospitalChangePassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const { login } = useHospitalAuth();
  const navigate = useNavigate();
  // Captured once, on mount. The guard below asks whether this page was
  // reached with a temp token — not whether one is still in storage. The
  // success path clears the token and then signs the user in, so re-reading
  // it every render made that clear fire the guard: the moment the new
  // password was accepted, the user was redirected back to the login screen
  // instead of into the panel.
  const [tempToken] = useState(() => sessionStorage.getItem("hospitalTempToken"));

  useEffect(() => {
    if (!tempToken) navigate("/hospital/login");
  }, [tempToken, navigate]);

  const mismatch = confirmNewPassword.length > 0 && newPassword !== confirmNewPassword;
  const canSubmit = newPassword.length > 0 && confirmNewPassword.length > 0 && !mismatch && !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setIsLoading(true);
    try {
      const response = await axiosInstance.post("/hospital-auth/first-login-change-password", {
        tempToken,
        newPassword,
        confirmNewPassword,
      });
      const data = response.data.data;
      sessionStorage.removeItem("hospitalTempToken");
      login(
        data.tokens.accessToken,
        data.tokens.refreshToken,
        data.user,
        data.hospital,
        data.branch,
        data.sessionId,
      );
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Failed to change password. The link may have expired."));
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

  if (!tempToken) return null;

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", px: 3, py: 6, backgroundImage: "url('/login.png')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}>
      {/* Minimalist: the form sits directly on the background image — no card. */}
      <Box sx={{ width: "100%", maxWidth: 400 }}>

        <Typography sx={{ color: TEXT, fontWeight: 700, fontSize: "0.7rem", letterSpacing: "1.5px", textTransform: "uppercase", mb: 0.75, textAlign: "center" }}>
          Hospital Staff Portal
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: "1.45rem", letterSpacing: "-0.5px", lineHeight: 1.15, color: TEXT, textAlign: "center" }}>
          Set a new password
        </Typography>
        <Typography sx={{ color: "text.secondary", fontSize: "0.95rem", lineHeight: 1.55, mt: 0.5, mb: 3.5, textAlign: "center" }}>
          Choose a new password to finish signing in.
        </Typography>

        <form onSubmit={handleSubmit} noValidate>
          <TextField
            fullWidth variant="outlined" label="New password" type={showPassword ? "text" : "password"} margin="dense"
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            onKeyUp={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
            disabled={isLoading} required sx={fieldSx} inputProps={{ autoComplete: "new-password" }}
            InputLabelProps={{ shrink: true }} placeholder="At least 8 characters"
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
          <TextField
            fullWidth variant="outlined" label="Confirm new password" type={showPassword ? "text" : "password"} margin="dense"
            value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)}
            disabled={isLoading} required sx={fieldSx} inputProps={{ autoComplete: "new-password" }}
            error={mismatch} helperText={mismatch ? "Passwords do not match" : " "}
            InputLabelProps={{ shrink: true }} placeholder="Re-enter your new password"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlined fontSize="small" className="field-lead-icon" sx={{ color: "text.secondary" }} />
                </InputAdornment>
              ),
            }}
          />

          <Button
            fullWidth type="submit" disableElevation disabled={!canSubmit}
            sx={{
              py: 1.4, mt: 2, fontWeight: 700, fontSize: "0.98rem", textTransform: "none", borderRadius: 2.5, color: "#fff",
              "&.Mui-disabled": { bgcolor: "rgba(15,23,42,0.10)", color: "rgba(15,23,42,0.4)" },
              transition: "background-color 0.2s ease",
            }}
          >
            {isLoading ? <HeartbeatLoader size={22} /> : "Update password & continue"}
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
