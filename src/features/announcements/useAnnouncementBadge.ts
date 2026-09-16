import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { DASHBOARD_POLL_MS } from "@/constants/intervals";

export const ANNOUNCEMENTS_KEY = ["announcements"] as const;
export const ANNOUNCEMENT_BADGE_KEY = ["announcement-unread"] as const;

/**
 * The unread count behind each panel's Announcements badge.
 *
 * Returns the socket callback rather than subscribing itself: every useSocket()
 * call opens its own connection, and DoctorLayout already has one. Each layout
 * therefore keeps a single subscription and folds this handler into it.
 *
 * The poll is not redundant with the socket. This socket layer has no replay,
 * so an announcement published while the tab was closed arrives on the next
 * poll or window focus - the socket only makes a live one land sooner.
 */
export function useAnnouncementBadge() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ANNOUNCEMENT_BADGE_KEY,
    queryFn: async () =>
      (await axiosInstance.get("/hospital/announcements/unread-count")).data.data as { count: number },
    refetchInterval: DASHBOARD_POLL_MS,
    refetchOnWindowFocus: true,
  });

  const onAnnouncement = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ANNOUNCEMENT_BADGE_KEY });
    queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
  }, [queryClient]);

  return { unread: data?.count ?? 0, onAnnouncement };
}
