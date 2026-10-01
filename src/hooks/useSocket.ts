import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { API_URL } from "@/api/axios";

export function useSocket(eventMap: Record<string, (...args: any[]) => void>) {
  const { hospital, activeBranchId } = useHospitalAuth();
  const socketRef = useRef<Socket | null>(null);

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
    socket.on("connect_error", (err) => {
      // An expired token is the ordinary case: the next API call refreshes it
      // and the socket reconnects with the new one. Nothing to surface.
      if (err.message !== "UNAUTHORIZED") console.warn("[Socket.io]", err.message);
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
      socket.disconnect();
    };
  }, [hospital?.id, activeBranchId]);

}
