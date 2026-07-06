import { API_URL } from "../api/axios";

// Base URL for server-hosted assets (uploaded logos, documents, reports).
// Derived from the API URL by stripping the trailing "/api" so it works in any
// deployment instead of a hardcoded localhost host.
const ASSET_BASE = API_URL.replace(/\/api\/?$/, "");

/**
 * Build an absolute URL for a server-stored asset path (e.g. "/uploads/x.png").
 * Returns "" for empty input and passes through already-absolute URLs.
 */
export function assetUrl(path?: string | null): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${ASSET_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}
