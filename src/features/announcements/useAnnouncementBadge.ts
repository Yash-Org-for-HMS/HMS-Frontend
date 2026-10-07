import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { ANNOUNCEMENT_FALLBACK_MS, DASHBOARD_POLL_MS } from "@/constants/intervals";
import { useLiveConnected } from "@/hooks/useSocket";

export const ANNOUNCEMENTS_KEY = ["announcements"] as const;
export const ANNOUNCEMENT_BADGE_KEY = ["announcement-unread"] as const;
/** What the hospital itself has announced (admins' "Sent by this hospital"). */
export const SENT_ANNOUNCEMENTS_KEY = ["hospital-announcements-sent"] as const;

/**
 * How long until the badge asks again: just past `nextAt` when the server
 * named one (a second past, so the server agrees it has arrived; never a tight
 * loop), and never longer than the fallback.
 */
export function nextBadgeAskIn(nextAt: string | null | undefined, now = Date.now(), fallback = ANNOUNCEMENT_FALLBACK_MS): number {
  if (!nextAt) return fallback;
  const wait = new Date(nextAt).getTime() - now + 1_000;
  return Math.min(fallback, Math.max(5_000, wait));
}

/**
 * The unread count behind each panel's Announcements badge.
 *
 * Returns the socket callback rather than subscribing itself: every useSocket()
 * call opens its own connection, and DoctorLayout already has one. Each layout
 * therefore keeps a single subscription and folds this handler into it.
 *
 * It asks when something changes, not every minute in case:
 *  - the socket's ANNOUNCEMENT_PUBLISHED nudge (published or withdrawn), and its
 *    connect event — which also covers a dropped connection, since this socket
 *    layer has no replay;
 *  - the moment the count changes by itself, which the server sends as nextAt
 *    (a scheduled one going live, an unread one running out) — nothing is
 *    pushed then;
 *  - window focus, and a slow fallback in case all of those are missed.
 */
export function useAnnouncementBadge() {
  const queryClient = useQueryClient();
  // The slow fallback is for a live tab, which is told when something is
  // published. With the live connection down nothing tells it, so it asks every
  // minute, like every other screen (it waited 15 minutes either way).
  const live = useLiveConnected();

  const { data } = useQuery({
    queryKey: ANNOUNCEMENT_BADGE_KEY,
    queryFn: async () =>
      (await axiosInstance.get("/hospital/announcements/unread-count")).data.data as { count: number; nextAt?: string | null },
    refetchInterval: (query) => nextBadgeAskIn(query.state.data?.nextAt, Date.now(), live ? ANNOUNCEMENT_FALLBACK_MS : DASHBOARD_POLL_MS),
    refetchOnWindowFocus: true,
  });

  const onAnnouncement = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ANNOUNCEMENT_BADGE_KEY });
    queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
  }, [queryClient]);

  // For the socket's connect event. The first connect lands a moment after the
  // badge's own first ask, and asking again then was a second call on every
  // page load. A reconnect — or a first connect long after that ask — may have
  // missed a nudge while it was down, so that one asks.
  const onConnect = useCallback(() => {
    const state = queryClient.getQueryState(ANNOUNCEMENT_BADGE_KEY);
    if (state?.fetchStatus === "fetching") return;
    if (state && Date.now() - state.dataUpdatedAt < 10_000) return;
    onAnnouncement();
  }, [queryClient, onAnnouncement]);

  return { unread: data?.count ?? 0, onAnnouncement, onConnect };
}
