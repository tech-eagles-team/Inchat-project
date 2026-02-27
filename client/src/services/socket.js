import { io } from 'socket.io-client';
import { useChatStore } from '../store/chatStore';
import { useCallStore } from '../store/callStore';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

class SocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.recentMessageEvents = new Map();
    this.recentChatEvents = new Map();
    this.recentToastEvents = new Map();
  }

  normalizeId(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value._id) return value._id.toString();
    return value.toString ? value.toString() : null;
  }

  isRecentEvent(cache, key, ttlMs = 5000) {
    if (!cache || !key) return false;

    const now = Date.now();
    const previous = cache.get(key);
    if (previous && now - previous < ttlMs) {
      return true;
    }

    cache.set(key, now);

    if (cache.size > 500) {
      for (const [cachedKey, timestamp] of cache.entries()) {
        if (now - timestamp > ttlMs) {
          cache.delete(cachedKey);
        }
      }
    }

    return false;
  }

  getSocketURL() {
    return import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
  }

  connect(token) {
    if (!token) {
      console.error('No token provided, cannot connect to socket');
      return false;
    }

    if (this.socket) {
      // Update token and reconnect if already exists
      this.socket.auth = { token };
      if (!this.socket.connected) {
        console.log('Socket exists but not connected, reconnecting...');
        this.socket.connect();
      }
      return true;
    }

    try {
      const socketURL = this.getSocketURL();
      console.log(`🔌 Connecting to socket at ${socketURL}`);

      this.socket = io(socketURL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
        forceNew: false,
        secure: socketURL.startsWith('https'),
        rejectUnauthorized: false
      });

      this.attachEventListeners();
      return true;
    } catch (error) {
      console.error('Failed to initialize socket:', error);
      toast.error('Failed to connect to server');
      return false;
    }
  }

  // Update token and force reconnection if socket exists
  updateToken(newToken) {
    if (!newToken) {
      console.error('Cannot update socket with null token');
      return false;
    }

    if (this.socket) {
      console.log('🔄 Updating socket token and reconnecting...');
      this.socket.auth = { token: newToken };

      // Force disconnect and reconnect to apply new token
      this.socket.disconnect();
      setTimeout(() => {
        if (this.socket) {
          this.socket.connect();
        }
      }, 100);
      return true;
    }

    // If socket doesn't exist, next connect() will use new token
    return true;
  }

  attachEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected successfully');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('💔 Socket disconnected:', reason);
      if (reason === 'auth error' || reason === 'io server disconnect') {
        this.disconnect();
        if (reason === 'auth error') {
          console.error('❌ Socket authentication failed - token may be invalid');
          toast.error('Authentication failed. Please login again.');
          useAuthStore.getState().logout();
        }
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      this.reconnectAttempts++;
      console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error(`❌ Socket connection failed after ${this.maxReconnectAttempts} attempts`);
        toast.error('Connection failed. Please refresh the page and try again.');
      }
    });

    this.socket.on('new-message', (data) => {
      const { addMessage, updateChat, activeChat, chats } = useChatStore.getState();
      const { message, chatId } = data || {};
      const normalizedChatId = this.normalizeId(chatId);
      const normalizedMessageId = this.normalizeId(message?._id);

      console.log(`Received new message in chat ${normalizedChatId}:`, message);

      // Validate required fields
      if (!message || !normalizedChatId) {
        console.error('❌ Invalid message data - missing message or chatId:', data);
        return;
      }

      // Require message ID - never allow null
      if (!normalizedMessageId) {
        console.error('❌ Invalid message data - missing message ID:', data);
        return;
      }

      // Create event key ONLY from IDs, never from timestamps
      const eventKey = `${normalizedChatId}:${normalizedMessageId}`;

      // Increase TTL to 10 seconds to account for rapid message sends
      if (this.isRecentEvent(this.recentMessageEvents, eventKey, 10000)) {
        console.log(`⚠️ Duplicate message event filtered (ID: ${normalizedMessageId})`);
        return;
      }

      addMessage(normalizedChatId, message);
      updateChat(normalizedChatId, {
        lastMessage: message,
        lastMessageAt: message.createdAt
      });

      const activeChatId = this.normalizeId(activeChat?._id);
      const currentUser = useAuthStore.getState().user;
      const currentUserId = this.normalizeId(currentUser?.id || currentUser?._id);
      const senderId = this.normalizeId(message?.senderId?._id || message?.senderId);

      if (activeChatId === normalizedChatId && senderId && senderId !== currentUserId) {
        this.markAsRead(normalizedChatId);
      }

      if (activeChatId !== normalizedChatId) {
        const chat = chats.find((c) => this.normalizeId(c._id) === normalizedChatId);
        if (chat) {
          updateChat(normalizedChatId, {
            unreadCount: (chat.unreadCount || 0) + 1
          });
        }

        if (!senderId || senderId !== currentUserId) {
          const senderName = message.senderId?.username || 'Unknown';
          // Toast notification key based on message ID (more reliable)
          const toastKey = `toast:${normalizedMessageId}`;
          if (!this.isRecentEvent(this.recentToastEvents, toastKey, 10000)) {
            toast.success(`New message from ${senderName}`);
          }
        }
      }
    });

    this.socket.on('chat-updated', (data) => {
      const { updateChat } = useChatStore.getState();
      const chatId = this.normalizeId(data?.chatId);
      const lastMessageId = this.normalizeId(data?.lastMessage?._id || data?.lastMessage);

      if (!chatId) return;

      // Use a more reliable key that includes the message ID
      // This prevents filtering out legitimate concurrent updates
      const chatUpdateKey = `chat-updated:${chatId}:${lastMessageId || ''}`;

      // Increased TTL from 4000ms to 5000ms to avoid filtering legitimate rapid updates
      if (this.isRecentEvent(this.recentChatEvents, chatUpdateKey, 5000)) {
        console.log(`⚠️ Duplicate chat update filtered for chat ${chatId}`);
        return;
      }

      console.log('Chat updated:', data);
      updateChat(chatId, { ...data, chatId });
    });

    this.socket.on('new-chat', (data) => {
      const { addChat } = useChatStore.getState();
      if (!data?.chat) return;

      const chatId = this.normalizeId(data.chat._id || data.chat.id);
      if (!chatId) return;

      if (this.isRecentEvent(this.recentChatEvents, `new-chat:${chatId}`, 7000)) {
        return;
      }

      console.log('New chat received:', data);
      addChat({ ...data.chat, _id: chatId });

      // Join immediately so the user receives real-time events even before opening the chat.
      this.joinChat(chatId);
    });

    this.socket.on('messages-read', (data) => {
      const { markMessagesRead } = useChatStore.getState();
      const chatId = this.normalizeId(data?.chatId);
      const userId = this.normalizeId(data?.userId);

      if (!chatId || !userId) return;

      markMessagesRead(chatId, userId);
    });

    this.socket.on('user-online', (data) => {
      const { setUserOnline } = useChatStore.getState();
      if (data?.userId) {
        setUserOnline(data.userId, true);
      }
    });

    this.socket.on('user-offline', (data) => {
      const { setUserOnline } = useChatStore.getState();
      if (data?.userId) {
        setUserOnline(data.userId, false);
      }
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      const errorMsg = typeof error === 'string' ? error : error?.message || 'Socket error';
      if (!errorMsg.includes('auth')) {
        toast.error(errorMsg);
      }
    });

    this.socket.on('user-profile-updated', (data) => {
      const { userId, userData } = data || {};
      const { updateUserInChats } = useChatStore.getState();
      if (userId && userData) {
        updateUserInChats(userId, userData);
      }
    });

    this.socket.on('incoming-call', (data) => {
      const { setActiveCall, updateCallStatus } = useCallStore.getState();
      const { call } = data || {};
      if (!call) return;

      setActiveCall(call);
      updateCallStatus('ringing');
      toast.info(`Incoming ${call.callType} call from ${call.callerId.username}`);
    });

    this.socket.on('call-status-updated', (data) => {
      const { updateCallStatus, endCall } = useCallStore.getState();
      const { status } = data || {};

      if (status === 'ended') {
        endCall();
        toast.info('Call ended');
      } else if (status) {
        updateCallStatus(status);
      }
    });

    this.socket.on('call-ended', () => {
      const { endCall } = useCallStore.getState();
      endCall();
      toast.info('Call ended');
    });

    this.socket.on('call-signal', (data) => {
      const { callId, fromUserId, signalType } = data || {};
      console.log('Received call signal:', { callId, fromUserId, signalType });
    });

    this.socket.on('emergency-logout', () => {
      console.warn('Emergency logout from server');
      toast.error('Session expired. Please login again.');
      this.disconnect();
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.off('connect');
      this.socket.off('disconnect');
      this.socket.off('connect_error');
      this.socket.off('error');
      this.socket.disconnect();
      this.socket = null;
      this.reconnectAttempts = 0;
      this.recentMessageEvents.clear();
      this.recentChatEvents.clear();
      this.recentToastEvents.clear();
    }
  }

  isConnected() {
    return this.socket?.connected ?? false;
  }

  sendMessage(chatId, content, type = 'text', replyTo = null) {
    if (!this.socket?.connected) {
      console.error('Socket not connected');
      throw new Error('Socket not connected. Please try again.');
    }

    const normalizedChatId = this.normalizeId(chatId);
    if (!normalizedChatId) {
      throw new Error('Invalid chatId');
    }

    console.log(`Sending message to chat ${normalizedChatId}:`, { content, type });
    this.socket.emit('send-message', {
      chatId: normalizedChatId,
      content,
      type,
      replyTo
    });
  }

  markAsRead(chatId) {
    if (this.socket?.connected) {
      const normalizedChatId = this.normalizeId(chatId);
      if (normalizedChatId) {
        this.socket.emit('mark-read', { chatId: normalizedChatId });
      }
    }
  }

  joinChat(chatId) {
    if (this.socket?.connected) {
      const normalizedChatId = this.normalizeId(chatId);
      if (normalizedChatId) {
        this.socket.emit('join-chat', normalizedChatId);
      }
    }
  }

  leaveChat(chatId) {
    if (this.socket?.connected) {
      const normalizedChatId = this.normalizeId(chatId);
      if (normalizedChatId) {
        this.socket.emit('leave-chat', normalizedChatId);
      }
    }
  }

  startCall(callData) {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected. Please try again.');
    }

    this.socket.emit('start-call', callData);
  }

  answerCall(callId) {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected. Please try again.');
    }

    this.socket.emit('answer-call', { callId });
  }

  declineCall(callId) {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected. Please try again.');
    }

    this.socket.emit('decline-call', { callId });
  }

  endCall(callId) {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected. Please try again.');
    }

    this.socket.emit('end-call', { callId });
  }

  sendCallSignal(callId, signalData) {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected. Please try again.');
    }

    this.socket.emit('call-signal', { callId, ...signalData });
  }

  joinCallRoom(callId) {
    if (this.socket?.connected) {
      this.socket.emit('join-call-room', { callId });
    }
  }

  leaveCallRoom(callId) {
    if (this.socket?.connected) {
      this.socket.emit('leave-call-room', { callId });
    }
  }
}

export const socketService = new SocketService();
