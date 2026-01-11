import { useCallback, useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
} from "@carbon/react";
import { Logout, Map, UserAvatar, Chat } from "@carbon/icons-react";
import { logout } from "./services/session";
import { useSessionUser } from "./hooks/useSession";
import { api } from "./services/api";
import { connectSocket, onNewMessage, onConversationUpdate, disconnectSocket } from "./services/socket";
import Nav from "./components/Nav";
import "./styles/components/header.css";

export default function App() {
  const nav = useNavigate();
  const user = useSessionUser();
  const [unreadCount, setUnreadCount] = useState(0);

  const greetingName = user?.firstName || user?.name || "Guest";
  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
    : "";
  const userType = user?.userType
    ? user.userType.charAt(0).toUpperCase() + user.userType.slice(1)
    : null;

  // Calculate unread from conversations
  const calculateUnread = (conversations, userId) => {
    if (!conversations || !userId) return 0;
    return conversations.filter(conv => {
      if (conv.hiddenBy && conv.hiddenBy.includes(userId)) return false;
      const lastReadTime = conv.readBy?.[userId];
      if (!lastReadTime) return conv.lastMessageAt != null;
      return new Date(conv.lastMessageAt) > new Date(lastReadTime);
    }).length;
  };

  // Fetch unread count via API and listen for updates
  useEffect(() => {
    if (!user?.uid) {
      setUnreadCount(0);
      return;
    }

    // Connect socket for real-time
    connectSocket(user.uid);

    const fetchUnread = () => {
      api.messagesList().then(data => {
        const count = calculateUnread(data.conversations || [], user.uid);
        setUnreadCount(count);
      }).catch(() => { });
    };

    // Initial fetch
    fetchUnread();

    // Listen for new messages or updates to update count
    const unsubscribeMsg = onNewMessage(fetchUnread);
    const unsubscribeUpd = onConversationUpdate(fetchUnread);

    return () => {
      unsubscribeMsg();
      unsubscribeUpd();
      disconnectSocket();
    };
  }, [user?.uid]);

  const handleBrandNavigation = useCallback(() => {
    if (!user) {
      nav("/login");
      return;
    }
    nav("/jobs");
  }, [nav, user]);

  return (
    <>
      <Header aria-label="OpenBid">
        <HeaderName prefix="">
          <button
            type="button"
            className="header-logo-button"
            onClick={handleBrandNavigation}
            aria-label="OpenBid home"
          >
            <img src="/Images/OpenBidLogo.svg" alt="OpenBid logo" />
            <span className="header-logo-text">OpenBid</span>
          </button>
        </HeaderName>
        <HeaderGlobalBar>
          <div className="header-user-info">
            <span className="header-user-greeting">
              Hello, {greetingName}
            </span>
            {fullName && (
              <span className="header-user-details">
                Logged in as {fullName}
                {userType ? ` (${userType})` : ""}
              </span>
            )}
          </div>
          <HeaderGlobalAction aria-label="Map" onClick={() => nav("/jobs")}>
            <Map />
          </HeaderGlobalAction>
          <HeaderGlobalAction aria-label="Messages" onClick={() => nav("/messages")}>
            <div className="header-chat-wrapper">
              <Chat />
              {unreadCount > 0 && (
                <span className="header-chat-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
          </HeaderGlobalAction>
          <HeaderGlobalAction aria-label="Profile" onClick={() => nav("/profile")}>
            <UserAvatar />
          </HeaderGlobalAction>
          <HeaderGlobalAction
            aria-label="Logout"
            onClick={() => {
              logout();
              nav("/login");
            }}
          >
            <Logout />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header>
      <Nav />
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
