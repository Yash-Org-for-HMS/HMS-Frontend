import { Box, Typography } from "@mui/material";
import { LocalHospitalRounded } from "@mui/icons-material";

// Small, understated brand header for the auth screens: a mark + the full product
// name (spelled out — never just "HMS"), with the thin clinical pulse-line as a
// quiet, on-subject anchor. Accent is passed in so each portal keeps its colour.
export default function AuthBrand({ accent, accentDark }: { accent: string; accentDark: string }) {
  const gradId = `authPulse-${accent.replace("#", "")}`;
  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Box sx={{ width: 34, height: 34, flexShrink: 0, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: accent }}>
          <LocalHospitalRounded sx={{ color: "#fff", fontSize: 19 }} />
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", letterSpacing: "-0.2px", color: "#0F172A" }}>
          Hospital Management System
        </Typography>
      </Box>

      <Box
        component="svg" viewBox="0 0 200 32" aria-hidden
        sx={{
          width: 150, height: 20, display: "block", mt: 1.75, ml: 0.25,
          "& path": { fill: "none", stroke: `url(#${gradId})`, strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round", strokeDasharray: 240, animation: "authPulseDraw 3.5s linear infinite" },
          "@keyframes authPulseDraw": { from: { strokeDashoffset: 240 }, to: { strokeDashoffset: 0 } },
          "@media (prefers-reduced-motion: reduce)": { "& path": { animation: "none", strokeDashoffset: 0 } },
        }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={accent} stopOpacity={0.2} />
            <stop offset="50%" stopColor={accent} />
            <stop offset="100%" stopColor={accentDark} stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <path d="M0,16 L40,16 L48,16 L54,6 L60,26 L66,16 L96,16 L102,12 L108,16 L150,16 L158,16 L164,7 L170,25 L176,16 L200,16" />
      </Box>
    </Box>
  );
}
