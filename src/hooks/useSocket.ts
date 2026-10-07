import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { io, Socket } from "socket.io-client";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { API_URL, refreshHospitalToken } from "@/api/axios";

// How many of this tab's live connections are up — for a screen that relies on
// its layout's connection (whose handlers refresh it) instead of opening one
// of its own: every useSocket() call is a separate connection.
let liveCount = 0;
const liveListeners = new Set<() => void>();
const subscribeLive = (cb: () => void) => { liveListeners.add(cb); return () => { liveListeners.delete(cb); }; };
const adjustLive = (delta: number) => { liveCount += delta; liveListeners.forEach((l) => l()); };

/** Whether any of this tab's live connections is up right now. */
export function useLiveConnected(): boolean {
  return useSyncExternalStore(subscribeLive, () => liveCount > 0);
}

/**
 * One live connection for a screen, with a handler per event. Returns whether
 * it is connected right now, so a screen can poll slowly while it is told about
 * changes and fall back to its normal poll while it is not.
 */
export function useSocket(eventMap: Record<string, (...args: any[]) => void>): { connected: boolean } {
  const { hospital, activeBranchId } = useHospitalAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  const eventMapRef = useRef(eventMap);

  useEffect(() => {
    eventMapRef.current = eventMap;
  }, [eventMap]);

  useEffect(() => {
    if (!hospital?.id) return;

    // Connect to the backend — VITE_API_URL usually includes `/api`, so strip
    // it to get the base domain the socket server listens on.
    const baseUrl = API_URL.replace(/\/api\/?$/, "");

    // The socket server now authenticates the handshake, so a connection
    // without a token is refused. Read it at connect time rather than closing
    // over it, so a reconnect after a refresh picks up the new token.
    const token = sessionStorage.getItem("hospitalAccessToken");
    if (!token) return;

    // The branch the screen is on, read the way the API client reads it, so
    // live updates come from the same branch as the data on screen — the
    // server checks it against the user's own branches, as it does for every
    // request. None (the hospital admin's "All branches") means every branch.
    socketRef.current = io(baseUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: (cb) => cb({
        token: sessionStorage.getItem("hospitalAccessToken") ?? "",
        branchId: sessionStorage.getItem("activeBranchId") ?? "",
      }),
    });

    const socket = socketRef.current;

    // The hospital room is joined server-side from the verified token — the
    // client no longer says which tenant it belongs to. Switching branch
    // reconnects (see the effect's dependencies), which moves the socket to
    // the new branch's room.
    // This connection's share of the tab-wide count, kept exact across
    // reconnects and the cleanup below.
    let up = false;
    const mark = (next: boolean) => {
      if (next !== up) { up = next; adjustLive(next ? 1 : -1); }
      setConnected(next);
    };
    // A refused handshake (an expired token — a tab left idle past it, then a
    // redeploy or a dropped connection) is final for socket.io-client: it gives
    // up on the socket and never retries. So refresh the token and connect again
    // here, a few times at most, so a server that keeps refusing doesn't loop.
    let closed = false;
    let refusals = 0;
    socket.on("connect", () => { refusals = 0; mark(true); });
    socket.on("disconnect", () => mark(false));
    socket.on("connect_error", (err) => {
      mark(false);
      if (err.message !== "UNAUTHORIZED") { console.warn("[Socket.io]", err.message); return; }
      if (closed || ++refusals > 3) return;
      void refreshHospitalToken().then((token) => {
        if (token && !closed) setTimeout(() => { if (!closed) socket.connect(); }, 1000 * refusals);
      });
    });

    // Register all event listeners
    Object.entries(eventMapRef.current).forEach(([event]) => {
      socket.on(event, (...args: any[]) => {
        console.log(`[Socket.io] Received event: ${event}`);
        // Always call the latest handler from the ref
        if (eventMapRef.current[event]) {
          eventMapRef.current[event](...args);
        }
      });
    });

    return () => {
      // Cleanup listeners and disconnect
      closed = true;
      socket.disconnect();
      mark(false);
    };
  }, [hospital?.id, activeBranchId]);

  return { connected };

}
