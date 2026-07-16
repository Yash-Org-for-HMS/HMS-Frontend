/**
 * Pull a human-readable message out of an Axios/API error, falling back to a
 * generic message when the server didn't send one. Centralizes the
 * `err.response?.data?.message || "…"` pattern that was repeated across ~120
 * catch blocks. Optional-chains the error itself, so it never throws even if
 * `err` is null/undefined.
 */
export function getApiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  return (err as any)?.response?.data?.message || fallback;
}
