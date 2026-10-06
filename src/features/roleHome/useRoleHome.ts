import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "@/api/axios";
import { useLiveConnected } from "@/hooks/useSocket";
import { DASHBOARD_POLL_MS, LIVE_DASHBOARD_FALLBACK_MS } from "@/constants/intervals";

/**
 * A role's home screen data (backend modules/roleHome). Asked for on open, when
 * the tab comes back, and every 5 minutes while the panel is live (60s while it
 * is not) — the same cadence as the other dashboards. The page says how old the
 * figures are and has a Refresh button.
 */
export function useRoleHome<T>(endpoint: "admission-desk" | "billing" | "tpa" | "mrd" | "ward-incharge" | "nursing-admin" | "ward-round", enabled = true) {
  const live = useLiveConnected();
  return useQuery<T>({
    queryKey: ["role-home", endpoint],
    queryFn: async () => (await axiosInstance.get(`/role-home/${endpoint}`)).data.data,
    enabled,
    refetchOnWindowFocus: true,
    refetchInterval: live ? LIVE_DASHBOARD_FALLBACK_MS : DASHBOARD_POLL_MS,
  });
}
