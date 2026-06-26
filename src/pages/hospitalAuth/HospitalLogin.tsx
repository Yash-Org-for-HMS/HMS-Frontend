import { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  InputAdornment,
  IconButton,
  CircularProgress,
} from "@mui/material";
import { Visibility, VisibilityOff, LockOutlined, EmailOutlined, LocalHospitalRounded } from "@mui/icons-material";
import { useHospitalAuth } from "../../contexts/HospitalAuthContext";
import { axiosInstance } from "../../api/axios";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";

const GREEN = "#10b981";
const GREEN_DARK = "#059669";

export default function HospitalLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useHospitalAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await axiosInstance.post("/hospital-auth/login", {
        email,
        password,
      });

      const data = response.data.data;

      if (data.requiresPasswordChange) {
        localStorage.setItem("hospitalTempToken", data.tempToken);
        navigate("/hospital/change-password");
        return;
      }

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
          "Failed to login. Please check your credentials."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", bgcolor: "background.default" }}>
      {/* ── Left: hero image panel (hidden on mobile) ─────────────────────── */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flex: 1.15,
          position: "relative",
          flexDirection: "column",
          justifyContent: "flex-end",
          p: 7,
          color: "#fff",
          // The green gradient overlay sits ON TOP of the photo, so the panel
          // looks intentional and the text stays legible even before the image
          // is added (drop a photo at /public/login-family.jpg).
          backgroundColor: GREEN_DARK,
          backgroundImage: `linear-gradient(135deg, rgba(5,150,105,0.78) 0%, rgba(16,185,129,0.55) 100%), url('/login-family.jpg')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Brand mark top-left */}
        <Box sx={{ position: "absolute", top: 40, left: 56, display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 44, height: 44, borderRadius: 2,
              bgcolor: "rgba(255,255,255,0.18)",
              backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <LocalHospitalRounded sx={{ color: "#fff", fontSize: 26 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: "-0.3px" }}>
            HMS
          </Typography>
        </Box>

        {/* Headline bottom-left */}
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: "-1px", mb: 1.5, maxWidth: 540, lineHeight: 1.15 }}>
            Caring for families, together.
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 400, opacity: 0.95, maxWidth: 480 }}>
            One platform for your whole hospital — appointments, patients, billing and care, in one place.
          </Typography>
        </Box>
      </Box>

      {/* ── Right: login form ─────────────────────────────────────────────── */}
      <Box
        sx={{
          flex: { xs: 1, md: "0 0 520px" },
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 3, sm: 6 },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 400 }}>
          <Box sx={{ mb: 4 }}>
            <Box
              sx={{
                width: 56, height: 56, borderRadius: "16px",
                background: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                mb: 2.5,
                boxShadow: "0 10px 15px -3px rgba(16, 185, 129, 0.3)",
              }}
            >
              <LocalHospitalRounded sx={{ color: "#fff", fontSize: 30 }} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: "text.primary", letterSpacing: "-0.5px", mb: 0.5 }}>
              Welcome back
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Sign in to your hospital staff portal
            </Typography>
          </Box>

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
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailOutlined />
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
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
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
                mt: 3,
                background: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`,
                color: "#FFFFFF",
                fontWeight: 600,
                fontSize: "1rem",
                textTransform: "none",
                borderRadius: 2,
                boxShadow: "none",
                "&:hover": {
                  background: `linear-gradient(135deg, ${GREEN_DARK} 0%, #047857 100%)`,
                  boxShadow: "0 8px 20px -6px rgba(16, 185, 129, 0.5)",
                },
                transition: "all 0.2s ease-in-out",
              }}
            >
              {isLoading ? <CircularProgress size={24} sx={{ color: "#fff" }} /> : "Sign In"}
            </Button>
          </form>

          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", textAlign: "center", mt: 4 }}>
            © {new Date().getFullYear()} HMS SaaS · Secure staff access
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
