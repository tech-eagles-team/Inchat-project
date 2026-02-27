import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { chatAPI } from '../api/chat';
import { callsAPI } from '../api/calls';
import { socketService } from '../services/socket';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { format } from 'date-fns';
import { FiArrowLeft, FiMenu, FiMoreVertical } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ChatWindow({ chat, onBack, onMenuClick }) {
  const { messages, addMessage, setMessages, updateChat } = useChatStore();
  const { user } = useAuthStore();
  const messagesEndRef = useRef(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const chatMessages = messages[chat._id] || [];

  useEffect(() => {
    if (chat._id && !chat._id.startsWith('temp-')) {
      setPage(1);
      setHasMore(true);
      loadMessages();

      // Join chat room via socket to receive real-time messages
      console.log(`📱 Joining chat room: ${chat._id}`);
      socketService.joinChat(chat._id);
      socketService.markAsRead(chat._id);
    }

    return () => {
      if (chat._id && !chat._id.startsWith('temp-')) {
        console.log(`📱 Leaving chat room: ${chat._id}`);
        socketService.leaveChat(chat._id);
      }
    };
  }, [chat._id]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenu && !event.target.closest('.dropdown-menu')) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const loadMessages = async () => {
    if (loading || !hasMore) return;
    if (!chat || !chat._id || chat._id.startsWith('temp-')) {
      console.error('❌ Invalid chat or temp chat:', chat);
      return;
    }

    setLoading(true);
    try {
      const response = await chatAPI.getMessages(chat._id, page);
      const newMessages = (response.data.messages || []).filter(Boolean);

      if (newMessages.length === 0) {
        setHasMore(false);
      } else {
        if (page === 1) {
          // Server already returns messages oldest->newest, store as-is
          setMessages(chat._id, newMessages);
        } else {
          // Prepend older messages (they are oldest->newest for that page)
          setMessages(chat._id, [...newMessages, ...chatMessages]);
        }
        setPage(page + 1);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);

      // Handle 404 - chat doesn't exist
      if (error.response?.status === 404) {
        toast.error('Chat not found');
        onBack?.();
        return;
      }

      // Handle 401 - not authenticated
      if (error.response?.status === 401) {
        toast.error('Session expired, please login again');
        onBack?.();
        return;
      }

      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (text, type, media, replyTo) => {
    try {
      // Generate temp ID for pending message tracking
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const { addPendingMessage, removePendingMessage } = useChatStore.getState();

      // Add to pending messages
      addPendingMessage(chat._id, tempId, text || `${type} message`);

      let response;
      try {
        if (type === 'text') {
          response = await chatAPI.sendTextMessage(chat._id, text, replyTo);
        } else if (media) {
          const formData = new FormData();
          formData.append('media', media);
          formData.append('type', type);
          if (replyTo) formData.append('replyTo', replyTo);
          response = await chatAPI.sendMediaMessage(chat._id, formData);
        }

        // Remove from pending messages (message arrived via socket)
        removePendingMessage(chat._id, tempId);

        // Add message optimistically to UI immediately
        if (response?.data?.message) {
          addMessage(chat._id, response.data.message);
          updateChat(chat._id, {
            lastMessage: response.data.message,
            lastMessageAt: response.data.message.createdAt || new Date().toISOString()
          });
        }

        // Message will also be added via socket event (for other participants)
        // Duplicate prevention in store will handle if same message arrives twice
      } catch (sendError) {
        // Remove pending message on error
        removePendingMessage(chat._id, tempId);

        // Enhanced error message
        const errorMsg = sendError.response?.data?.error || 'Failed to send message';
        console.error('❌ Message send error:', sendError);
        toast.error(`${errorMsg}. Tap to retry.`, {
          onClick: () => handleSendMessage(text, type, media, replyTo)
        });
        throw sendError;
      }
    } catch (error) {
      // Error already handled above
    }
  };

  const getChatName = () => {
    if (chat.type === 'group') {
      return chat.name || 'Group Chat';
    }
    const other = chat.otherParticipant || chat.participants?.find(p => p._id !== user?.id);
    return other?.username || 'Unknown';
  };

  const getChatAvatar = () => {
    if (chat.type === 'group') {
      return chat.profilePhoto || null;
    }
    const other = chat.otherParticipant || chat.participants?.find(p => p._id !== user?.id);
    return other?.profilePhoto || null;
  };

  const handleClearChat = async () => {
    if (!confirm('Are you sure you want to clear all messages in this chat? This action cannot be undone.')) {
      return;
    }

    try {
      await chatAPI.clearChat(chat._id);
      // Clear messages from local state
      setMessages(chat._id, []);
      // Update chat to show no last message
      updateChat(chat._id, { lastMessage: null, lastMessageAt: null });
      toast.success('Chat cleared');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to clear chat');
    }
  };

  const handleLeaveChat = async () => {
    if (!confirm('Are you sure you want to delete this chat? It will be removed from your chat list.')) {
      return;
    }

    try {
      await chatAPI.leaveChat(chat._id);
      // Remove chat from local state
      const { removeChat } = useChatStore.getState();
      removeChat(chat._id);
      toast.success('Chat deleted');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete chat');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-dark-900">
      {/* Header */}
      <div className="h-16 px-4 bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={onBack}
            className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
            {getChatAvatar() ? (
              <img
                src={`/api/uploads/${getChatAvatar()}`}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              getChatName()?.[0]?.toUpperCase() || '?'
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 dark:text-white truncate">
              {getChatName()}
            </div>
            {chat.otherParticipant?.isOnline ? (
              <div className="text-xs text-gray-500 dark:text-gray-400">online</div>
            ) : chat.otherParticipant?.lastSeen ? (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                last seen {format(new Date(chat.otherParticipant.lastSeen), 'HH:mm')}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              <FiMoreVertical className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            {showMenu && (
              <div className="dropdown-menu absolute right-0 top-full mt-1 w-48 bg-white dark:bg-dark-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-700 z-50">
                <button
                  onClick={() => {
                    handleClearChat();
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700 rounded-t-lg transition-colors"
                >
                  Clear Chat
                </button>
                <button
                  onClick={() => {
                    handleLeaveChat();
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-dark-700 rounded-b-lg transition-colors"
                >
                  Delete Chat
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 scrollbar-hide">
        {loading && page > 1 && (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
            Loading...
          </div>
        )}

        {chatMessages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-6xl mb-4">💬</div>
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm">Start the conversation</p>
          </div>
        ) : (
          chatMessages.filter(message => message && message._id && message.senderId && message.senderId._id).map((message, index) => {
            return (
              <div key={message._id}>
                <MessageBubble
                  message={message}
                  isOwn={message.senderId._id === user?.id || message.senderId === user?.id}
                />
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {chat._id.startsWith('temp-') ? (
        <div className="bg-white dark:bg-dark-800 border-t border-gray-200 dark:border-dark-700 p-4">
          <div className="text-center text-gray-500 dark:text-gray-400">
            Creating chat...
          </div>
        </div>
      ) : (
        <MessageInput onSend={handleSendMessage} chatId={chat._id} />
      )}
    </div>
  );
}

