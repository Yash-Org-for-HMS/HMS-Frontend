// Shared formatting helpers. Previously these were re-implemented per file
// (₹ currency ~8×, HTML stripping ×2, name initials ×3); centralised here so
// the formatting rules live in one place.

/**
 * Format a number as Indian Rupees. `decimals` fixes both the minimum and
 * maximum fraction digits (default 2). Null/undefined is treated as 0.
 */
export function formatINR(amount: number | null | undefined, decimals = 2): string {
  return `₹${Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
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

/**
 * Format a date as a short Indian-locale date (e.g. "16/07/2026") — the same
 * `new Date(x).toLocaleDateString("en-IN")` that was inlined across the invoice,
 * appointment and patient list views. Accepts a Date, timestamp, or date string.
 */
export function formatDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString("en-IN");
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
