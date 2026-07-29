import { Box } from "@mui/material";
import { PersonRounded } from "@mui/icons-material";

// Centered circular profile avatar for the auth screens. Unfilled — a soft
// translucent circle with a hairline border; only the person glyph carries the
// portal's accent colour.
export default function AuthBrand({ accent }: { accent: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
      <Box
        sx={{
          width: 80, height: 80, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          bgcolor: "rgba(255,255,255,0.65)",
          border: "1px solid rgba(15,23,42,0.10)",
          boxShadow: "0 10px 28px -14px rgba(15,23,42,0.28)",
        }}
      >
        <PersonRounded sx={{ color: accent, fontSize: 44 }} />
      </Box>
    </Box>
  );
}
