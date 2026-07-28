import { Box, Typography } from "@mui/material";

// Typographic brand lockup for the auth screens — the full product name spelled
// out (never just "HMS"), in the app's own type (Inter, via the theme). Two weights
// give it a designed, non-generic feel: the domain word carries the emphasis.
export default function AuthBrand() {
  return (
    <Typography
      component="div"
      sx={{ fontSize: "1.1rem", lineHeight: 1, letterSpacing: "-0.2px", color: "#0F172A", fontWeight: 500, mb: 4 }}
    >
      <Box component="span" sx={{ fontWeight: 800 }}>Hospital</Box> Management System
    </Typography>
  );
}
