import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";

// Mascot doodles live in src/Doodle (added by the design side). One pose per
// UI state so empty/loading/error/success screens share a single character.
import allCaughtUp from "../Doodle/all-caught-up.png";
import niceWork from "../Doodle/nice-work.png";
import noMatches from "../Doodle/no-matches.png";
import nothingHereYet from "../Doodle/nothing-here-yet.png";
import oops from "../Doodle/oops.png";
import thinking from "../Doodle/thinking-loading.png";

export type MascotPose =
  | "all-caught-up"   // positive empty: nothing left to do (empty queue / no appointments)
  | "nothing-here-yet" // neutral empty: no data entered yet
  | "no-matches"      // a search returned nothing
  | "thinking"        // loading / working
  | "oops"            // error / failed to load
  | "nice-work";      // success / completed

const POSE_SRC: Record<MascotPose, string> = {
  "all-caught-up": allCaughtUp,
  "nothing-here-yet": nothingHereYet,
  "no-matches": noMatches,
  thinking,
  oops,
  "nice-work": niceWork,
};

interface MascotProps {
  pose: MascotPose;
  title?: string;
  subtitle?: string;
  /** Image width in px. Default 160. */
  size?: number;
  sx?: SxProps<Theme>;
}

/**
 * Renders a mascot doodle for an empty/loading/error/success state, with an
 * optional title and subtitle. Drop it anywhere a placeholder is needed.
 */
export default function Mascot({ pose, title, subtitle, size = 160, sx }: MascotProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 1,
        py: 4,
        ...sx,
      }}
    >
      <Box
        component="img"
        src={POSE_SRC[pose]}
        alt={title || pose}
        sx={{
          width: size,
          height: "auto",
          maxWidth: "100%",
          userSelect: "none",
          pointerEvents: "none",
          // The doodles ship with a solid light background. On a light theme,
          // `multiply` lets that background blend into whatever surface sits
          // behind it (white cards, the gray page, tinted panels) so the image
          // no longer reads as a mismatched rectangle.
          mixBlendMode: "multiply",
        }}
      />
      {title && (
        <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>
          {title}
        </Typography>
      )}
      {subtitle && (
        <Typography variant="body2" sx={{ color: "text.secondary", maxWidth: 360 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}
