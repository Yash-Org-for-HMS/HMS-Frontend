import { useLocation } from "react-router-dom";

/**
 * Which panel this screen is currently mounted under.
 *
 * The IPD and theatre screens are shared: the same bed board and operating list
 * are reachable from reception, from the nurse panel, and read-only from
 * hospital admin. Anything that links onward has to stay inside the panel the
 * user is already in, or a nurse clicking a case lands in reception's copy and
 * loses her own sidebar.
 *
 * Taken from the URL rather than from the role, because a user can legitimately
 * have access to more than one panel and the URL is what they actually came in
 * through.
 */
export function usePanelBase(): string {
  const { pathname } = useLocation();
  const first = pathname.split("/").filter(Boolean)[0];
  return first ? `/${first}` : "/reception";
}

/** True when this screen is being shown inside the nurse panel. */
export function useIsNursePanel(): boolean {
  return usePanelBase() === "/nurse";
}
