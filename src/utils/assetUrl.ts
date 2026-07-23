import { API_URL } from "@/api/axios";

// Base URL for server-hosted assets (uploaded logos, documents, reports).
// Derived from the API URL by stripping the trailing "/api" so it works in any
// deployment instead of a hardcoded localhost host.
const ASSET_BASE = API_URL.replace(/\/api\/?$/, "");

/**
 * Build an absolute URL for a server-stored asset path (e.g. "/uploads/x.png" or
 * an already-absolute "http://host/uploads/documents/x.pdf"). Returns "" for
 * empty input.
 *
 * Access control: the server serves hospital branding (top-level /uploads/logo-*
 * / favicon-*) publicly so it renders on the login page, but every other
 * /uploads file is PHI and now requires a valid hospital access token. Since
 * <img>/download/window.open requests can't send an Authorization header, the
 * token is appended as a ?token= query param for those protected files. Applies
 * whether the input is relative or an absolute URL pointing at our own /uploads.
 */
export function assetUrl(path?: string | null): string {
  if (!path) return "";
  const url = /^https?:\/\//i.test(path)
    ? path
    : `${ASSET_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  // Only /uploads assets are access-controlled; anything else passes through.
  const m = url.match(/\/uploads\/(.+)$/);
  if (!m) return url;

  // Public iff it's a TOP-LEVEL branding file (logo-/favicon-). Anything inside a
  // subdirectory (documents/, consents/, claims/, radiology/) is always PHI.
  const rel = m[1].split(/[?#]/)[0];
  const isTopLevelBranding = !rel.includes("/") && /^(logo|favicon)-/i.test(rel);
  if (isTopLevelBranding) return url;

  const token = sessionStorage.getItem("hospitalAccessToken");
  if (!token) return url;
  return `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}
