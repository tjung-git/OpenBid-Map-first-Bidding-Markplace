import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Messenger from "../pages/Messenger";

const apiMock = vi.hoisted(() => ({
  messagesList: vi.fn(),
  messagesGet: vi.fn(),
  messagesSend: vi.fn(),
  messagesMarkRead: vi.fn(),
  messagesHide: vi.fn(),
  messagesUnhide: vi.fn(),
  messagesDelete: vi.fn(),
  jobGet: vi.fn(),
}));

vi.mock("../services/api", () => ({
  api: apiMock,
}));

vi.mock("../hooks/useSession", () => ({
  useSessionUser: () => ({ uid: "user-1" }),
}));

vi.mock("../services/socket", () => ({
  connectSocket: vi.fn(),
  disconnectSocket: vi.fn(),
  onNewMessage: vi.fn(() => vi.fn()),
}));

vi.mock("@carbon/react", () => ({
  Button: ({ children, iconDescription, hasIconOnly, renderIcon, ...p }) => (
    <button aria-label={iconDescription} {...p}>
      {children}
    </button>
  ),
  Loading: () => <div data-testid="loading">Loading...</div>,
  Toggle: ({ toggled, onToggle, labelText, id }) => (
    <label>
      <span>{labelText}</span>
      <input
        data-testid={id || "toggle"}
        type="checkbox"
        checked={toggled}
        onChange={() => onToggle()}
      />
    </label>
  ),
  Modal: ({ open, children, onRequestClose, onRequestSubmit, primaryButtonText, secondaryButtonText }) =>
    open ? (
      <div role="dialog" aria-modal="true">
        {children}
        <button onClick={onRequestClose}>{secondaryButtonText}</button>
        <button onClick={onRequestSubmit}>{primaryButtonText}</button>
      </div>
    ) : null,
}));

vi.mock("@carbon/icons-react", () => ({
  Send: () => <span data-testid="icon-send">Send</span>,
  ViewOff: () => <span>ViewOff</span>,
  View: () => <span>View</span>,
  TrashCan: () => <span>TrashCan</span>,
  OverflowMenuVertical: () => <span>Menu</span>,
  ArrowLeft: () => <span>Back</span>,
}));

function renderMessenger(initialPath = "/messages") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/messages" element={<Messenger />} />
        <Route path="/messages/:conversationId" element={<Messenger />} />
      </Routes>
    </MemoryRouter>,
  );
}

const defaultConversations = [
  {
    id: "conv-1",
    jobId: "job-1",
    jobTitle: "Kitchen Remodel",
    participants: ["user-1", "user-2"],
    participantNames: ["Alice", "Bob"],
    lastMessagePreview: "Last message",
    lastMessageAt: new Date().toISOString(),
  },
];

describe("Messenger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.messagesList.mockResolvedValue({
      conversations: defaultConversations,
    });
    apiMock.messagesGet.mockResolvedValue({
      conversation: {
        id: "conv-1",
        jobId: "job-1",
        jobTitle: "Kitchen Remodel",
        participantNames: ["Alice", "Bob"],
      },
      messages: [
        {
          id: "msg-1",
          content: "Hello",
          senderId: "user-2",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    apiMock.messagesMarkRead.mockResolvedValue({});
    apiMock.messagesSend.mockResolvedValue({
      message: {
        id: "msg-2",
        content: "Hi back",
        senderId: "user-1",
        createdAt: new Date().toISOString(),
      },
    });
    apiMock.jobGet.mockResolvedValue({ job: { title: "Kitchen Remodel" } });
  });

  it("shows loading then conversation list after messages load", async () => {
    renderMessenger();

    expect(screen.getByTestId("loading")).toBeInTheDocument();

    await waitFor(() => {
      expect(apiMock.messagesList).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Kitchen Remodel")).toBeInTheDocument();
    expect(screen.getByText("Last message")).toBeInTheDocument();
  });

  it("shows placeholder when no conversation selected", async () => {
    renderMessenger("/messages");

    await waitFor(() => {
      expect(apiMock.messagesList).toHaveBeenCalled();
    });

    expect(
      screen.getByText("Select a conversation to start chatting"),
    ).toBeInTheDocument();
  });

  it("navigates and loads conversation when clicking a conversation", async () => {
    renderMessenger("/messages");

    await waitFor(() => {
      expect(screen.getByText("Kitchen Remodel")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Kitchen Remodel"));

    await waitFor(() => {
      expect(apiMock.messagesGet).toHaveBeenCalledWith("conv-1");
    });

    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("sends message and clears input when submitting form", async () => {
    renderMessenger("/messages/conv-1");

    await waitFor(() => {
      expect(apiMock.messagesGet).toHaveBeenCalledWith("conv-1");
    });

    const input = screen.getByPlaceholderText("Type a message...");
    await userEvent.type(input, "New message");

    const sendButton = screen.getByRole("button", { name: /send/i });
    await userEvent.click(sendButton);

    await waitFor(() => {
      expect(apiMock.messagesSend).toHaveBeenCalledWith("conv-1", "New message");
    });

    expect(input).toHaveValue("");
  });

  it("disables send when input is empty", async () => {
    renderMessenger("/messages/conv-1");

    await waitFor(() => {
      expect(apiMock.messagesGet).toHaveBeenCalled();
    });

    const sendButton = screen.getByRole("button", { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  it("shows Messages header and show-hidden toggle", async () => {
    renderMessenger("/messages");

    await waitFor(() => {
      expect(apiMock.messagesList).toHaveBeenCalled();
    });

    expect(screen.getByText("Messages")).toBeInTheDocument();
    expect(screen.getByText("Show hidden")).toBeInTheDocument();
  });
});
