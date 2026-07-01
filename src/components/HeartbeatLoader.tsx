import { Box, Typography } from "@mui/material";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { DotLottie, DotLottieWorker } from "@lottiefiles/dotlottie-web";

// Serve the player's wasm from our own /public instead of the default CDN
// (jsdelivr/unpkg). The app runs locally/offline, so a CDN fetch would leave the
// loader blank. Set once at module load — before any instance mounts.
// DotLottieReact uses the worker variant; set both to be safe.
DotLottie.setWasmUrl("/dotlottie-player.wasm");
DotLottieWorker.setWasmUrl("/dotlottie-player.wasm");

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

/**
 * The single, app-wide loading indicator: a looping heartbeat (dotLottie).
 * Replaces MUI's CircularProgress everywhere.
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
      <DotLottieReact
        src="/heartbeat.lottie"
        loop
        autoplay
        style={{ width: size, height: size }}
      />
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
