import { Box, Typography } from "@mui/material";
import { LocalHospitalRounded } from "@mui/icons-material";

// Brand lockup for the auth screens: an accent mark + the full product name spelled
// out (never just "HMS") + a one-line tagline. Uses MUI Typography so the name is
// set in the app's own type (Inter, from the theme). Accent is passed so each portal
// keeps its colour.
export default function AuthBrand({ accent }: { accent: string }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: "11px", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: accent }}>
          <LocalHospitalRounded sx={{ color: "#fff", fontSize: 22 }} />
        </Box>
        <Typography
          component="div"
          sx={{ fontSize: "1.45rem", lineHeight: 1.05, letterSpacing: "-0.6px", color: "#0F172A", fontWeight: 500 }}
        >
          <Box component="span" sx={{ fontWeight: 800 }}>Hospital</Box> Management System
        </Typography>
      </Box>
      <Typography sx={{ mt: 1.5, fontSize: "0.85rem", color: "text.secondary" }}>
        One system for the whole hospital — reception to discharge.
      </Typography>
    </Box>
  );
}
