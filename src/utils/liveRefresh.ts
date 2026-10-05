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
