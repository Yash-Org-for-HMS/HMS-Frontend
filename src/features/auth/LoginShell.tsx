import { Box, Typography } from "@mui/material";
import { ShieldOutlined } from "@mui/icons-material";
import type { ReactNode } from "react";

/**
 * Page frame for both login screens. Split from loginDesign.ts because a file
 * that exports a component alongside plain constants breaks fast refresh.
 */

interface LoginShellProps {
  /** The portal's name — the one thing that says which door you are at. */
  title: string;
  /** The line under it. */
  subtitle: string;
  /** Trailing reassurance beside the shield, e.g. "session-bound access". */
  footnote: string;
  children: ReactNode;
}

/**
 * Page frame: the soft background, the centred column, the two heading lines
 * and the shield footer. The form sits directly on the background — no card.
 */
export function LoginShell({ title, subtitle, footnote, children }: LoginShellProps) {
  return (
    <Box sx={{
      minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", px: 3, py: 6,
      backgroundImage: "url('/login.png')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat",
    }}>
      <Box sx={{ width: "100%", maxWidth: 400 }}>
        <Typography sx={{ color: "#0F172A", fontWeight: 800, fontSize: "1.7rem", letterSpacing: "-0.3px", lineHeight: 1.15, textAlign: "center" }}>
          {title}
        </Typography>
        <Typography sx={{ color: "#0F172A", fontSize: "0.95rem", textAlign: "center", mt: 0.5, mb: 3.5 }}>
          {subtitle}
        </Typography>

        {children}

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 3.5, color: "text.secondary" }}>
          <ShieldOutlined sx={{ fontSize: 15 }} />
          {/* Composed into one string rather than `Encrypted · {footnote}`: the
              JSX form emits two text nodes, and the browser kerns across the
              seam differently — a visible sub-pixel shift in the last word. */}
          <Typography variant="caption">{`Encrypted · ${footnote}`}</Typography>
        </Box>
      </Box>
    </Box>
  );
}
