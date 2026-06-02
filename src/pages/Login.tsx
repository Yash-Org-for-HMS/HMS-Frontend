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
import { Visibility, VisibilityOff, LockOutlined, EmailOutlined } from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";
import { axiosInstance } from "../api/axios";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await axiosInstance.post("/auth/login", {
        email,
        password,
      });

      const { user, tokens } = response.data.data;
      login(tokens.accessToken, tokens.refreshToken, user);
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
        background: `linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)`, // Deep premium dark gradient
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.15) 0%, transparent 60%)",
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
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                boxShadow: "0 10px 15px -3px rgba(99, 102, 241, 0.3)",
              }}
            >
              <Typography variant="h4" sx={{ color: "#fff", fontWeight: 800 }}>
                H
              </Typography>
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
              Welcome Back
            </Typography>
            <Typography variant="body2" sx={{ color: "#94a3b8" }}>
              Sign in to HMS Administration
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
                  "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                },
                "& .MuiInputLabel-root": { color: "#94a3b8" },
                "& .MuiInputLabel-root.Mui-focused": { color: "#6366f1" },
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
                  "&.Mui-focused fieldset": { borderColor: "#6366f1" },
                },
                "& .MuiInputLabel-root": { color: "#94a3b8" },
                "& .MuiInputLabel-root.Mui-focused": { color: "#6366f1" },
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
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                fontWeight: 600,
                fontSize: "1rem",
                textTransform: "none",
                borderRadius: 2,
                boxShadow: "0 4px 14px 0 rgba(99, 102, 241, 0.39)",
                "&:hover": {
                  background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                  boxShadow: "0 6px 20px rgba(99, 102, 241, 0.4)",
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
