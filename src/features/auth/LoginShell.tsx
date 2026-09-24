import { Box, Button } from "@mui/material";
import type { ReactNode } from "react";
import { BRAND, alpha } from "@/styles/accents";
import { loginSubmitSx, loginSubmitBusySx } from "./loginDesign";

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
 * Three dots that breathe, in the button's own white.
 *
 * Not the app's HeartbeatLoader, which is the right indicator nearly
 * everywhere else: it is a fixed-colour .lottie asset drawn for a light
 * surface, so on a saturated blue button it cannot be tinted and does not
 * read. Motion that has to be seen against the brand fill has to be made of
 * the brand fill's foreground.
 */
function BusyDots() {
  return (
    <Box component="span" aria-hidden sx={{ display: "inline-flex", gap: "4px", ml: 1 }}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          component="span"
          sx={{
            width: 5, height: 5, borderRadius: "50%", bgcolor: "#fff",
            animation: "loginDots 1.1s ease-in-out infinite",
            animationDelay: `${i * 0.16}s`,
            "@keyframes loginDots": {
              "0%, 80%, 100%": { opacity: 0.3, transform: "translateY(0)" },
              "40%": { opacity: 1, transform: "translateY(-3px)" },
            },
            // A login can be the slowest thing on the screen; nobody should
            // have to watch it bounce to know it is working.
            "@media (prefers-reduced-motion: reduce)": { animation: "none", opacity: 0.75 },
          }}
        />
      ))}
    </Box>
  );
}

/**
 * The submit button for both login screens, including what it looks like while
 * it is working. Shared rather than copied: these two pages were built as hand
 * copies of one design and drifted until one of them lost its background
 * entirely, which is the whole reason this file exists.
 */
export function LoginSubmitButton({ busy, label = "Login" }: { busy: boolean; label?: string }) {
  return (
    <Button
      fullWidth
      type="submit"
      disableElevation
      disabled={busy}
      aria-busy={busy}
      sx={[loginSubmitSx, busy && loginSubmitBusySx]}
    >
      {busy ? (
        <>
          Dolphin in action
          <BusyDots />
        </>
      ) : (
        label
      )}
    </Button>
  );
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
