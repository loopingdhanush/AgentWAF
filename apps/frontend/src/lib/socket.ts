import { io, Socket } from "socket.io-client";
import type { ToolCallEvent } from "@agentwaf/shared-types";

const SOCKET_URL = "";

let socket: Socket | null = null;

export function getDashboardSocket(): Socket {
  if (!socket) {
    socket = io(`${SOCKET_URL}/dashboard`, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export type { ToolCallEvent };
