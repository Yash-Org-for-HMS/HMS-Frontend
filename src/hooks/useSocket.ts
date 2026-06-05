import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useHospitalAuth } from "../contexts/HospitalAuthContext";

export function useSocket(eventMap: Record<string, (...args: any[]) => void>) {
  const { user } = useHospitalAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user?.hospitalId) return;

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
      socket.emit("join_hospital", user.hospitalId);
    });

    // Register all event listeners
    Object.entries(eventMap).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      // Cleanup listeners and disconnect
      Object.keys(eventMap).forEach((event) => {
        socket.off(event);
      });
      socket.disconnect();
    };
  }, [user?.hospitalId, eventMap]);

  return socketRef.current;
}
