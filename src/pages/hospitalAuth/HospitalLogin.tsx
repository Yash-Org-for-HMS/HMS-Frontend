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

const DARK = "#0f172a";
const DARK_HOVER = "#1e293b";

// Dark form styling — sits directly on the photo (no card), so text, outlines,
// labels and icons are dark for legibility over a light area of the image.
const darkField = {
  "& .MuiInputBase-input": { color: DARK },
  "& .MuiInputBase-input::placeholder": { color: "rgba(15,23,42,0.5)" },
  "& .MuiInputLabel-root": { color: "rgba(15,23,42,0.7)" },
  "& .MuiInputLabel-root.Mui-focused": { color: DARK },
  "& .MuiOutlinedInput-root": {
    backgroundColor: "transparent",
    "& fieldset": { borderColor: "rgba(15,23,42,0.4)" },
    "&:hover fieldset": { borderColor: "rgba(15,23,42,0.7)" },
    "&.Mui-focused fieldset": { borderColor: DARK, boxShadow: "none" },
  },
  "& .MuiInputAdornment-root .MuiSvgIcon-root": { color: "rgba(15,23,42,0.7)" },
  // Keep autofilled fields transparent with dark text (no opaque Chrome fill).
  "& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus, & input:-webkit-autofill:active": {
    WebkitTextFillColor: DARK,
    caretColor: DARK,
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
    // Full-bleed photo; the form sits directly on it (no card), centered.
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 2.5, sm: 5, md: 7 },
        backgroundColor: "#dbe4e3",
        backgroundImage: `url('/login-page.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 400 }}>
        <Box sx={{ mb: 4 }}>
          <Box
            sx={{
              width: 56, height: 56, borderRadius: "16px",
              bgcolor: DARK,
              display: "flex", alignItems: "center", justifyContent: "center",
              mb: 2.5,
            }}
          >
            <LocalHospitalRounded sx={{ color: "#fff", fontSize: 30 }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: DARK, letterSpacing: "-0.5px", mb: 0.5 }}>
            Welcome back
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(15,23,42,0.75)" }}>
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
            sx={darkField}
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
            sx={darkField}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlined />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: "rgba(15,23,42,0.7)" }}>
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
              bgcolor: DARK,
              color: "#FFFFFF",
              fontWeight: 600,
              fontSize: "1rem",
              textTransform: "none",
              borderRadius: 2,
              boxShadow: "none",
              "&:hover": {
                bgcolor: DARK_HOVER,
                boxShadow: "0 8px 20px -6px rgba(15, 23, 42, 0.5)",
              },
              transition: "all 0.2s ease-in-out",
            }}
          >
            {isLoading ? <CircularProgress size={24} sx={{ color: "#fff" }} /> : "Sign In"}
          </Button>
        </form>

        <Typography variant="caption" sx={{ color: "rgba(15,23,42,0.7)", display: "block", textAlign: "center", mt: 4 }}>
          © {new Date().getFullYear()} HMS SaaS · Secure staff access
        </Typography>
      </Box>
    </Box>
  );
}
