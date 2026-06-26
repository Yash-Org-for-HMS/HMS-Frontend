import { useState } from "react";
import {
  Box,
  Button,
  Paper,
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

// Glassmorphism input styling — light text/outlines so fields stay legible on the
// translucent card over the photo.
const glassField = {
  "& .MuiInputBase-input": { color: "#fff" },
  "& .MuiInputBase-input::placeholder": { color: "rgba(255,255,255,0.6)" },
  "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.75)" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#fff" },
  "& .MuiOutlinedInput-root": {
    backgroundColor: "rgba(255,255,255,0.08)",
    "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.55)" },
    "&.Mui-focused fieldset": { borderColor: "#fff", boxShadow: "none" },
  },
  "& .MuiInputAdornment-root .MuiSvgIcon-root": { color: "rgba(255,255,255,0.7)" },
  // Kill Chrome's opaque autofill background so the field stays glassy.
  // The 9999s background-color transition defers Chrome's fill indefinitely,
  // and text-fill-color keeps the autofilled text white.
  "& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus, & input:-webkit-autofill:active": {
    WebkitTextFillColor: "#fff",
    caretColor: "#fff",
    transition: "background-color 9999s ease-in-out 0s",
    WebkitBoxShadow: "0 0 0 1000px transparent inset",
  },
};

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
    // Full-bleed family photo; the card is pinned to the bottom-left.
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-end",
        p: { xs: 2.5, sm: 5, md: 7 },
        backgroundColor: "#2b3a39",
        backgroundImage: `url('/login-family.jpg')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Transparent frosted-glass login card */}
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 400,
          borderRadius: "20px",
          p: { xs: 3.5, sm: 5 },
          bgcolor: "rgba(255,255,255,0.10)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.22)",
          boxShadow: "0 24px 64px -12px rgba(0,0,0,0.45)",
          color: "#fff",
        }}
      >
        <Box sx={{ mb: 4 }}>
          <Box
            sx={{
              width: 56, height: 56, borderRadius: "16px",
              background: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              mb: 2.5,
              boxShadow: "0 10px 15px -3px rgba(16, 185, 129, 0.4)",
            }}
          >
            <LocalHospitalRounded sx={{ color: "#fff", fontSize: 30 }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#fff", letterSpacing: "-0.5px", mb: 0.5 }}>
            Welcome back
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.8)" }}>
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
            sx={glassField}
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
            sx={glassField}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlined />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: "rgba(255,255,255,0.7)" }}>
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
                boxShadow: "0 8px 20px -6px rgba(16, 185, 129, 0.6)",
              },
              transition: "all 0.2s ease-in-out",
            }}
          >
            {isLoading ? <CircularProgress size={24} sx={{ color: "#fff" }} /> : "Sign In"}
          </Button>
        </form>

        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", display: "block", textAlign: "center", mt: 4 }}>
          © {new Date().getFullYear()} HMS SaaS · Secure staff access
        </Typography>
      </Paper>
    </Box>
  );
}
