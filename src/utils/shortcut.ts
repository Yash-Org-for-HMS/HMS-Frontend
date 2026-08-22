/**
 * Keyboard-shortcut labels that match the keyboard in front of the user.
 *
 * The command palette has always listened for `ctrlKey || metaKey`, so both
 * keys work — but every hint printed the Mac glyph, so on Windows (which is
 * what the hospital desks run) the app told people to press a key their
 * keyboard does not have.
 */

/** True on Apple hardware, where the palette is reached with ⌘ rather than Ctrl. */
export const IS_MAC: boolean =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/i.test(
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
      navigator.platform ||
      navigator.userAgent ||
      "",
  );

/**
 * Label for a modifier + key chord, e.g. `modKey("K")` → "⌘K" on a Mac and
 * "Ctrl K" elsewhere. The space matters on Windows: "CtrlK" reads as one word.
 */
export function modKey(key: string): string {
  return IS_MAC ? `⌘${key}` : `Ctrl ${key}`;
}

/** The chord that opens the command palette, spelt for this platform. */
export const SEARCH_SHORTCUT = modKey("K");
