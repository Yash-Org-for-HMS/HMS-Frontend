import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../api/axios";

/**
 * The modules enabled for the logged-in hospital user, used to hide nav items
 * for modules the hospital doesn't have. The backend is the real gate (it 403s
 * disabled-module routes); this is purely UX so users don't see dead links.
 *
 * Fail-open: while loading, or if the call errors, items are NOT hidden — we
 * never hide a working feature on a transient fetch issue; the API still
 * enforces. Only once we know a module is disabled do we hide it.
 */
export function useEnabledModules() {
  // Only probe module access when there's a hospital session. This hook is
  // pulled in by the globally-mounted CommandPalette, which renders on the
  // super-admin portal too — without this gate the query fires a hospital-realm
  // request with no hospital token, 401s, and the axios interceptor hard-
  // redirects the whole window to /hospital/login (bouncing you off the
  // super-admin portal).
  const hasHospitalSession =
    typeof window !== "undefined" && !!sessionStorage.getItem("hospitalAccessToken");

  const { data } = useQuery({
    queryKey: ["enabled-modules"],
    queryFn: async () =>
      (await axiosInstance.get("/hospital/module-access")).data.data as {
        enabledModules: string[];
        planModules: string[];
      },
    enabled: hasHospitalSession,
    staleTime: 5 * 60 * 1000,
  });

  const enabled = new Set(data?.enabledModules ?? []);
  return {
    loaded: !!data,
    enabledModules: enabled,
    /** True if the item should be shown. No module tag → always shown. */
    isModuleEnabled: (moduleKey?: string) => !moduleKey || !data || enabled.has(moduleKey),
  };
}
