/**
 * Client-side error reporting.
 *
 * A crash in the browser used to leave no trace anywhere the team could see:
 * the ErrorBoundary called console.error, and a render error or a rejected
 * promise on a user's machine was invisible unless they said something. This
 * gives those failures one place to arrive.
 *
 * No service is wired up because none has been chosen, so the default sink
 * logs to the console — exactly what happened before. What changes is that
 * every path now reports through one function, so adopting Sentry is
 * `setErrorReporter(...)` in main.tsx rather than an audit of the whole app.
 */

export interface ClientErrorContext {
  /** Where it came from: "boundary" | "window" | "unhandledrejection" | "manual". */
  source: string;
  /** Route at the time, so a report names the screen. */
  path?: string;
  /** React's component stack, when the boundary caught it. */
  componentStack?: string;
  /**
   * The backend's x-request-id from the most recent failed API call. This is
   * the join between a user's browser error and the server log line — without
   * it, the two records of the same failure can't be matched up.
   */
  requestId?: string | null;
  role?: string | null;
  hospitalId?: string | null;
  [key: string]: unknown;
}

export type ClientErrorSink = (error: unknown, context: ClientErrorContext) => void;

let sink: ClientErrorSink | null = null;

export function setErrorReporter(next: ClientErrorSink | null): void {
  sink = next;
}

/** Session identity, read at report time so a report says who hit it. */
function identity(): { role?: string | null; hospitalId?: string | null } {
  try {
    const raw = sessionStorage.getItem("hospitalUser");
    if (!raw) return {};
    const u = JSON.parse(raw) as { role?: string; hospitalId?: string };
    return { role: u.role ?? null, hospitalId: u.hospitalId ?? null };
  } catch {
    // An unreadable session must never be the reason a crash goes unreported.
    return {};
  }
}

/**
 * The x-request-id of the last failing API response, recorded by the axios
 * interceptor. Kept as a single value rather than a history: what matters is
 * correlating the crash the user just hit.
 */
let lastFailedRequestId: string | null = null;

export function noteFailedRequestId(id: string | null | undefined): void {
  if (id) lastFailedRequestId = id;
}

export function getLastFailedRequestId(): string | null {
  return lastFailedRequestId;
}

export function reportClientError(error: unknown, context: ClientErrorContext): void {
  const full: ClientErrorContext = {
    ...identity(),
    requestId: lastFailedRequestId,
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
    ...context,
  };

  // Always console — this is what the app did before, and losing it would make
  // local debugging worse in exchange for a reporter nobody has configured yet.
  console.error(`[${full.source}]`, error, full);

  if (!sink) return;
  try {
    sink(error, full);
  } catch (sinkError) {
    console.error("Error reporter itself threw", sinkError);
  }
}

/**
 * Catch what React cannot: errors thrown outside render (event handlers, async
 * callbacks) and promise rejections nobody handled. Without these, an error
 * boundary only ever sees a fraction of what actually goes wrong.
 *
 * Call once, at startup.
 */
export function installGlobalErrorHandlers(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    // Resource load failures (a missing image) also fire this with no `error`;
    // they are not application crashes and would only add noise.
    if (!event.error) return;
    reportClientError(event.error, { source: "window" });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportClientError(event.reason, { source: "unhandledrejection" });
  });
}
