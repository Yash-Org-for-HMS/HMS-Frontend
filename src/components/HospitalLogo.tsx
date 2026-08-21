import { useId, useState } from "react";
import { BRAND } from "@/styles/accents";
import { assetUrl } from "@/utils/assetUrl";

/**
 * A hospital's logo, or the default mark when there isn't one.
 *
 * Two separate cases end up here and both must land on the mark:
 *
 *   No logo was ever uploaded. The old fallback was a flat indigo SQUARE with a
 *   generic MUI glyph in it, which reads as "image failed to load" rather than
 *   as a brand.
 *
 *   A logo WAS uploaded but the file is not there any more. The deployment host
 *   has an ephemeral filesystem, so anything written to /uploads is gone on the
 *   next deploy while logoUrl stays in the database — the row says there is a
 *   logo and the request 404s. Without an onError the browser draws its own
 *   broken-image glyph, which is worse than either outcome.
 *
 * So the image is attempted and the mark takes over the moment it fails. The
 * decision lives in this one component rather than at each call site, so the
 * sidebar and the profile preview cannot disagree about what "no logo" looks
 * like.
 *
 * Deliberately NOT used on printed bills, prescriptions or lab reports. Those
 * carry the hospital's own logo or nothing: a generic mark on a patient's legal
 * document implies a brand the hospital never chose.
 */

// One rounded path rather than two crossing bars — overlapping rectangles go
// blocky at the inner corners at sidebar size, where this is mostly seen.
const CROSS_PATH =
  "M20.6 11.4h6.8a2 2 0 0 1 2 2v5.2h5.2a2 2 0 0 1 2 2v6.8a2 2 0 0 1-2 2h-5.2v5.2a2 2 0 0 1-2 2h-6.8a2 2 0 0 1-2-2v-5.2h-5.2a2 2 0 0 1-2-2v-6.8a2 2 0 0 1 2-2h5.2v-5.2a2 2 0 0 1 2-2z";

export default function HospitalLogo({
  src,
  size = 40,
  title = "Hospital",
  radius = 1.5,
}: {
  /** The hospital's stored logo path. Falls back to the mark if absent or broken. */
  src?: string | null;
  size?: number;
  /** Accessible name; pass the hospital's name where it is known. */
  title?: string;
  /** Corner rounding (in MUI spacing units) applied to an uploaded logo only. */
  radius?: number;
}) {
  const [broken, setBroken] = useState(false);
  // Two of these on one page would otherwise share a gradient id and the second
  // would inherit the first's colours. useId is stable per instance and, unlike
  // a module counter, mutates nothing during render. Its value carries colons,
  // which url(#…) references handle unreliably, so they come out.
  const gid = `hospital-logo-${useId().replace(/:/g, "")}`;

  const resolved = src ? assetUrl(src) : "";

  if (resolved && !broken) {
    return (
      <img
        src={resolved}
        alt={`${title} logo`}
        width={size}
        height={size}
        // The file can be missing without the record knowing — see above.
        onError={() => setBroken(true)}
        style={{
          width: size,
          height: size,
          objectFit: "cover",
          borderRadius: `${radius * 8}px`,
          display: "block",
          flexShrink: 0,
        }}
      />
    );
  }

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
