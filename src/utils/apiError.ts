/**
 * The narrow slice of an Axios/API error we actually read: the server's JSON
 * body `{ message }`. Modeling it precisely lets the helpers below avoid `any`
 * while still tolerating any thrown value (network error, string, null, …).
 */
export interface ApiErrorShape {
  response?: { data?: { message?: string } };
}

/**
 * Pull a human-readable message out of an Axios/API error, falling back to a
 * generic message when the server didn't send one. Centralizes the
 * `err.response?.data?.message || "…"` pattern that was repeated across ~120
 * catch blocks. Optional-chains the error itself, so it never throws even if
 * `err` is null/undefined.
 */
export function getApiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  return (err as ApiErrorShape)?.response?.data?.message || fallback;
}

/**
 * Like {@link getApiErrorMessage} but WITHOUT a fallback — returns `undefined`
 * when the server sent no message, so the caller (e.g. `<ErrorState message=…>`)
 * can supply its own default. Replaces the raw inline error-message expression
 * that was duplicated at the ErrorState sites.
 */
export function apiErrorText(err: unknown): string | undefined {
  return (err as ApiErrorShape)?.response?.data?.message;
}
