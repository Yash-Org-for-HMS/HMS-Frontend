/**
 * Time-of-day greeting, shared by every panel that addresses the user by name.
 *
 * These were each written separately and each froze at whatever time of day the
 * author had in mind — the nursing station wished the night shift "Good
 * morning" at 2am, and the doctor and admin dashboards said "Welcome back"
 * whatever the hour. A hospital is staffed around the clock, so the greeting
 * has to read the clock.
 *
 * Boundaries are the ordinary English ones: morning until noon, afternoon until
 * 5pm, evening after that. Server-side wall-clock time is pinned by
 * HOSPITAL_TZ; this runs in the browser and follows the device, which is what a
 * greeting should do.
 */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * "Good morning, Priya" — the greeting with a name when there is one, and
 * without when there isn't, rather than trailing a stray comma or space. The
 * name is trimmed: a stored "R " rendered as "Good morning, R !".
 */
export function greetingFor(name?: string | null): string {
  const trimmed = (name ?? "").trim();
  return trimmed ? `${greeting()}, ${trimmed}` : greeting();
}
