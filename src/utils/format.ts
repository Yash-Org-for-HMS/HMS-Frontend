// Shared formatting helpers. Previously these were re-implemented per file
// (₹ currency ~8×, HTML stripping ×2, name initials ×3); centralised here so
// the formatting rules live in one place.

/**
 * Format a number as Indian Rupees. `decimals` fixes both the minimum and
 * maximum fraction digits (default 2). Null/undefined is treated as 0.
 */
export function formatINR(amount: number | string | null | undefined, decimals = 2): string {
  return `₹${Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * ₹ with natural precision (0–3 fraction digits) — exactly the bare
 * `toLocaleString("en-IN")` that the report/dashboard views inlined. Use this
 * when trailing ".00" on whole amounts is undesirable; use {@link formatINR}
 * (with a `decimals` arg) when you need fixed 2dp.
 */
export function formatINRAuto(amount: number | string | null | undefined): string {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

/**
 * Age in whole years from a date of birth. Returns null for a missing/invalid
 * value. Uses 365.25 days/year (the formula previously inlined at the patient
 * headers). Accepts a Date, timestamp, or date string.
 */
export function calculateAge(dob?: string | number | Date | null): number | null {
  if (!dob) return null;
  const t = new Date(dob).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24 * 365.25));
}

const DATE_FMT: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };

/**
 * Format a date as "16 Jul 2026" — the one date format in the app.
 *
 * Named month rather than a numeric one, and the locale pinned rather than left
 * to the browser. Both matter: a bare `toLocaleDateString()` follows whatever
 * locale the user's browser reports, so the same medicine expiry rendered
 * `21/2/2027` for a receptionist on en-IN and `2/21/2027` for one on en-US —
 * with `02/03/2027` meaning two different days on two screens. A month name
 * cannot be misread whichever way the reader is used to.
 *
 * Accepts a Date, timestamp, or date string.
 */
export function formatDate(value: string | number | Date): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", DATE_FMT);
}

/**
 * "Thursday, 22 August 2026" — the spelled-out form for a dashboard's date
 * line. Pinned to en-IN like the rest; this one had been hardcoded to en-US,
 * which put the month before the day on an Indian hospital's screen.
 */
export function formatLongDate(value: string | number | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** The same date with a time beside it — "16 Jul 2026, 02:05 pm". */
export function formatDateTime(value: string | number | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { ...DATE_FMT, hour: "2-digit", minute: "2-digit", hour12: true });
}

/**
 * Strip HTML tags, decode the common named/numeric entities, and collapse
 * whitespace to a single-line plain string. Used to render rich-text SOAP notes
 * and template previews as plain text.
 */
export function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Two-letter initials from a first/last name, uppercased. Falls back to
 * `fallback` (default "P") when no name is available.
 */
export function getInitials(firstName?: string | null, lastName?: string | null, fallback = "P"): string {
  const f = firstName?.charAt(0) || "";
  const l = lastName?.charAt(0) || "";
  return (f + l).toUpperCase() || fallback;
}
