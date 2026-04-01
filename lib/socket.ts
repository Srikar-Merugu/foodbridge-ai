import { io, Socket } from "socket.io-client";

/**
 * Global Socket Singleton Manager
 * Ensures only one connection is shared across all components.
 */

let socketInstance: Socket | null = null;

export const getSocket = () => {
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "https://foodbridge-ai-nk8s.onrender.com";

  if (!socketInstance) {
    console.log("[WS-GLOBAL] Initializing persistent tracking link...");
    socketInstance = io(socketUrl, {
      transports: ["websocket", "polling"], // websocket-first avoids SSL upgrade errors in HTTPS
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      upgrade: false, // disable upgrade to prevent mid-session SSL handshake conflicts
    });

    socketInstance.on("connect", () => {
      console.log(`[WS-GLOBAL] Synced: ${socketInstance?.id} (${socketInstance?.io.engine.transport.name})`);
    });

    socketInstance.on("disconnect", (reason) => {
      console.warn("[WS-GLOBAL] Dropped:", reason);
      if (reason === "io server disconnect") {
        socketInstance?.connect();
      }
    });

    socketInstance.on("connect_error", (error) => {
      console.error("[WS-GLOBAL] Connectivity Failure:", error.message);
    });
  }

  return socketInstance;
};

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};
