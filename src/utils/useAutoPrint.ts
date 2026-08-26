import { useEffect } from "react";

/**
 * Open the print dialog once a print page has actually finished rendering.
 *
 * The print ROUTES (IP bill, lab report, consent, subscription invoice) each
 * fired `setTimeout(() => window.print(), 500)` as soon as their data arrived.
 * 500ms is plenty on a dev machine where fonts are warm and the logo is in
 * cache, and it is a guess everywhere else: on a real deployment the dialog can
 * open over a page whose webfont has not swapped in or whose hospital logo has
 * not painted, which prints wrong — or, worse, prints a page that is still
 * blank.
 *
 * So this waits for the things that actually change what the page looks like —
 * fonts settling and images finishing — rather than for a fixed number of
 * milliseconds, with a cap so a hanging image can never leave a print button
 * that does nothing. Same trade printHtml makes: late and correct beats fast
 * and wrong, and never printing is the worst outcome of the three.
 */

/** Longest we wait for fonts and images before printing anyway. */
const READY_CAP_MS = 5000;

function whenPainted(): Promise<void> {
  const fonts = document.fonts?.ready?.then(() => undefined) ?? Promise.resolve();

  const images = Promise.all(
    Array.from(document.images)
      // `complete` covers cached and already-failed images alike.
      .filter((img) => !img.complete)
      .map(
        (img) =>
          new Promise<void>((resolve) => {
            // An image that 404s must cost its picture, not the whole print —
            // the hospital logo is served from ephemeral storage on the test
            // deployment and legitimately goes missing.
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
      ),
  ).then(() => undefined);

  const settled = Promise.all([fonts, images]).then(() => undefined);
  const capped = new Promise<void>((resolve) => { setTimeout(resolve, READY_CAP_MS); });

  return Promise.race([settled, capped]).then(
    () =>
      // One more frame so the layout produced by the newly-swapped font is on
      // screen before the dialog snapshots it.
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

/**
 * @param ready true once the page has its data and has rendered the document.
 */
export function useAutoPrint(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void whenPainted().then(() => {
      // The tab can be closed, or the component unmounted, while we waited.
      if (!cancelled) window.print();
    });
    return () => { cancelled = true; };
  }, [ready]);
}
