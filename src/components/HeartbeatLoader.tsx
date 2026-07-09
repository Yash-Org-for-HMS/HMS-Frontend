import { Box, Typography } from "@mui/material";
import { Suspense, lazy } from "react";

// The dotLottie player is heavy (player lib + wasm binding); load it lazily so
// it never lands in the first-paint bundle. A tiny CSS pulse stands in until the
// chunk arrives — which for brief loaders is often all the user ever sees.
const HeartbeatLottie = lazy(() => import("./HeartbeatLottie"));

interface HeartbeatLoaderProps {
  /** Animation size in px. ~22 inside buttons, ~96 for page/section loaders. */
  size?: number;
  /** Center the animation in a min-height box (use for full page / section / table loaders). */
  center?: boolean;
  /** Min-height of the centering box when `center` is set. */
  minHeight?: number | string;
  /** Optional caption shown under the animation. */
  label?: string;
}

/** Lightweight CSS heartbeat shown while the Lottie chunk loads. */
function Pulse({ size }: { size: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        bgcolor: "primary.main",
        animation: "hbPulse 1s ease-in-out infinite",
        "@keyframes hbPulse": {
          "0%, 100%": { transform: "scale(0.6)", opacity: 0.35 },
          "50%": { transform: "scale(1)", opacity: 0.85 },
        },
      }}
    />
  );
}

/**
 * The single, app-wide loading indicator: a looping heartbeat (dotLottie),
 * lazy-loaded with a CSS-pulse fallback. Replaces MUI's CircularProgress
 * everywhere.
 *
 * - Inline (e.g. inside a button): `<HeartbeatLoader size={22} />`
 * - Page / section / table loader: `<HeartbeatLoader center />`
 *
 * The .lottie is served statically from /heartbeat.lottie (public/).
 */
export default function HeartbeatLoader({
  size = 88,
  center = false,
  minHeight = 240,
  label,
}: HeartbeatLoaderProps) {
  const anim = (
    <Box
      sx={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: label ? 1 : 0,
        lineHeight: 0,
      }}
    >
      <Box sx={{ width: size, height: size, display: "grid", placeItems: "center" }}>
        <Suspense fallback={<Pulse size={size} />}>
          <HeartbeatLottie size={size} />
        </Suspense>
      </Box>
      {label && (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {label}
        </Typography>
      )}
    </Box>
  );

  if (!center) return anim;

  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", minHeight }}>
      {anim}
    </Box>
  );
}
