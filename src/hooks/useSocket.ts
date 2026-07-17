import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useHospitalAuth } from "@/providers/HospitalAuthContext";
import { useToast } from "@/providers/ToastContext";
import { API_URL } from "@/api/axios";

export function useSocket(eventMap: Record<string, (...args: any[]) => void>) {
  const { user, hospital } = useHospitalAuth();
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

    socketRef.current = io(baseUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("[Socket.io] Connected with ID:", socket.id);
      // Optionally join a hospital-specific room
      socket.emit("join_hospital", hospital.id);
    });

    // Register all event listeners
    Object.entries(eventMapRef.current).forEach(([event, handler]) => {
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
  }, [hospital?.id]);

  return socketRef.current;
}
