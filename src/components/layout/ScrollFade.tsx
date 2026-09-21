import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";

/**
 * A scroll area that admits when there is more below.
 *
 * The sidebar nav is the only elastic band between a pinned header and a pinned
 * footer, so everything that does not fit is simply invisible — measured, a
 * hospital admin on a 768px laptop could reach 9 of 29 menu items, and nothing
 * on screen suggested the other 20 existed. Scrolling was always possible; the
 * problem was never knowing to try.
 *
 * So: a soft fade at whichever edge has content beyond it. It does not reduce
 * the scrolling, it removes "I did not know that page was there".
 *
 * The fade is `pointer-events: none` — an overlay that ate clicks on the last
 * menu item would trade one navigation bug for a worse one.
 */
export default function ScrollFade({
  children,
  sx,
  /** Height of the fade. Smaller for dense lists. */
  size = 28,
}: {
  children: ReactNode;
  /** Applied to the scrolling element, not the wrapper. */
  sx?: SxProps<Theme>;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 1px of slack: fractional scroll positions on zoomed or hi-dpi displays
    // otherwise leave the bottom fade showing permanently at the very end.
    const top = el.scrollTop > 1;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdges((p) => (p.top === top && p.bottom === bottom ? p : { top, bottom }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });

    // Both are needed: the list changes height when a badge appears or a
    // module unlocks, and the viewport changes when the window resizes.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    for (const child of Array.from(el.children)) ro?.observe(child);
    window.addEventListener("resize", measure);

    return () => {
      el.removeEventListener("scroll", measure);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, children]);

  const fade = (edge: "top" | "bottom"): SxProps<Theme> => ({
    position: "absolute",
    left: 0,
    right: 0,
    [edge]: 0,
    height: size,
    pointerEvents: "none",
    opacity: edges[edge] ? 1 : 0,
    transition: "opacity .18s ease",
    background: (t: Theme) =>
      `linear-gradient(to ${edge === "bottom" ? "top" : "bottom"}, ${t.palette.background.paper}, transparent)`,
  });

  return (
    <Box sx={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <Box ref={ref} sx={{ flex: 1, minHeight: 0, overflowY: "auto", ...sx }}>
        {children}
      </Box>
      <Box aria-hidden sx={fade("top")} />
      <Box aria-hidden sx={fade("bottom")} />
    </Box>
  );
}
