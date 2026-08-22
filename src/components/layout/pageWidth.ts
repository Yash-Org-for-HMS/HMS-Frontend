/**
 * The two page widths.
 *
 * Most pages take no wrapper and fill the panel; the ones that read better
 * narrow pick one of these, and nothing invents a third. Page roots previously
 * used nine different values (600…1400), so moving between two pages of the
 * same kind shifted the left edge by up to 220px for no visible reason.
 *
 * Padding is deliberately NOT included — the panel layouts already apply p: 3
 * to <main>, and a wrapper adding its own sits lower and further in than every
 * other page.
 */

/**
 * Forms, settings, and toggle lists. A row of fields stretched across 1300px
 * is hard to scan, and two-column form grids sit comfortably here.
 */
export const FORM_PAGE_WIDTH = 1000;

/**
 * Record detail pages — a patient profile, an order being worked on, the form
 * builder. Wider than a form because they carry tabs and side-by-side panels,
 * but still bounded so the eye doesn't have to track the full panel width.
 */
export const DETAIL_PAGE_WIDTH = 1200;
