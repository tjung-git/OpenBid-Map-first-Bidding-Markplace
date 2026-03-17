import { io } from "socket.io-client";
import { cfg } from "./config";

let socket = null;

/**
 * Get or create the socket connection
 */
export function getSocket() {
    if (!socket) {
        socket = io(cfg.apiBase, {
            autoConnect: false,
            transports: ["websocket", "polling"]
        });
    }
    return socket;
}

/**
 * Connect socket and join user room
 */
export function connectSocket(userId) {
    const sock = getSocket();

    if (!sock.connected) {
        sock.connect();
    }

    sock.emit("join", userId);
    console.log("[socket] joining as user:", userId);

    return sock;
}

/**
 * Disconnect socket
 */
export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        console.log("[socket] disconnected");
    }
}

/**
 * Subscribe to new messages for a conversation
 */
export function onNewMessage(callback) {
    const sock = getSocket();
    sock.on("new_message", callback);

    return () => {
        sock.off("new_message", callback);
    };
}

/**
 * Subscribe to conversation updates
 */
export function onConversationUpdate(callback) {
    const sock = getSocket();
    sock.on("conversation_update", callback);

    return () => {
        sock.off("conversation_update", callback);
    };
}
