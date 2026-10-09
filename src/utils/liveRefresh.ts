import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * For a socket's connect event: ask again, unless the answer on screen is only
 * seconds old. The first connect lands a moment after the screen's own first
 * ask — repeating it was a second call on every load. A reconnect after a drop
 * may have missed changes while it was down, so that one asks.
 */
export function refetchUnlessFresh(queryClient: QueryClient, queryKey: QueryKey, withinMs = 10_000): void {
  // Every query under the key — a paged list is ["lab-orders-queue", tab, page].
  const queries = queryClient.getQueryCache().findAll({ queryKey });
  if (queries.some((q) => q.state.fetchStatus === "fetching" || Date.now() - q.state.dataUpdatedAt < withinMs)) return;
  void queryClient.invalidateQueries({ queryKey });
}

/**
 * Whether a QUEUE_UPDATED event is about one of these kinds of work. The server
 * tags each event (lib/realtime.ts): "opd" the outpatient flow, "lab" lab and
 * radiology work, "billing" a test or scan paid for. An untagged event — an
 * older server — concerns every screen, so nothing is ever missed.
 */
export function queueEventConcerns(payload: unknown, ...areas: string[]): boolean {
  const area = (payload as { area?: string } | undefined)?.area;
  return !area || areas.includes(area);
}

/** Whether a QUEUE_UPDATED event concerns the outpatient flow. */
export const isOpdQueueEvent = (payload: unknown): boolean => queueEventConcerns(payload, "opd");

/**
 * An event about ANOTHER doctor's patient: the server names the doctor
 * (doctorUserId) when a change concerns exactly one, and a doctor's own screens
 * — their queue, badges, dashboard — skip the rest. Without it every online
 * doctor refetched for every other doctor's check-in, call and vitals. An event
 * that names no doctor concerns everyone.
 */
export function isAboutAnotherDoctor(payload: unknown, myUserId: string | undefined): boolean {
  const doctorUserId = (payload as { doctorUserId?: string } | undefined)?.doctorUserId;
  return Boolean(doctorUserId && myUserId && doctorUserId !== myUserId);
}

/**
 * The screens that refresh only when told (bed board, reservations, free beds,
 * ward indents, co-sign) — no polling behind them. A change made while the live
 * connection was down (a redeploy, a dropped network) was never heard, and those
 * screens stayed wrong until someone navigated away. Every layout calls this on
 * (re)connecting; whatever was fetched moments ago is left alone.
 */
const EVENT_ONLY_KEYS: QueryKey[] = [["ipd-structure"], ["ipd-reservations"], ["ipd-available-beds"], ["ward-indents"], ["ward-round-cosign"]];
export function catchUpEventOnlyScreens(queryClient: QueryClient): void {
  for (const key of EVENT_ONLY_KEYS) refetchUnlessFresh(queryClient, key);
}
