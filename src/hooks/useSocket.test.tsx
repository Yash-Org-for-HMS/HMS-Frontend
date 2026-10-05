import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/**
 * Whether the tab is live. A screen that relies on its layout's connection
 * (the doctor dashboard) polls slowly only while that connection is up, so the
 * count must follow every connect, drop and unmount exactly — a count stuck
 * at "live" would leave a screen with no updates and a slow poll.
 */

type Handler = (...a: unknown[]) => void;
const sockets = vi.hoisted(() => [] as { handlers: Record<string, Handler[]>; fire: (e: string, ...a: unknown[]) => void; disconnect: () => void }[]);
vi.mock("socket.io-client", () => ({
  io: () => {
    const handlers: Record<string, Handler[]> = {};
    const s = {
      handlers,
      on: (e: string, fn: Handler) => { (handlers[e] ??= []).push(fn); },
      fire: (e: string, ...a: unknown[]) => (handlers[e] ?? []).forEach((fn) => fn(...a)),
      disconnect: () => s.fire("disconnect"),
    };
    sockets.push(s);
    return s;
  },
}));
vi.mock("@/providers/HospitalAuthContext", () => ({ useHospitalAuth: () => ({ hospital: { id: "h" }, activeBranchId: "k" }) }));
vi.mock("@/api/axios", () => ({ API_URL: "http://localhost:5000/api" }));

import { useSocket, useLiveConnected } from "./useSocket";

beforeEach(() => {
  sockets.length = 0;
  sessionStorage.setItem("hospitalAccessToken", "t");
});

describe("useSocket / useLiveConnected", () => {
  it("follows connect, drop, reconnect and unmount — across two connections", () => {
    const live = renderHook(() => useLiveConnected());
    const a = renderHook(() => useSocket({ QUEUE_UPDATED: () => {} }));
    const b = renderHook(() => useSocket({}));
    expect(live.result.current).toBe(false);

    act(() => sockets[0].fire("connect"));
    expect(a.result.current.connected).toBe(true);
    expect(live.result.current).toBe(true);
    act(() => sockets[1].fire("connect"));
    // A repeated connect event is not a second connection.
    act(() => sockets[0].fire("connect"));

    act(() => sockets[0].fire("disconnect"));
    expect(a.result.current.connected).toBe(false);
    expect(live.result.current).toBe(true); // b is still up
    act(() => sockets[0].fire("connect_error", new Error("UNAUTHORIZED")));
    expect(live.result.current).toBe(true);

    b.unmount();
    expect(live.result.current).toBe(false);
    act(() => sockets[0].fire("connect"));
    expect(live.result.current).toBe(true);
    a.unmount();
    expect(live.result.current).toBe(false);
  });

  it("hands each event to the screen's handler", () => {
    const seen: unknown[] = [];
    renderHook(() => useSocket({ QUEUE_UPDATED: (p: unknown) => seen.push(p) }));
    act(() => sockets[0].fire("QUEUE_UPDATED", { area: "lab" }));
    expect(seen).toEqual([{ area: "lab" }]);
  });
});
