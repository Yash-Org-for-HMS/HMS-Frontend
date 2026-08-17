import { Box, Typography, Button, Paper } from "@mui/material";
import { ExploreOffRounded, ArrowBackRounded, HomeRounded } from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { homeForRole } from "@/constants/roles";
import { NEUTRAL } from "@/styles/accents";

/**
 * What an unmatched URL renders.
 *
 * Until this existed the router had no catch-all, so any path it did not
 * recognise — a typo, a stale bookmark, a link to a page that has since been
 * removed — rendered a completely blank white page. Blank is the worst possible
 * answer: it is indistinguishable from the app having crashed, so it gets
 * reported as "the system is down".
 *
 * It does NOT auto-redirect. Silently bouncing someone to a dashboard hides the
 * fact that the address was wrong, which matters most for the case that brought
 * this about — a link somebody is still sending around.
 */
export default function NotFound() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useHospitalAuth();

  // Send people to their OWN panel. A hospital nurse and a platform super-admin
  // do not share a home, so a single hardcoded "/" would strand one of them.
  const home = user ? homeForRole(user.role) : "/";

  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", p: 3 }}>
      <Paper
        elevation={0}
        sx={{ p: { xs: 3, sm: 5 }, borderRadius: 3, border: "1px solid", borderColor: "divider", maxWidth: 520, textAlign: "center" }}
      >
        <ExploreOffRounded sx={{ fontSize: 48, color: NEUTRAL.muted, mb: 1.5 }} />
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
          This page doesn't exist
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>
          Nothing is broken — the address just doesn't lead anywhere.
        </Typography>
        <Typography
          variant="caption"
          sx={{ display: "block", color: NEUTRAL.muted, mb: 3, wordBreak: "break-all", fontFamily: "monospace" }}
        >
          {pathname}
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5, justifyContent: "center", flexWrap: "wrap" }}>
          <Button variant="outlined" startIcon={<ArrowBackRounded />} onClick={() => navigate(-1)} sx={{ textTransform: "none" }}>
            Go back
          </Button>
          <Button variant="contained" startIcon={<HomeRounded />} onClick={() => navigate(home, { replace: true })} sx={{ textTransform: "none" }}>
            Go to my dashboard
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
