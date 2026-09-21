import { Box } from "@mui/material";
import type { ReactNode } from "react";
import { BRAND, alpha } from "@/styles/accents";

/**
 * Page frame for both login screens. Split from loginDesign.ts because a file
 * that exports a component alongside plain constants breaks fast refresh.
 */

interface LoginShellProps {
  /** The portal's name — the one thing that says which door you are at. */
  title: string;
  children: ReactNode;
}

/**
 * Page frame: the soft background, the centred column, the mark and the portal
 * badge. The form sits directly on the background — no card.
 */
export function LoginShell({ title, children }: LoginShellProps) {
  return (
    <Box sx={{
      minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", px: 3, py: 6,
      backgroundImage: "url('/login.png')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat",
    }}>
      <Box sx={{ width: "100%", maxWidth: 400 }}>
        {/* The one screen every user meets before they are anyone, so it is the
            one that has to say whose software this is. Above the portal name,
            not beside it: the product is the constant, the portal is the door.

            mb is 3.5 against the badge's 3 so the two GAPS match, not the two
            numbers: the field below carries 8px of dense-margin of its own, and
            this PNG carries about 3px of transparent canvas under the mark. */}
        <Box
          component="img"
          src="/Dolphin_logo_blue.png"
          alt="Dolphin Hospital Management System"
          sx={{ width: 248, height: "auto", display: "block", mx: "auto", mb: 3.5 }}
        />

        {/* The portal name is a LABEL, not a headline: its whole job is to say
            which of two doors you are at, and it was set as a 1.7rem/800 title
            competing with the wordmark for the same job. A pill states it in
            one glance and echoes the rounded fields and button below, so the
            column reads as one designed set rather than a heading stack. */}
        <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
          <Box
            component="span"
            sx={{
              px: 1.75, py: 0.65, borderRadius: 999,
              bgcolor: alpha(BRAND.action, 0.09),
              border: "1px solid", borderColor: alpha(BRAND.action, 0.18),
              color: BRAND.action,
              fontSize: "0.75rem", fontWeight: 700, letterSpacing: "1.1px",
              textTransform: "uppercase", lineHeight: 1.4, whiteSpace: "nowrap",
            }}
          >
            {title}
          </Box>
        </Box>

        {children}

      </Box>
    </Box>
  );
}
