import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Loading, Toggle, Modal } from "@carbon/react";
import { Send, ViewOff, View, TrashCan, OverflowMenuVertical, ArrowLeft } from "@carbon/icons-react";
import { api } from "../services/api";
import { useSessionUser } from "../hooks/useSession";
import { connectSocket, onNewMessage, disconnectSocket } from "../services/socket";
import "../styles/pages/messenger.css";

const isSameDay = (d1, d2) => {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
};

const formatDateLabel = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (isSameDay(date, today)) return "Today";
    if (isSameDay(date, yesterday)) return "Yesterday";
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
};

export default function Messenger() {
    const { conversationId } = useParams();
    const navigate = useNavigate();
    const user = useSessionUser();

    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState([]);
    const [currentConv, setCurrentConv] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [newMessage, setNewMessage] = useState("");
    const [showHidden, setShowHidden] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [conversationToDelete, setConversationToDelete] = useState(null);
    const [activeMenu, setActiveMenu] = useState(null);

    const messagesEndRef = useRef(null);

    // Load conversations via API and connect socket for real-time
    useEffect(() => {
        if (!user?.uid) {
            setLoading(false);
            return;
        }

        let isMounted = true;

        // Connect to socket for real-time updates
        connectSocket(user.uid);

        // Fetch conversations via API
        api.messagesList().then((data) => {
            if (!isMounted) return;
            setConversations(data.conversations || []);
            setLoading(false);
        }).catch(err => {
            if (!isMounted) return;
            console.error("Failed to load conversations", err);
            setLoading(false);
        });

        // Listen for new messages via socket
        const unsubscribe = onNewMessage(({ conversationId: convId, message }) => {
            if (!isMounted) return;

            // Add message to current conversation if it matches
            setMessages(prev => {
                // Avoid duplicates
                if (prev.some(m => m.id === message.id)) return prev;
                return [...prev, message];
            });

            // Update conversation's lastMessageAt in list
            setConversations(prev => prev.map(conv => {
                if (conv.id === convId) {
                    return {
                        ...conv,
                        lastMessageAt: message.createdAt,
                        lastMessagePreview: message.content?.substring(0, 50)
                    };
                }
                return conv;
            }));
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [user?.uid]);

    // Fetch active conversation details and messages
    useEffect(() => {
        if (!conversationId) {
            setCurrentConv(null);
            setMessages([]);
            return;
        }

        // Fetch conversation details and messages directly
        // We do not rely on the 'conversations' list state here to avoid dependency loops
        api.messagesGet(conversationId).then(data => {
            if (data.conversation) {
                // Enrich with job title
                const enrichedConv = { ...data.conversation, jobTitle: "Loading..." };
                setCurrentConv(enrichedConv);

                // Try to get job title
                if (data.conversation.jobId) {
                    api.jobGet(data.conversation.jobId).then(jobData => {
                        if (jobData?.job?.title || jobData?.title) {
                            setCurrentConv(prev => prev ? {
                                ...prev,
                                jobTitle: jobData.job?.title || jobData.title
                            } : null);
                        }
                    }).catch(() => { });
                }
            } else {
                setCurrentConv(null);
            }

            if (data.messages) {
                setMessages(data.messages);
                scrollToBottom();
            }
        }).catch(err => {
            console.error("Failed to load conversation", err);
        });

        // Mark as read
        api.messagesMarkRead(conversationId).then(updatedConv => {
            setConversations(prev => prev.map(c => {
                if (c.id === conversationId) {
                    // Update read status locally
                    return {
                        ...c,
                        readBy: { ...(c.readBy || {}), [user?.uid]: new Date().toISOString() }
                    };
                }
                return c;
            }));
        }).catch(err => console.error("Failed to mark as read", err));

    }, [conversationId, user?.uid]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || sending || !conversationId) return;

        setSending(true);
        const messageContent = newMessage.trim();
        try {
            const resp = await api.messagesSend(conversationId, messageContent);
            if (resp.message) {
                setMessages(prev => [...prev, resp.message]);
            } else {
                // If no message returned, create a local placeholder
                setMessages(prev => [...prev, {
                    id: `local_${Date.now()}`,
                    content: messageContent,
                    senderId: user?.uid,
                    createdAt: new Date().toISOString(),
                    conversationId
                }]);
            }
            setNewMessage("");
            scrollToBottom();
        } catch (err) {
            console.error("Failed to send message", err);
        } finally {
            setSending(false);
        }
    };

    const handleSelectConversation = (id) => {
        setActiveMenu(null);
        navigate(`/messages/${id}`);
    };

    const handleHideChat = async (convId, e) => {
        e?.stopPropagation();
        setActiveMenu(null);
        try {
            await api.messagesHide(convId);
            if (conversationId === convId) {
                navigate("/messages");
            }
        } catch (err) {
            console.error("Failed to hide chat", err);
        }
    };

    const handleUnhideChat = async (convId, e) => {
        e?.stopPropagation();
        setActiveMenu(null);
        try {
            await api.messagesUnhide(convId);
        } catch (err) {
            console.error("Failed to unhide chat", err);
        }
    };

    const handleDeleteClick = (convId, e) => {
        e?.stopPropagation();
        setActiveMenu(null);
        setConversationToDelete(convId);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!conversationToDelete) return;
        try {
            await api.messagesDelete(conversationToDelete);
            setDeleteModalOpen(false);
            setConversationToDelete(null);
            if (conversationId === conversationToDelete) {
                navigate("/messages");
            }
        } catch (err) {
            console.error("Failed to delete chat", err);
        }
    };

    const toggleMenu = (convId, e) => {
        e.stopPropagation();
        setActiveMenu(activeMenu === convId ? null : convId);
    };

    // Filter conversations based on showHidden toggle
    const visibleConversations = conversations.filter(conv => {
        const isHidden = conv.hiddenBy && conv.hiddenBy.includes(user?.uid);
        return showHidden ? true : !isHidden;
    });

    // Check if current conversation has unread messages
    const hasUnread = (conv) => {
        if (!conv.lastMessageAt) return false;
        const lastReadTime = conv.readBy?.[user?.uid];
        if (!lastReadTime) return true;
        return new Date(conv.lastMessageAt) > new Date(lastReadTime);
    };

    if (loading) return <Loading />;

    return (
        <div className={`messenger-container ${conversationId ? 'chat-active' : ''}`}>
            <div className="messenger-sidebar">
                <div className="messenger-header">
                    <span>Messages</span>
                    <Toggle
                        id="show-hidden-toggle"
                        size="sm"
                        labelA=""
                        labelB=""
                        labelText="Show hidden"
                        toggled={showHidden}
                        onToggle={() => setShowHidden(!showHidden)}
                    />
                </div>
                <ul className="conversation-list">
                    {visibleConversations.map(conv => {
                        const isHidden = conv.hiddenBy && conv.hiddenBy.includes(user?.uid);
                        return (
                            <li
                                key={conv.id}
                                className={`conversation-item ${conv.id === conversationId ? 'active' : ''} ${isHidden ? 'hidden-conv' : ''} ${hasUnread(conv) ? 'unread' : ''}`}
                                onClick={() => handleSelectConversation(conv.id)}
                            >
                                <div className="conversation-content">
                                    <span className="conversation-job-title">
                                        {conv.jobTitle || `Job #${conv.jobId}`}
                                        {isHidden && <span className="hidden-label"> (Hidden)</span>}
                                    </span>
                                    {conv.participantNames && (
                                        <span className="conversation-participants">
                                            {conv.participantNames.join(", ")}
                                        </span>
                                    )}
                                    <span className="conversation-last-message">
                                        {conv.lastMessagePreview || "No messages yet"}
                                    </span>
                                </div>
                                <div className="conversation-actions">
                                    <button
                                        className="menu-trigger"
                                        onClick={(e) => toggleMenu(conv.id, e)}
                                        aria-label="Chat options"
                                    >
                                        <OverflowMenuVertical />
                                    </button>
                                    {activeMenu === conv.id && (
                                        <div className="action-menu">
                                            {isHidden ? (
                                                <button onClick={(e) => handleUnhideChat(conv.id, e)}>
                                                    <View /> Show Chat
                                                </button>
                                            ) : (
                                                <button onClick={(e) => handleHideChat(conv.id, e)}>
                                                    <ViewOff /> Hide Chat
                                                </button>
                                            )}
                                            <button
                                                className="delete-action"
                                                onClick={(e) => handleDeleteClick(conv.id, e)}
                                            >
                                                <TrashCan /> Delete Chat
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                    {visibleConversations.length === 0 && (
                        <li className="conversation-item empty">
                            {showHidden ? "No conversations" : "No active conversations"}
                        </li>
                    )}
                </ul>
            </div>
            <div className={`messenger-main ${conversationId ? 'show-on-mobile' : ''}`}>
                {conversationId && currentConv ? (
                    <>
                        <div className="chat-header">
                            <Button
                                kind="ghost"
                                size="sm"
                                className="mobile-back-button"
                                onClick={() => navigate("/messages")}
                                iconDescription="Back to list"
                                hasIconOnly
                                renderIcon={ArrowLeft}
                            />
                            <div className="chat-header-info">
                                <span className="chat-header-title">{currentConv.jobTitle || `Job #${currentConv.jobId}`}</span>
                                {currentConv.participantNames && (
                                    <span className="chat-header-subtitle">
                                        {currentConv.participantNames.join(" & ")}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="chat-messages">
                            {messages.map((msg, i) => {
                                const isMe = String(msg.senderId) === String(user?.uid);
                                const prevMsg = messages[i - 1];
                                const showDateSeparator = !prevMsg || !isSameDay(new Date(msg.createdAt), new Date(prevMsg.createdAt));

                                return (
                                    <div key={i} className="message-wrapper">
                                        {showDateSeparator && (
                                            <div className="date-separator">
                                                <span>{formatDateLabel(new Date(msg.createdAt))}</span>
                                            </div>
                                        )}
                                        <div className={`message-bubble ${isMe ? 'message-sent' : 'message-received'}`}>
                                            <div className="message-content">{msg.content}</div>
                                            <div className="message-time">
                                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                        <form className="chat-input-area" onSubmit={handleSendMessage}>
                            <input
                                type="text"
                                placeholder="Type a message..."
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                            />
                            <Button
                                hasIconOnly
                                renderIcon={Send}
                                iconDescription="Send"
                                type="submit"
                                disabled={sending || !newMessage.trim()}
                            />
                        </form>
                    </>
                ) : (
                    <div className="chat-placeholder">
                        <p>Select a conversation to start chatting</p>
                    </div>
                )}
            </div>

            <Modal
                open={deleteModalOpen}
                danger
                modalHeading="Delete Conversation"
                primaryButtonText="Delete"
                secondaryButtonText="Cancel"
                onRequestClose={() => setDeleteModalOpen(false)}
                onRequestSubmit={handleConfirmDelete}
            >
                <p>Are you sure you want to permanently delete this conversation? This action cannot be undone and all messages will be lost.</p>
            </Modal>
        </div>
    );
}
