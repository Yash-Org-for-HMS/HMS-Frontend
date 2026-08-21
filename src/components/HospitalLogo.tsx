import { useId } from "react";
import { BRAND } from "@/styles/accents";

/**
 * The mark shown for a hospital that has not uploaded its own logo.
 *
 * The fallback used to be a flat indigo SQUARE with a generic MUI hospital glyph
 * dropped in it — plainly a placeholder, and a square tile reads as "image
 * failed to load" rather than as a brand. This is a round badge instead: a
 * medical cross in a soft indigo gradient with a faint inner ring, so it keeps
 * its silhouette against both the light and the dark sidebar.
 *
 * Inline SVG rather than a shipped PNG: sharp at 24px and at 200px, no network
 * request, no asset pipeline, and it inherits the brand colours rather than
 * baking them into a file that goes stale when the palette moves.
 *
 * Deliberately NOT used on printed bills, prescriptions or lab reports. Those
 * carry the hospital's own logo or none: a generic mark on a patient's legal
 * document implies a brand the hospital never chose.
 */

// One rounded path rather than two crossing bars — overlapping rectangles go
// blocky at the inner corners at sidebar size, where this is mostly seen.
const CROSS_PATH =
  "M20.6 11.4h6.8a2 2 0 0 1 2 2v5.2h5.2a2 2 0 0 1 2 2v6.8a2 2 0 0 1-2 2h-5.2v5.2a2 2 0 0 1-2 2h-6.8a2 2 0 0 1-2-2v-5.2h-5.2a2 2 0 0 1-2-2v-6.8a2 2 0 0 1 2-2h5.2v-5.2a2 2 0 0 1 2-2z";

export default function HospitalLogo({
  size = 40,
  title = "Hospital",
}: {
  size?: number;
  /** Accessible name; pass the hospital's name where it is known. */
  title?: string;
}) {
  // Two of these on one page would otherwise share a gradient id and the second
  // would inherit the first's colours. useId is stable per instance and, unlike
  // a module counter, mutates nothing during render. Its value carries colons,
  // which url(#…) references handle unreliably, so they come out.
  const gid = `hospital-logo-${useId().replace(/:/g, "")}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={BRAND.action} />
          <stop offset="100%" stopColor={BRAND.actionDark} />
        </linearGradient>
      </defs>

      <circle cx="24" cy="24" r="23" fill={`url(#${gid})`} />
      {/* A hairline inside the edge keeps the badge from dissolving into a dark
          sidebar, where a flat disc of brand colour loses its silhouette. */}
      <circle cx="24" cy="24" r="21.25" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="1.5" />
      <path d={CROSS_PATH} fill="#ffffff" />
    </svg>
  );
}
