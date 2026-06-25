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
  const { data } = useQuery({
    queryKey: ["enabled-modules"],
    queryFn: async () =>
      (await axiosInstance.get("/hospital/module-access")).data.data as {
        enabledModules: string[];
        planModules: string[];
      },
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
