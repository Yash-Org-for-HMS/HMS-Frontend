/**
 * Is this sidebar entry the one the current URL belongs to?
 *
 * Compares path SEGMENTS, because a plain `startsWith` is wrong whenever one
 * entry's path prefixes another's: /lab/radiology-catalog lit up both
 * "Radiology Orders" (/lab/radiology) and "Radiology Catalog". A child route is
 * `path + "/"`, which also makes "/" match only itself.
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
