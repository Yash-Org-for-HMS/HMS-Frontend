import { axiosInstance } from "./axios";
import type { AxiosRequestConfig } from "axios";

/**
 * Typed access to the API, and the one place that knows how a response is
 * wrapped.
 *
 * The backend answers in three envelope shapes that grew up alongside each
 * other:
 *
 *   { status: "success", data, pagination?: { total, page, limit, totalPages } }
 *   { success: true,     data, meta?:       { total, page, limit, totalPages } }
 *   { data, meta }                       (a few list endpoints)
 *
 * Every call site used to unwrap that by hand — `(await axiosInstance.get(url)).data.data`
 * — and type the result `any`, so a shape change surfaced as `undefined` three
 * components downstream rather than at the boundary. These helpers unwrap once
 * and hand back a typed value.
 *
 * They deliberately do NOT catch errors: an interceptor already handles 401
 * refresh, and swallowing anything else here would turn a failed request into
 * empty data, which is exactly the silent failure this is meant to end.
 */

/** Pagination as the API reports it, under either `pagination` or `meta`. */
export interface PageMeta {
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface Paged<T> {
  rows: T[];
  meta: PageMeta | null;
  /** True when the server capped the result set — `rows` is not the whole story. */
  truncated: boolean;
}

interface Envelope<T> {
  status?: string;
  success?: boolean;
  data?: T;
  pagination?: PageMeta;
  meta?: PageMeta;
}

/**
 * Pull the payload out of whichever envelope came back.
 *
 * A response with no `data` key is returned as-is: a few endpoints answer with
 * a bare object, and treating that as "no data" would be worse than passing it
 * through.
 */
function unwrap<T>(body: Envelope<T> | T): T {
  if (body && typeof body === "object" && "data" in (body as Envelope<T>)) {
    return (body as Envelope<T>).data as T;
  }
  return body as T;
}

function metaOf(body: unknown): PageMeta | null {
  if (!body || typeof body !== "object") return null;
  const e = body as Envelope<unknown>;
  return e.pagination ?? e.meta ?? null;
}

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await axiosInstance.get(url, config);
  return unwrap<T>(res.data);
}

/**
 * A list endpoint. Always returns an array — an endpoint that answers `null` or
 * an object gives `rows: []` rather than something a `.map()` will throw on.
 */
export async function apiGetList<T>(url: string, config?: AxiosRequestConfig): Promise<Paged<T>> {
  const res = await axiosInstance.get(url, config);
  const data = unwrap<T[]>(res.data);
  const rows = Array.isArray(data) ? data : [];
  const meta = metaOf(res.data);
  // The caller asked for `limit` and the server says there are more than that:
  // what came back is a page, not the set. Reports rely on knowing the difference.
  const limit = meta?.limit ?? (config?.params as { limit?: number } | undefined)?.limit;
  const truncated = meta?.total != null && limit != null && meta.total > limit;
  return { rows, meta, truncated };
}

export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await axiosInstance.post(url, body, config);
  return unwrap<T>(res.data);
}

export async function apiPut<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await axiosInstance.put(url, body, config);
  return unwrap<T>(res.data);
}

export async function apiPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await axiosInstance.patch(url, body, config);
  return unwrap<T>(res.data);
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await axiosInstance.delete(url, config);
  return unwrap<T>(res.data);
}
