/**
 * Print a fragment of the app through a hidden iframe.
 *
 * Two production-only traps, both invisible in `npm run dev`, which is why the
 * seven hand-rolled copies of this all printed unstyled pages once built:
 *
 *   Emotion switches to CSSOM `insertRule()` in production, leaving the
 *   <style data-emotion> tags EMPTY in the DOM — `outerHTML` copies nothing.
 *   So rules are read off `sheet.cssRules`, not the tag's text.
 *
 *   Vite emits app CSS as an external <link> in a build but injects it via JS
 *   in dev. A cloned <link> must be fetched before it applies, so print() waits
 *   for the iframe to be ready rather than firing on a timer.
 */

/**
 * Undo the parts of the app's own baseline that only make sense on screen.
 *
 * Carrying the real CSS across brings MUI's CssBaseline with it, and that paints
 * the app's grey page background — invisible on most printers, which drop
 * backgrounds by default, but a full grey sheet for anyone who has "background
 * graphics" switched on. Written before `extraCss` so a caller can still override.
 */
const PAGE_RESET = "html,body{background:#fff}";

/** How long to wait for the iframe's stylesheets and fonts before printing anyway. */
const READY_CAP_MS = 3000;
/** How long to leave the iframe in the DOM after printing, if onafterprint never fires. */
const CLEANUP_MS = 1000;

/**
 * The document's CSS as markup safe to write into another document, in cascade
 * order.
 *
 * <link> elements are copied verbatim: their URLs resolve against the
 * stylesheet's own location, which re-serialising the rules would not preserve.
 * A <style> is copied verbatim too when it actually contains text — only when
 * the tag is empty are its rules read from the CSSOM, which is the Emotion case
 * above and a no-op everywhere else.
 */
function collectHeadCss(): string {
  const parts: string[] = [];
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
    if (el.tagName === "LINK") {
      parts.push(el.outerHTML);
      return;
    }
    const style = el as HTMLStyleElement;
    if (style.textContent?.trim()) {
      parts.push(style.outerHTML);
      return;
    }
    try {
      const rules = Array.from(style.sheet?.cssRules ?? [])
        .map((r) => r.cssText)
        .join("\n");
      if (rules) parts.push(`<style>${rules}</style>`);
    } catch {
      // A sheet we are not allowed to read; nothing to recover here.
    }
  });
  return parts.join("");
}

/**
 * Resolves once the iframe's stylesheets have loaded and its fonts have settled
 * — or once the cap expires, whichever comes first.
 *
 * The cap is the important half: a stylesheet that 404s or a font server that
 * hangs must not leave the user pressing a Print button that does nothing. Late
 * and correct is the goal; never printing is worse than printing plain.
 */
function whenReady(doc: Document): Promise<void> {
  const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
  const loaded = links.map(
    (link) =>
      // `.sheet` is populated the moment the file has arrived and parsed, so a
      // sheet already cached needs no listener at all.
      link.sheet
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            link.addEventListener("load", () => resolve(), { once: true });
            // An error still resolves: one missing sheet should cost its styles,
            // not the whole print.
            link.addEventListener("error", () => resolve(), { once: true });
          }),
  );
  // Fonts change line breaks, so they change pagination — worth settling for.
  const fonts = doc.fonts?.ready?.then(() => undefined) ?? Promise.resolve();

  return Promise.race([
    Promise.all([...loaded, fonts]).then(() => undefined),
    new Promise<void>((resolve) => { setTimeout(resolve, READY_CAP_MS); }),
  ]);
}

export interface PrintOptions {
  /** Document title — what most browsers offer as the default filename. */
  title?: string;
  /** Page setup and overrides for this document, appended after the app's CSS. */
  extraCss?: string;
}

/**
 * Print `bodyHtml` — already-rendered markup, typically `someRef.innerHTML` —
 * styled the way it appears on screen.
 */
export function printHtml(bodyHtml: string, options: PrintOptions = {}): void {
  const { title = "Document", extraCss = "" } = options;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
  });
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    iframe.remove();
    return;
  }

  const escapedTitle = title.replace(/[<&]/g, (c) => (c === "<" ? "&lt;" : "&amp;"));
  doc.open();
  doc.write(
    `<!doctype html><html><head><title>${escapedTitle}</title>${collectHeadCss()}` +
      `<style>${PAGE_RESET}</style>` +
      (extraCss ? `<style>${extraCss}</style>` : "") +
      `</head><body>${bodyHtml}</body></html>`,
  );
  doc.close();

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    iframe.remove();
  };
  win.onafterprint = cleanup;

  void whenReady(doc).then(() => {
    // The dialog can be dismissed or the component unmounted while we waited.
    if (!iframe.isConnected) return;
    win.focus();
    win.print();
    // Firefox never fires onafterprint for an iframe, so the timer is the only
    // thing that removes it there.
    setTimeout(cleanup, CLEANUP_MS);
  });
}
