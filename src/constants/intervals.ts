// react-query polling intervals (ms). Centralized so the "live" cadence of
// queues vs. dashboards is tuned in one place instead of scattered literals.

/** Live operational screens (queues, dispensary, POS) — poll every 30s. */
export const QUEUE_POLL_MS = 30_000;

/** Dashboards / layout badges — lighter refresh, every 60s. */
export const DASHBOARD_POLL_MS = 60_000;
