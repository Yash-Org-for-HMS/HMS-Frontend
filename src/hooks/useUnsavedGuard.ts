import { useEffect } from "react";

/**
 * Warn before losing unsaved form edits. While `dirty` is true, a native
 * "Leave site? Changes you made may not be saved." prompt fires on tab close,
 * refresh, or navigation away from the app.
 *
 * NOTE: this covers browser-level unloads (close/refresh/external nav). It does
 * NOT intercept in-app SPA navigation (clicking a sidebar link) — react-router's
 * `useBlocker` needs a data router (createBrowserRouter) and this app uses
 * <BrowserRouter>. For in-app exits, pair this with a confirm on the form's own
 * Cancel/Back button.
 */
export function useUnsavedGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy requirement for the native prompt in some browsers.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
