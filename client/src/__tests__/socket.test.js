import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSocket,
  connectSocket,
  disconnectSocket,
  onNewMessage,
  onConversationUpdate,
} from "../services/socket";

const mockEmit = vi.fn();
const mockOn = vi.fn();
const mockOff = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

const mockSocket = {
  emit: mockEmit,
  on: mockOn,
  off: mockOff,
  connect: mockConnect,
  disconnect: mockDisconnect,
  connected: false,
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

vi.mock("../services/config", () => ({
  cfg: { apiBase: "http://localhost:4000" },
}));

describe("socket service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
  });

  describe("getSocket", () => {
    it("returns a socket instance", () => {
      const sock = getSocket();
      expect(sock).toBeDefined();
      expect(sock.emit).toBe(mockEmit);
      expect(sock.on).toBe(mockOn);
    });

    it("returns the same socket instance on multiple calls", () => {
      const sock1 = getSocket();
      const sock2 = getSocket();
      expect(sock1).toBe(sock2);
    });
  });

  describe("connectSocket", () => {
    it("calls connect and emit join with userId", () => {
      connectSocket("user-123");
      expect(mockConnect).toHaveBeenCalled();
      expect(mockEmit).toHaveBeenCalledWith("join", "user-123");
    });

    it("does not call connect when socket is already connected", () => {
      mockSocket.connected = true;
      connectSocket("user-456");
      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockEmit).toHaveBeenCalledWith("join", "user-456");
    });
  });

  describe("disconnectSocket", () => {
    it("calls disconnect on the socket when it exists", () => {
      getSocket();
      disconnectSocket();
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe("onNewMessage", () => {
    it("registers listener and returns unsubscribe that calls off", () => {
      const callback = vi.fn();
      const unsubscribe = onNewMessage(callback);
      expect(mockOn).toHaveBeenCalledWith("new_message", callback);
      unsubscribe();
      expect(mockOff).toHaveBeenCalledWith("new_message", callback);
    });
  });

  describe("onConversationUpdate", () => {
    it("registers listener and returns unsubscribe that calls off", () => {
      const callback = vi.fn();
      const unsubscribe = onConversationUpdate(callback);
      expect(mockOn).toHaveBeenCalledWith("conversation_update", callback);
      unsubscribe();
      expect(mockOff).toHaveBeenCalledWith("conversation_update", callback);
    });
  });
});
