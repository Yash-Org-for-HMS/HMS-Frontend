import { useCallback } from "react";
import { useToast } from "@/providers/ToastContext";

/**
 * Open one of the print pages in a new tab, and say so when the browser won't.
 *
 * Seven print buttons called `window.open(...)` and ignored what came back. A
 * blocked pop-up returns null, so the button did nothing at all — no tab, no
 * error, no clue. "I click print and nothing happens" is exactly what that
 * looks like.
 *
 * It reproduces as a localhost-versus-deployed difference because pop-up
 * permission is stored PER ORIGIN: a browser that has learned to allow
 * localhost:5173 knows nothing about the deployed site, so the same build
 * prints in development and silently refuses in production.
 *
 * The tab is opened synchronously inside the click handler on purpose — a
 * pop-up survives only while the browser still considers the click to be
 * driving it, so anything awaited first is blocked outright.
 */
export function usePrintWindow(): (path: string) => boolean {
  const toast = useToast();

  return useCallback(
    (path: string) => {
      const win = window.open(path, "_blank");
      // null is the usual signal; some blockers hand back a window that closes
      // immediately instead.
      if (!win || win.closed) {
        toast.error("Your browser blocked the print tab. Allow pop-ups for this site, then try again.");
        return false;
      }
      return true;
    },
    [toast],
  );
}
