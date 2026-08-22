/**
 * Is this sidebar entry the one the current URL belongs to?
 *
 * There were three rules for this across the seven layouts, and the difference
 * was accidental rather than considered:
 *
 *   - plain `pathname.startsWith(item.path)`         (Hospital, Lab, Pharmacy)
 *   - the same, excepting that panel's dashboard     (Doctor, Nurse, Reception)
 *   - a bespoke version special-casing "/"           (Admin)
 *
 * The plain one is wrong whenever one entry's path is a prefix of another's,
 * and the lab sidebar hit exactly that: on /lab/radiology-catalog it lit up
 * BOTH "Radiology Orders" (/lab/radiology) and "Radiology Catalog", because the
 * catalog path starts with the orders path. The other two rules were each a
 * partial workaround for the same flaw.
 *
 * The fix is to compare path SEGMENTS. A child route is `path + "/"` — the
 * catalog is not under /lab/radiology/, so it no longer matches — and that also
 * subsumes both workarounds: "/" matches only itself, and a dashboard matches
 * only itself and its own children.
 */
export function isNavItemActive(pathname: string, itemPath: string): boolean {
  if (pathname === itemPath) return true;
  // The platform dashboard lives at "/", which is a prefix of literally every
  // route — it can only ever match exactly.
  if (itemPath === "/") return false;
  // Trailing slash guards the prefix: "/lab/radiology-catalog" does not start
  // with "/lab/radiology/", but "/lab/radiology/123" does.
  return pathname.startsWith(`${itemPath}/`);
}
