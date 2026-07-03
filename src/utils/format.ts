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
