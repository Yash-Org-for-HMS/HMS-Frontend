// react-query polling intervals (ms). Centralized so the "live" cadence of
// queues vs. dashboards is tuned in one place instead of scattered literals.

/** Live operational screens (queues, dispensary, POS) — poll every 30s. */
export const QUEUE_POLL_MS = 30_000;

/**
 * A queue screen whose live connection is up — every 2 minutes. It is told about
 * each change as it happens (QUEUE_UPDATED), so this is only a safety net; while
 * the connection is down it polls at QUEUE_POLL_MS as before.
 */
export const QUEUE_LIVE_FALLBACK_MS = 2 * 60_000;

/** Dashboards / layout badges — lighter refresh, every 60s. */
export const DASHBOARD_POLL_MS = 60_000;

/**
 * The hospital admin dashboard — every 5 minutes. Its figures are the day's
 * running totals, not a queue someone is working through, and a page left open
 * all day asking once a minute was most of the panel's database load. It also
 * asks again whenever the tab comes back, and has a Refresh button.
 */
export const ADMIN_DASHBOARD_REFRESH_MS = 5 * 60_000;

/**
 * The Announcements badge's safety net — every 15 minutes. It is told about
 * changes over the socket and asks again at the moment a scheduled one goes
 * live (useAnnouncementBadge), so this only matters if both are missed.
 */
export const ANNOUNCEMENT_FALLBACK_MS = 15 * 60_000;
