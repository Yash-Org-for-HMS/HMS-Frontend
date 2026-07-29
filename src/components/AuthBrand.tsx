import { Box } from "@mui/material";
import { PersonRounded } from "@mui/icons-material";

// Centered circular profile avatar for the auth screens (replaces the old logo
// mark). Accent is passed so each portal keeps its colour.
export default function AuthBrand({ accent }: { accent: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
      <Box
        sx={{
          width: 80, height: 80, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          bgcolor: accent, boxShadow: `0 10px 30px -10px ${accent}`,
        }}
      >
        <PersonRounded sx={{ color: "#fff", fontSize: 46 }} />
      </Box>
    </Box>
  );
}
