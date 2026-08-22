import { useState } from "react";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  Box, Button, TextField, InputAdornment, IconButton,
} from "@mui/material";
import {
  Visibility, VisibilityOff, KeyboardCapslockRounded,
  MailOutlined, LockOutlined,
} from "@mui/icons-material";
import { useAuth } from "@/providers/AuthContext";
import { axiosInstance } from "@/api/axios";
import { useToast } from "@/providers/ToastContext";
import HeartbeatLoader from "@/components/HeartbeatLoader";
import { LoginShell } from "@/features/auth/LoginShell";
import { loginFieldSx, loginSubmitSx, isValidEmail } from "@/features/auth/loginDesign";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const { login } = useAuth();

  // Blur only flags what has been typed and is wrong; submit flags anything
  // missing. `touched` fires when the EMAIL blurs, so keying the password
  // message off it would nag about a field the user is on their way to.
  const emailError = (touched && email.length > 0 && !isValidEmail(email)) || (submitted && !isValidEmail(email));
  const passwordError = submitted && password.length === 0;
  // Deliberately NOT gated on the fields being valid. Gating it made the
  // button flip grey→solid mid-word as the email became parseable, which
  // reads as a fault; and a disabled button never explains itself. The
  // submit handler already refuses bad input, and now says why.
  const canSubmit = !isLoading;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setSubmitted(true);
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

  return (
    <LoginShell title="Platform Admin" subtitle="Welcome back" footnote="platform access">
      <form onSubmit={handleLogin} noValidate>
        <TextField
          fullWidth variant="outlined" type="email" margin="dense"
          value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)}
          error={emailError} helperText={emailError ? (email.length === 0 ? "Enter your email address" : "Enter a valid email address") : " "}
          disabled={isLoading} required sx={loginFieldSx} inputProps={{ autoComplete: "email", "aria-label": "Email" }}
          placeholder="admin@hms.io"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <MailOutlined fontSize="small" className="field-lead-icon" sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          fullWidth variant="outlined" type={showPassword ? "text" : "password"} margin="dense"
          value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyUp={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
          disabled={isLoading} required sx={loginFieldSx} inputProps={{ autoComplete: "current-password", "aria-label": "Password" }}
          placeholder="Enter your password"
          error={passwordError}
          helperText={passwordError ? "Enter your password" : capsOn ? "Caps Lock is on" : " "}
          FormHelperTextProps={{ sx: { color: !passwordError && capsOn ? "warning.main" : undefined } }}
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

        {/* No "Forgot password?" here: staff have an administrator who can reset
            them, the platform console has no one above it, and a link whose only
            advice is "ask yourself" is worse than none. The spacing the link
            occupies on the staff page is kept so the two pages still line up. */}
        <Box sx={{ mt: 0.25, mb: 2.5, height: 21 }} />

        <Button fullWidth type="submit" disableElevation disabled={!canSubmit} sx={loginSubmitSx}>
          {isLoading ? <HeartbeatLoader size={22} /> : "Login"}
        </Button>
      </form>
    </LoginShell>
  );
}
