import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import type { ReactNode } from "react";
import {
  TaskAltRounded,
  InboxRounded,
  SearchOffRounded,
  ErrorOutlineRounded,
  CheckCircleRounded,
} from "@mui/icons-material";
import HeartbeatLoader from "./HeartbeatLoader";
import { SEMANTIC } from "@/styles/accents";

export type MascotPose =
  | "all-caught-up"   // positive empty: nothing left to do (empty queue / no appointments)
  | "nothing-here-yet" // neutral empty: no data entered yet
  | "no-matches"      // a search returned nothing
  | "thinking"        // loading / working
  | "oops"            // error / failed to load
  | "nice-work";      // success / completed

// Clean, icon-based empty/error/success states (no illustrations). The
// "thinking" pose is a loading state, so it renders the heartbeat loader.
const POSE_META: Record<Exclude<MascotPose, "thinking">, { Icon: typeof TaskAltRounded; color: string }> = {
  "all-caught-up": { Icon: TaskAltRounded, color: SEMANTIC.success },
  "nothing-here-yet": { Icon: InboxRounded, color: "text.disabled" },
  "no-matches": { Icon: SearchOffRounded, color: "text.disabled" },
  oops: { Icon: ErrorOutlineRounded, color: SEMANTIC.danger },
  "nice-work": { Icon: CheckCircleRounded, color: SEMANTIC.success },
};

interface MascotProps {
  pose: MascotPose;
  title?: string;
  subtitle?: string;
  /** Icon size in px. Default 56. */
  size?: number;
  /** Optional call-to-action rendered below the text (e.g. an "Add" button). */
  action?: ReactNode;
  sx?: SxProps<Theme>;
}

/**
 * Placeholder for empty / error / success states: a single icon with an
 * optional title and subtitle. (Loading is handled by HeartbeatLoader, used
 * here for the "thinking" pose.) Drop it anywhere a placeholder is needed.
 */
export default function Mascot({ pose, title, subtitle, size = 56, action, sx }: MascotProps) {
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
      {pose === "thinking" ? (
        <HeartbeatLoader size={Math.max(size, 88)} />
      ) : (
        (() => {
          const { Icon, color } = POSE_META[pose];
          return <Icon sx={{ fontSize: size, color }} />;
        })()
      )}
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
      {action && <Box sx={{ mt: 1.5 }}>{action}</Box>}
    </Box>
  );
}
