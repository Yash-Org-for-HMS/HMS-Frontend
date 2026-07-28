import { useState, useEffect } from "react";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  Box, Button, TextField, Typography, InputAdornment, IconButton,
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

const ACCENT = "#0891b2";
const ACCENT_DARK = "#0e7490";
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
  const tempToken = sessionStorage.getItem("hospitalTempToken");

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
    "& .MuiInputLabel-root.Mui-focused": { color: ACCENT },
    "& .MuiOutlinedInput-root": {
      borderRadius: 2.5,
      "& fieldset": { borderColor: "rgba(15,23,42,0.14)" },
      "&:hover fieldset": { borderColor: "rgba(15,23,42,0.28)" },
      "&.Mui-focused fieldset": { borderColor: ACCENT, boxShadow: `0 0 0 3px ${ACCENT}1a` },
    },
  };

  if (!tempToken) return null;

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#f8fafc", px: 3, py: 6 }}>
      <Box
        sx={{
          width: "100%", maxWidth: 480, p: { xs: 3, sm: 4.5 }, border: "1px solid rgba(15,23,42,0.08)", borderRadius: 4, bgcolor: "#fff", boxShadow: "0 12px 40px -18px rgba(15,23,42,0.18)",
        }}
      >
        <AuthBrand />

        <Typography sx={{ color: ACCENT, fontWeight: 700, fontSize: "0.7rem", letterSpacing: "1.5px", textTransform: "uppercase", mb: 1.75 }}>
          Hospital Staff Portal
        </Typography>
        <Typography sx={{ fontWeight: 800, fontSize: "1.45rem", letterSpacing: "-0.5px", lineHeight: 1.15, color: TEXT }}>
          Set a new password
        </Typography>
        <Typography sx={{ color: "text.secondary", fontSize: "0.95rem", lineHeight: 1.55, mt: 1, mb: 3.25 }}>
          Choose a new password to finish signing in.
        </Typography>

        <form onSubmit={handleSubmit} noValidate>
          <TextField
            fullWidth variant="outlined" label="New password" type={showPassword ? "text" : "password"} margin="dense"
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            onKeyUp={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
            disabled={isLoading} required sx={fieldSx} inputProps={{ autoComplete: "new-password" }}
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
          <TextField
            fullWidth variant="outlined" label="Confirm new password" type={showPassword ? "text" : "password"} margin="dense"
            value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)}
            disabled={isLoading} required sx={fieldSx} inputProps={{ autoComplete: "new-password" }}
            error={mismatch} helperText={mismatch ? "Passwords do not match" : " "}
          />

          <Button
            fullWidth type="submit" disableElevation disabled={!canSubmit}
            sx={{
              py: 1.4, mt: 2, fontWeight: 700, fontSize: "0.98rem", textTransform: "none", borderRadius: 2.5, color: "#fff",
              bgcolor: ACCENT,
              "&:hover": { bgcolor: ACCENT_DARK },
              "&.Mui-disabled": { bgcolor: "rgba(15,23,42,0.10)", color: "rgba(15,23,42,0.4)" },
              transition: "background-color 0.2s ease",
            }}
          >
            {isLoading ? <HeartbeatLoader size={22} /> : "Update password & continue"}
          </Button>
        </form>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 4, color: "text.secondary" }}>
          <ShieldOutlined sx={{ fontSize: 15 }} />
          <Typography variant="caption">Encrypted · session-bound access</Typography>
        </Box>
      </Box>
    </Box>
  );
}
