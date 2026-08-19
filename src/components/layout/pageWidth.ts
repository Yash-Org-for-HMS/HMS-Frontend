/**
 * The two page widths.
 *
 * Most pages take no wrapper at all and fill the panel — right for tables,
 * queues and dashboards, where horizontal room is the point. The pages that
 * read better narrow pick one of these, and nothing invents a third number.
 *
 * The problem was never that some pages are narrow. It was that each one chose
 * its own width. Across the feature tree, page roots used 600, 800, 900, 920,
 * 1000, 1040, 1100, 1200 and 1400 — nine values — so moving between two pages
 * of the same kind shifted the left edge by up to 220px and the layout appeared
 * to jump for no reason a user could see. Measured in the browser at a 1600px
 * viewport, the hospital panel alone rendered content at 833, 888, 1000 and
 * 1277.
 *
 * Padding is deliberately NOT part of this. The panel layouts already apply
 * p: 3 to <main>; a wrapper that adds its own ends up sitting lower and further
 * in than every other page, which is what one of them was doing.
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
