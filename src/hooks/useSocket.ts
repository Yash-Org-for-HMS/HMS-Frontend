import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useHospitalAuth } from "../contexts/HospitalAuthContext";
import { useToast } from "../contexts/ToastContext";

export function useSocket(eventMap: Record<string, (...args: any[]) => void>) {
  const { user, hospital } = useHospitalAuth();
  const socketRef = useRef<Socket | null>(null);

  const eventMapRef = useRef(eventMap);

  useEffect(() => {
    eventMapRef.current = eventMap;
  }, [eventMap]);

  useEffect(() => {
    if (!hospital?.id) return;

    // Connect to the backend
    // Assuming the backend runs on the base URL (which is usually on port 5000 in dev)
    const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    
    // In many cases, VITE_API_URL includes `/api`, so we need to strip it to get the base domain
    const baseUrl = backendUrl.replace(/\/api\/?$/, "");

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
