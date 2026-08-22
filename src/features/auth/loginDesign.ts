/**
 * The one login design, shared by the hospital staff portal and the platform
 * admin console.
 *
 * These two pages were built as separate copies of the same layout and then
 * drifted: the platform button quietly lost its `bgcolor`, leaving a white
 * label on a near-white page at 1.10:1, and all three auth screens kept
 * pointing at a `/login.jpg` that does not exist. Both are the same failure —
 * a design duplicated by hand is a design that only gets fixed in one place.
 *
 * So the visual decisions live here and the pages supply only what genuinely
 * differs between them: their name, their fields, and which endpoint they post
 * to. Anything that should look the same on both belongs in this file.
 */

/** The single accent: focus rings, field icons, links. */
export const LOGIN_ACCENT = "#0891b2";
/**
 * The submit button is solid ink rather than the accent — the strongest
 * contrast available for the primary action, per the reference login card.
 */
const INK = "#111827";
const INK_DARK = "#000000";

/**
 * Pill-shaped, near-borderless fields: soft neutral fill, fully rounded, colour
 * reserved for focus and errors. Placeholder-only — no floating label — so the
 * pages must pass an `aria-label` on every input.
 */
export const loginFieldSx = {
  mb: 0.5,
  "& .MuiOutlinedInput-root": {
    borderRadius: "999px",
    backgroundColor: "#F5F5F7",
    transition: "box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease",
    // A visible-but-subtle border at rest — the fill alone read as invisible
    // against a similarly light page background.
    "& fieldset": { borderColor: "rgba(15,23,42,0.16)" },
    "&:hover fieldset": { borderColor: "rgba(15,23,42,0.30)" },
    "&.Mui-focused": { backgroundColor: "#fff" },
    "&.Mui-focused fieldset": { borderColor: LOGIN_ACCENT, borderWidth: "1.5px", boxShadow: `0 0 0 4px ${LOGIN_ACCENT}1a` },
    "&.Mui-error fieldset": { borderColor: "#ef4444" },
  },
  "& .MuiOutlinedInput-input": { paddingTop: "14.5px", paddingBottom: "14.5px" },
  "& .MuiOutlinedInput-root.Mui-focused .field-lead-icon": { color: LOGIN_ACCENT },
} as const;

/**
 * The submit button. `bgcolor` is not decoration here: no `variant` is passed,
 * so this is a MUI TEXT button and without a background the white label sits on
 * the page's near-white ground and disappears.
 */
export const loginSubmitSx = {
  py: 1.5,
  fontWeight: 700,
  fontSize: "0.98rem",
  textTransform: "none",
  borderRadius: 999,
  color: "#fff",
  bgcolor: INK,
  "&:hover": { bgcolor: INK_DARK },
  "&.Mui-disabled": { bgcolor: "rgba(15,23,42,0.12)", color: "rgba(15,23,42,0.4)" },
  transition: "background-color 0.2s ease",
} as const;

export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
