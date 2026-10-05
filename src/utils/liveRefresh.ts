import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * For a socket's connect event: ask again, unless the answer on screen is only
 * seconds old. The first connect lands a moment after the screen's own first
 * ask — repeating it was a second call on every load. A reconnect after a drop
 * may have missed changes while it was down, so that one asks.
 */
export function refetchUnlessFresh(queryClient: QueryClient, queryKey: QueryKey, withinMs = 10_000): void {
  const state = queryClient.getQueryState(queryKey);
  if (state?.fetchStatus === "fetching") return;
  if (state && Date.now() - state.dataUpdatedAt < withinMs) return;
  void queryClient.invalidateQueries({ queryKey });
}

/**
 * Whether a QUEUE_UPDATED event concerns the outpatient flow. The server tags
 * lab and radiology work "lab" (lib/realtime.ts); an untagged event — an older
 * server — counts as relevant, so nothing is ever missed.
 */
export const isOpdQueueEvent = (payload: unknown): boolean =>
  (payload as { area?: string } | undefined)?.area !== "lab";
