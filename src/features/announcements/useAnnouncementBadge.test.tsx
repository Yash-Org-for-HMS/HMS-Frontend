import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ANNOUNCEMENT_FALLBACK_MS } from "@/constants/intervals";

/**
 * The Announcements badge asks when something changes rather than every
 * minute: at the moment the server says its count changes by itself, on a
 * socket nudge, and on a REconnect — but not on the first connect, which lands
 * a moment after the page's own first ask and used to repeat it.
 */

const get = vi.fn();
vi.mock("@/api/axios", () => ({ axiosInstance: { get: (...a: unknown[]) => get(...a) }, API_URL: "http://localhost:5000/api" }));

import { useAnnouncementBadge, nextBadgeAskIn } from "./useAnnouncementBadge";

const wrap = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: { data: { count: 2, nextAt: null } } });
});

describe("nextBadgeAskIn", () => {
  const now = Date.parse("2026-10-05T09:00:00Z");
  it("nothing scheduled: the slow fallback", () => {
    expect(nextBadgeAskIn(null, now)).toBe(ANNOUNCEMENT_FALLBACK_MS);
  });
  it("a notice going live in 2 minutes: asks just after it does", () => {
    expect(nextBadgeAskIn("2026-10-05T09:02:00Z", now)).toBe(121_000);
  });
  it("already past (a clock a little off): soon, but never a tight loop", () => {
    expect(nextBadgeAskIn("2026-10-05T08:59:00Z", now)).toBe(5_000);
  });
  it("hours away: still no longer than the fallback", () => {
    expect(nextBadgeAskIn("2026-10-05T15:00:00Z", now)).toBe(ANNOUNCEMENT_FALLBACK_MS);
  });
  it("the live connection down: the fallback is a minute, not fifteen", () => {
    expect(nextBadgeAskIn(null, now, 60_000)).toBe(60_000);
    expect(nextBadgeAskIn("2026-10-05T15:00:00Z", now, 60_000)).toBe(60_000);
  });
});

describe("useAnnouncementBadge", () => {
  it("shows the count, and the first socket connect does not ask a second time", async () => {
    const { result } = renderHook(() => useAnnouncementBadge(), { wrapper: wrap() });
    await waitFor(() => expect(result.current.unread).toBe(2));
    expect(get).toHaveBeenCalledTimes(1);
    act(() => result.current.onConnect());
    await new Promise((r) => setTimeout(r, 20));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("a reconnect after a while asks — a nudge may have been missed", async () => {
    const { result } = renderHook(() => useAnnouncementBadge(), { wrapper: wrap() });
    await waitFor(() => expect(result.current.unread).toBe(2));
    const later = Date.now() + 60_000;
    const spy = vi.spyOn(Date, "now").mockReturnValue(later);
    try {
      get.mockResolvedValue({ data: { data: { count: 3, nextAt: null } } });
      act(() => result.current.onConnect());
      await waitFor(() => expect(result.current.unread).toBe(3));
      expect(get).toHaveBeenCalledTimes(2);
    } finally {
      spy.mockRestore();
    }
  });

  it("a socket nudge always asks", async () => {
    const { result } = renderHook(() => useAnnouncementBadge(), { wrapper: wrap() });
    await waitFor(() => expect(result.current.unread).toBe(2));
    get.mockResolvedValue({ data: { data: { count: 5, nextAt: null } } });
    act(() => result.current.onAnnouncement());
    await waitFor(() => expect(result.current.unread).toBe(5));
  });
});
