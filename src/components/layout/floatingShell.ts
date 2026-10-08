/**
 * The hospital panels' shell on a desktop: the top bar and the sidebar float as
 * matching cards over the page — the same gap from the window's edges, the same
 * corners, edge and shadow. One place, so the two can't drift apart.
 */

export const TOP_BAR_HEIGHT = 64;
/** How far the floating bar and sidebar sit from the window's edges. */
export const FLOAT_GAP = 10;
export const CARD_RADIUS = "18px";
export const CARD_SHADOW = "0 4px 24px rgba(15, 23, 42, 0.06)";

/**
 * A desktop sidebar's paper as a floating card beside the bar. Its column keeps
 * the full drawer width, so the page beside it doesn't move.
 */
export function floatingSidebarPaper(drawerWidth: number) {
  return {
    boxSizing: "border-box",
    width: drawerWidth - 2 * FLOAT_GAP,
    top: FLOAT_GAP,
    left: FLOAT_GAP,
    height: `calc(100% - ${2 * FLOAT_GAP}px)`,
    borderRadius: CARD_RADIUS,
    borderStyle: "solid",
    borderColor: "divider",
    borderWidth: "1px",
    boxShadow: CARD_SHADOW,
    overflow: "hidden",
  } as const;
}
