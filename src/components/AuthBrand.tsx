import { Box } from "@mui/material";
import { LocalHospitalRounded } from "@mui/icons-material";

// Minimal brand mark for the auth screens: just an accent square with the product
// glyph. The product name/tagline were removed at the design's request; the portal
// name below the mark now carries the heading. Accent is passed so each portal
// keeps its colour.
export default function AuthBrand({ accent }: { accent: string }) {
  return (
    <Box
      sx={{
        width: 48, height: 48, flexShrink: 0, borderRadius: "12px",
        display: "flex", alignItems: "center", justifyContent: "center",
        bgcolor: accent, mb: 2.5,
      }}
    >
      <LocalHospitalRounded sx={{ color: "#fff", fontSize: 26 }} />
    </Box>
  );
}
