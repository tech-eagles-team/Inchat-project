import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const safeId = (id) => {
  if (!id) return null;
  if (typeof id === 'string') return id;
  if (typeof id === 'object' && id._id) return id._id.toString();
  return id.toString ? id.toString() : null;
};

export const useChatStore = create(
  persist(
    (set, get) => ({
      chats: [],
      activeChat: null,
      messages: {},
      pendingMessages: {}, // Track messages being sent { chatId: [{ tempId, content, timestamp }] }
      onlineUsers: new Set(),
      loading: false,
      error: null,
      chatsLoaded: false,

      /* ================= SET CHATS ================= */
      setChats: (chats) => set((state) => {
        const existingUnread = {};
        state.chats.forEach(chat => {
          const id = safeId(chat?._id);
          if (id) existingUnread[id] = chat.unreadCount || 0;
        });

        const seen = new Set();
        const merged = [];

        chats.forEach(chat => {
          const id = safeId(chat?._id);
          if (!id || seen.has(id)) return;
          seen.add(id);

          merged.push({
            ...chat,
            _id: id,
            unreadCount:
              existingUnread[id] !== undefined
                ? existingUnread[id]
                : chat.unreadCount || 0
          });
        });

        // Ensure chats are sorted by lastMessageAt descending (most recent first)
        merged.sort((a, b) => {
          const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return tb - ta;
        });

        return { chats: merged, chatsLoaded: true };
      }),

      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      /* ================= ADD CHAT ================= */
      addChat: (chat) => set((state) => {
        const id = safeId(chat?._id);
        if (!id) return state;

        const exists = state.chats.find(c => safeId(c._id) === id);
        const others = state.chats.filter(c => safeId(c._id) !== id);

        const merged = exists ? { ...exists, ...chat, _id: id } : { ...chat, _id: id };

        return { chats: [merged, ...others] };
      }),

      /* ================= UPDATE CHAT ================= */
      updateChat: (chatId, updates) => set((state) => {
        const id = safeId(chatId);
        const updatedChats = state.chats.map(chat =>
          safeId(chat._id) === id
            ? { ...chat, ...updates }
            : chat
        );

        // Move updated chat to top if lastMessageAt changed or chat exists
        const idx = updatedChats.findIndex(c => safeId(c._id) === id);
        if (idx > -1) {
          const [updated] = updatedChats.splice(idx, 1);
          updatedChats.unshift(updated);
        }

        // Ensure ordering by lastMessageAt as fallback
        updatedChats.sort((a, b) => {
          const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return tb - ta;
        });

        return { chats: updatedChats };
      }),

      /* ================= REMOVE CHAT ================= */
      removeChat: (chatId) => set((state) => {
        const id = safeId(chatId);
        return {
          chats: state.chats.filter(chat => safeId(chat._id) !== id),
          messages: { ...state.messages, [id]: undefined },
          activeChat:
            safeId(state.activeChat?._id) === id
              ? null
              : state.activeChat
        };
      }),

      /* ================= SET ACTIVE CHAT ================= */
      setActiveChat: (chat) => set((state) => {
        if (!chat) return { activeChat: null };

        const id = safeId(chat._id);
        if (!id) return state;

        const stored = state.chats.find(c => safeId(c._id) === id);

        const active = {
          ...(stored || chat),
          ...chat,
          _id: id,
          unreadCount: 0
        };

        const otherChats = state.chats.filter(c => safeId(c._id) !== id);

        return {
          activeChat: active,
          chats: [active, ...otherChats]
        };
      }),

      /* ================= MESSAGES ================= */
      setMessages: (chatId, messages) => {
        const id = safeId(chatId);
        if (!id) return;
        const filteredMessages = (messages || []).filter(m => m && m._id && m.senderId && m.senderId._id);
        set((state) => ({
          messages: { ...state.messages, [id]: filteredMessages }
        }));
      },

      // Cleanup invalid messages
      cleanupMessages: () => set((state) => {
        const cleaned = {};
        Object.keys(state.messages).forEach(chatId => {
          cleaned[chatId] = (state.messages[chatId] || []).filter(m => m && m._id && m.senderId && m.senderId._id);
        });
        return { messages: cleaned };
      }),

      addMessage: (chatId, message) => set((state) => {
        const id = safeId(chatId);
        if (!id) {
          console.warn('⚠️ addMessage called with invalid chatId');
          return state;
        }

        if (!message) {
          console.warn('⚠️ addMessage called with null/undefined message');
          return state;
        }

        if (!message._id) {
          console.error('❌ addMessage called with message missing _id:', message);
          return state;
        }

        if (!message.senderId || !message.senderId._id) {
          console.error('❌ addMessage called with message missing senderId:', message);
          return state;
        }

        const existing = state.messages[id] || [];

        const exists = existing.some(
          m => safeId(m._id) === safeId(message._id)
        );

        if (exists) {
          console.warn(`⚠️ Message ${safeId(message._id)} already exists in store for chat ${id}`);
          return state;
        }

        console.log(`✅ Adding message ${safeId(message._id)} to chat ${id}`);
        return {
          messages: {
            ...state.messages,
            [id]: [...existing, message]
          }
        };
      }),

      markMessagesRead: (chatId, readerId) => set((state) => {
        const chatIdStr = safeId(chatId);
        const readerIdStr = safeId(readerId);

        if (!chatIdStr || !readerIdStr) return state;

        const existingMessages = state.messages[chatIdStr] || [];
        if (existingMessages.length === 0) return state;

        let changed = false;

        const updatedMessages = existingMessages.map((message) => {
          const senderId = safeId(message?.senderId?._id || message?.senderId);
          if (!senderId || senderId === readerIdStr) return message;

          const readBy = Array.isArray(message.readBy) ? message.readBy : [];
          const alreadyRead = readBy.some((entry) => safeId(entry?.userId) === readerIdStr);
          if (alreadyRead) return message;

          changed = true;
          return {
            ...message,
            readBy: [
              ...readBy,
              {
                userId: readerIdStr,
                readAt: new Date().toISOString()
              }
            ]
          };
        });

        if (!changed) return state;

        const withLastMessageUpdated = (chat) => {
          if (!chat || safeId(chat._id) !== chatIdStr || !chat.lastMessage) return chat;

          const lastMessageId = safeId(chat.lastMessage?._id || chat.lastMessage);
          if (!lastMessageId) return chat;

          const updatedLastMessage = updatedMessages.find(
            (message) => safeId(message._id) === lastMessageId
          );

          if (!updatedLastMessage) return chat;

          return {
            ...chat,
            lastMessage: updatedLastMessage
          };
        };

        return {
          messages: {
            ...state.messages,
            [chatIdStr]: updatedMessages
          },
          chats: state.chats.map(withLastMessageUpdated),
          activeChat: withLastMessageUpdated(state.activeChat)
        };
      }),

      /* ================= UPDATE USER IN CHATS ================= */
      updateUserInChats: (userId, userData) => set((state) => {
        const id = safeId(userId);
        if (!id) return state;

        // Update chats where user is a participant
        const updatedChats = state.chats.map(chat => {
          if (chat.otherParticipant && safeId(chat.otherParticipant._id) === id) {
            return {
              ...chat,
              otherParticipant: {
                ...chat.otherParticipant,
                ...userData
              }
            };
          }
          return chat;
        });

        // Update active chat if user is a participant
        let updatedActiveChat = state.activeChat;
        if (state.activeChat?.otherParticipant && safeId(state.activeChat.otherParticipant._id) === id) {
          updatedActiveChat = {
            ...state.activeChat,
            otherParticipant: {
              ...state.activeChat.otherParticipant,
              ...userData
            }
          };
        }

        return {
          chats: updatedChats,
          activeChat: updatedActiveChat
        };
      }),

      /* ================= PENDING MESSAGES ================= */
      addPendingMessage: (chatId, tempId, content) => set((state) => {
        const id = safeId(chatId);
        if (!id) return state;

        return {
          pendingMessages: {
            ...state.pendingMessages,
            [id]: [
              ...(state.pendingMessages[id] || []),
              { tempId, content, timestamp: Date.now() }
            ]
          }
        };
      }),

      removePendingMessage: (chatId, tempId) => set((state) => {
        const id = safeId(chatId);
        if (!id) return state;

        return {
          pendingMessages: {
            ...state.pendingMessages,
            [id]: (state.pendingMessages[id] || []).filter(m => m.tempId !== tempId)
          }
        };
      }),

      clearPendingMessages: (chatId) => set((state) => {
        const id = safeId(chatId);
        return {
          pendingMessages: {
            ...state.pendingMessages,
            [id]: []
          }
        };
      }),

      /* ================= ONLINE ================= */
      setUserOnline: (userId, isOnline) => set((state) => {
        const onlineUsers = new Set(state.onlineUsers);
        if (isOnline) onlineUsers.add(userId);
        else onlineUsers.delete(userId);
        return { onlineUsers };
      }),

      clearChats: () =>
        set({ chats: [], messages: {}, activeChat: null, pendingMessages: {} })
    }),
    {
      // Bump key to invalidate stale sidebar/chat data from older builds.
      name: 'chat-storage-v3',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        chats: state.chatsLoaded ? state.chats : [],
        activeChat: state.activeChat
      })
    }
  )
);
