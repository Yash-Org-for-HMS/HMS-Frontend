/**
 * How every dropdown in the app behaves (MuiMenu in theme.ts): it never grows
 * past this height — it scrolls — and from this many choices it has a search
 * box. MUI's own menus grow to the window's height minus 96px, so a list of
 * sixty doctors or two hundred tests covered most of the page.
 *
 * Kept in step with SearchableSelect's searchThreshold, which predates this.
 */
export const DROPDOWN_MAX_HEIGHT = 360;
export const SEARCH_FROM = 8;
