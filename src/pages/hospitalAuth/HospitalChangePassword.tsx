import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Visibility, VisibilityOff, LockOutlined, LockResetRounded } from "@mui/icons-material";
import { useHospitalAuth } from "../../contexts/HospitalAuthContext";
import { axiosInstance } from "../../api/axios";
import { useNavigate } from "react-router-dom";

export default function HospitalChangePassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useHospitalAuth();
  const navigate = useNavigate();
  const tempToken = localStorage.getItem("hospitalTempToken");

  useEffect(() => {
    if (!tempToken) {
      navigate("/hospital/login");
    }
  }, [tempToken, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const response = await axiosInstance.post("/hospital-auth/first-login-change-password", {
        tempToken,
        newPassword,
        confirmNewPassword,
      });

      const data = response.data.data;
      localStorage.removeItem("hospitalTempToken");

      // Login success
      login(
        data.tokens.accessToken,
        data.tokens.refreshToken,
        data.user,
        data.hospital,
        data.branch,
        data.sessionId
      );
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Failed to change password. The link may have expired."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!tempToken) return null;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg, #0f172a 0%, #064e3b 100%)`,
        position: "relative",
      }}
    >
      <Container maxWidth="xs" sx={{ position: "relative", zIndex: 1 }}>
        <Paper
          elevation={24}
          sx={{
            p: { xs: 4, md: 5 },
            borderRadius: 3,
            background: "rgba(30, 41, 59, 0.7)",
            backdropFilter: "blur(12px)",
            border: "1px solid", borderColor: "divider",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          }}
        >
          <Box sx={{ mb: 4, textAlign: "center" }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: "16px",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <LockResetRounded sx={{ color: "#fff", fontSize: 32 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary", mb: 1 }}>
              Set New Password
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              For security reasons, you must change your password before continuing.
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="New Password"
              type={showPassword ? "text" : "password"}
              variant="outlined"
              margin="normal"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isLoading}
              required
              sx={{
                mb: 2.5,
                "& .MuiOutlinedInput-root": {
                  color: "text.primary",
                  backgroundColor: "rgba(15, 23, 42, 0.6)",
                  "& fieldset": { borderColor: "divider" },
                  "&.Mui-focused fieldset": { borderColor: "#10b981" },
                },
                "& .MuiInputLabel-root": { color: "text.secondary" },
              }}
            />
            <TextField
              fullWidth
              label="Confirm New Password"
              type={showPassword ? "text" : "password"}
              variant="outlined"
              margin="normal"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              disabled={isLoading}
              required
              sx={{
                mb: 4,
                "& .MuiOutlinedInput-root": {
                  color: "text.primary",
                  backgroundColor: "rgba(15, 23, 42, 0.6)",
                  "& fieldset": { borderColor: "divider" },
                  "&.Mui-focused fieldset": { borderColor: "#10b981" },
                },
                "& .MuiInputLabel-root": { color: "text.secondary" },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: "text.secondary" }}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              fullWidth
              type="submit"
              variant="contained"
              disabled={isLoading}
              sx={{
                py: 1.5,
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                fontWeight: 600,
                textTransform: "none",
              }}
            >
              {isLoading ? <CircularProgress size={24} sx={{ color: "#fff" }} /> : "Update Password & Continue"}
            </Button>
          </form>
        </Paper>
      </Container>
    </Box>
  );
}
