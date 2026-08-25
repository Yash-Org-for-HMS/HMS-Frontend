/**
 * Wording for the subscription grace-period countdown.
 *
 * Three super-admin screens show the same deadline — the Action Needed list, a
 * tenant's overview, and the invoice console — and they must not each invent
 * their own phrasing for it. The server owns the arithmetic (one grace-days
 * constant, floored); this owns only how the number reads.
 *
 * `days` is floored server-side, so 0 means access goes today and a negative
 * number means it already should have — the tenant is still listed because
 * suspension only bites at their next sign-in or token refresh.
 */

/** Sentence form, for a row's secondary line. */
export function graceText(days: number | null | undefined): string {
  if (days == null) return "suspends after the grace period";
  if (days < 0) return `grace ended ${plural(Math.abs(days))} ago — access blocked at next sign-in`;
  if (days === 0) return "suspends today";
  return `suspends in ${plural(days)}`;
}

/** Chip form, where the surrounding status already says what is being counted. */
export function graceShort(days: number | null | undefined): string | null {
  if (days == null) return null;
  if (days < 0) return "grace ended";
  if (days === 0) return "last day";
  return `${plural(days)} left`;
}

function plural(n: number): string {
  return `${n} day${n === 1 ? "" : "s"}`;
}
