import { useState } from "react";
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
import { Visibility, VisibilityOff, LockOutlined, EmailOutlined, LocalHospitalRounded } from "@mui/icons-material";
import { useHospitalAuth } from "../../contexts/HospitalAuthContext";
import { axiosInstance } from "../../api/axios";
import { useNavigate } from "react-router-dom";

export default function HospitalLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useHospitalAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Use the new hospital auth endpoint
      const response = await axiosInstance.post("/hospital-auth/login", {
        email,
        password,
      });

      const data = response.data.data;

      // Handle mustChangePassword flow
      if (data.requiresPasswordChange) {
        // Store temp token and redirect to change password screen
        localStorage.setItem("hospitalTempToken", data.tempToken);
        navigate("/hospital/change-password");
        return;
      }

      // Normal login success
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
          "Failed to login. Please check your credentials."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg, #0f172a 0%, #064e3b 100%)`, // Emerald dark gradient for hospitals
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.15) 0%, transparent 60%)",
          zIndex: 0,
        },
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
            border: "1px solid rgba(255, 255, 255, 0.1)",
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
                boxShadow: "0 10px 15px -3px rgba(16, 185, 129, 0.3)",
              }}
            >
              <LocalHospitalRounded sx={{ color: "#fff", fontSize: 32 }} />
            </Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: "#f8fafc",
                mb: 1,
                letterSpacing: "-0.5px",
              }}
            >
              Staff Portal
            </Typography>
            <Typography variant="body2" sx={{ color: "#94a3b8" }}>
              Sign in to Hospital Administration
            </Typography>
          </Box>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                color: "#fca5a5",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                "& .MuiAlert-icon": { color: "#f87171" },
              }}
            >
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin}>
            <TextField
              fullWidth
              label="Email Address"
              variant="outlined"
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              sx={{
                mb: 2.5,
                "& .MuiOutlinedInput-root": {
                  color: "#f1f5f9",
                  backgroundColor: "rgba(15, 23, 42, 0.6)",
                  "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                  "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
                  "&.Mui-focused fieldset": { borderColor: "#10b981" },
                },
                "& .MuiInputLabel-root": { color: "#94a3b8" },
                "& .MuiInputLabel-root.Mui-focused": { color: "#10b981" },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailOutlined sx={{ color: "#64748b" }} />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? "text" : "password"}
              variant="outlined"
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              sx={{
                mb: 4,
                "& .MuiOutlinedInput-root": {
                  color: "#f1f5f9",
                  backgroundColor: "rgba(15, 23, 42, 0.6)",
                  "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                  "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
                  "&.Mui-focused fieldset": { borderColor: "#10b981" },
                },
                "& .MuiInputLabel-root": { color: "#94a3b8" },
                "& .MuiInputLabel-root.Mui-focused": { color: "#10b981" },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined sx={{ color: "#64748b" }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      sx={{ color: "#64748b" }}
                    >
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
                fontSize: "1rem",
                textTransform: "none",
                borderRadius: 2,
                boxShadow: "0 4px 14px 0 rgba(16, 185, 129, 0.39)",
                "&:hover": {
                  background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  boxShadow: "0 6px 20px rgba(16, 185, 129, 0.4)",
                  transform: "translateY(-1px)",
                },
                transition: "all 0.2s ease-in-out",
              }}
            >
              {isLoading ? (
                <CircularProgress size={24} sx={{ color: "#fff" }} />
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </Paper>
      </Container>
    </Box>
  );
}
