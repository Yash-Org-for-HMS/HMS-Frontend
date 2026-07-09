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
} from "@mui/material";
import { Visibility, VisibilityOff, LockOutlined, LockResetRounded } from "@mui/icons-material";
import { useHospitalAuth } from "../../contexts/HospitalAuthContext";
import { axiosInstance } from "../../api/axios";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import HeartbeatLoader from "../../components/HeartbeatLoader";

export default function HospitalChangePassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useHospitalAuth();
  const navigate = useNavigate();
  const tempToken = sessionStorage.getItem("hospitalTempToken");

  useEffect(() => {
    if (!tempToken) {
      navigate("/hospital/login");
    }
  }, [tempToken, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match");
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
      sessionStorage.removeItem("hospitalTempToken");

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
      toast.error(
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
        bgcolor: "background.default",
      }}
    >
      <Container maxWidth="xs" sx={{ position: "relative", zIndex: 1 }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, md: 5 },
            borderRadius: 4,
            bgcolor: "background.paper",
            boxShadow: "0 10px 40px -10px rgba(0,0,0,0.08)",
            border: "1px solid rgba(15, 23, 42, 0.05)",
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
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined />
                  </InputAdornment>
                ),
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
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined />
                  </InputAdornment>
                ),
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
                mt: 2,
                bgcolor: "primary.main",
                color: "#FFFFFF",
                fontWeight: 600,
                fontSize: "1rem",
                textTransform: "none",
                borderRadius: 2,
                boxShadow: "none",
                "&:hover": {
                  bgcolor: "primary.dark",
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
                  transform: "translateY(-1px)",
                },
                transition: "all 0.2s ease-in-out",
              }}
            >
              {isLoading ? <HeartbeatLoader size={22} /> : "Update Password & Continue"}
            </Button>
          </form>
        </Paper>
      </Container>
    </Box>
  );
}
