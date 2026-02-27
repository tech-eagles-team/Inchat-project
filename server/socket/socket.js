import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import { encryptMessage } from '../utils/encryption.js';

const connectedUsers = new Map();
const toIdString = (value) => value?.toString();

const isChatParticipant = (chat, userId) =>
  chat?.participants?.some((participantId) => toIdString(participantId) === toIdString(userId));

const ensureUnreadCountMap = (chat) => {
  if (chat.unreadCount instanceof Map) return;
  chat.unreadCount = new Map(Object.entries(chat.unreadCount || {}));
};

const emitMessageToParticipants = (io, chat, message, chatId) => {
  const chatIdStr = toIdString(chatId);
  chat.participants.forEach((participantId) => {
    const userIdStr = toIdString(participantId);
    io.to(`user:${userIdStr}`).emit('new-message', {
      message,
      chatId: chatIdStr
    });
  });
};

const emitReadReceiptToParticipants = (io, chat, chatId, userId) => {
  const chatIdStr = toIdString(chatId);
  const userIdStr = toIdString(userId);

  chat.participants.forEach((participantId) => {
    const participantIdStr = toIdString(participantId);
    io.to(`user:${participantIdStr}`).emit('messages-read', {
      chatId: chatIdStr,
      userId: userIdStr
    });
  });
};

export const initializeSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        console.warn('⚠️ Socket connection attempt without token');
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user) {
        console.warn(`⚠️ Socket auth: User not found - ${decoded.userId}`);
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      console.log(`✅ Socket authenticated for user: ${socket.userId}`);
      next();
    } catch (error) {
      console.error('❌ Socket auth error:', error.message);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.userId}`);

    // Add to connected users
    connectedUsers.set(socket.userId, socket.id);

    // Update user online status
    User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      lastSeen: new Date()
    }).catch(err => console.error('Failed to update user status:', err));

    // Notify contacts - broadcast to all sockets
    socket.broadcast.emit('user-online', { userId: socket.userId });

    // Join user's room
    const userIdStr = socket.userId.toString();
    socket.join(`user:${userIdStr}`);
    console.log(`✅ User joined room: user:${userIdStr}`);

    // Join user's chats
    Chat.find({ participants: socket.userId })
      .then(chats => {
        chats.forEach(chat => {
          const chatIdStr = chat._id.toString();
          socket.join(`chat:${chatIdStr}`);
          console.log(`✅ User ${userIdStr} joined chat room: chat:${chatIdStr}`);
        });
        console.log(`✅ User ${userIdStr} joined ${chats.length} chat rooms total`);
      })
      .catch(err => console.error('Failed to join chat rooms:', err));

    // Send message
    socket.on('send-message', async (data) => {
      try {
        const { chatId, content, type, replyTo } = data || {};
        const chatIdStr = toIdString(chatId);
        const messageType = type || 'text';

        if (!chatIdStr) {
          return socket.emit('error', { message: 'chatId is required' });
        }

        const chat = await Chat.findOne({
          _id: chatIdStr,
          participants: socket.userId
        });

        if (!chat) {
          console.error('Chat not found:', chatIdStr);
          return socket.emit('error', { message: 'Chat not found' });
        }

        // Normalize payload to match Message schema across socket + REST paths.
        const normalizedContent = (() => {
          if (messageType !== 'text') {
            if (content && typeof content === 'object') return content;
            return {};
          }

          const text = typeof content === 'string'
            ? content
            : (content?.text || '');

          return { text: text.trim() };
        })();

        if (messageType === 'text' && !normalizedContent.text) {
          return socket.emit('error', { message: 'Message text is required' });
        }

        const messagePayload = {
          chatId: chatIdStr,
          senderId: socket.userId,
          type: messageType,
          content: normalizedContent,
          replyTo,
          deliveredTo: chat.participants,
          createdAt: new Date(),
          isEncrypted: false
        };

        if (messageType === 'text' && socket.user?.encryptionKey) {
          try {
            const { encrypted } = encryptMessage(normalizedContent.text, socket.user.encryptionKey);
            messagePayload.encryptedContent = encrypted;
            messagePayload.isEncrypted = true;
          } catch (encryptionError) {
            console.warn('Socket message encryption failed, storing plaintext content only');
          }
        }

        const message = await Message.create(messagePayload);

        chat.lastMessage = message._id;
        chat.lastMessageAt = new Date();

        // Update unread counts for other participants
        ensureUnreadCountMap(chat);
        chat.participants.forEach(participantId => {
          if (participantId.toString() !== socket.userId) {
            const current = chat.unreadCount.get(participantId.toString()) || 0;
            chat.unreadCount.set(participantId.toString(), current + 1);
          }
        });

        await chat.save();

        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'username profilePhoto')
          .populate('replyTo');

        // Emit to each participant user-room so delivery does not depend on chat-room join timing.
        emitMessageToParticipants(io, chat, populatedMessage, chatIdStr);

        // Update chat list for all participants
        chat.participants.forEach(participantId => {
          const userIdStr = participantId.toString();
          io.to(`user:${userIdStr}`).emit('chat-updated', {
            chatId: chatIdStr,
            lastMessage: populatedMessage,
            lastMessageAt: chat.lastMessageAt
          });
        });
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: error.message });
      }
    });

    // Mark as read
    socket.on('mark-read', async (data) => {
      try {
        const { chatId } = data || {};
        if (!chatId) return;
        const chat = await Chat.findById(chatId);

        if (!chat || !isChatParticipant(chat, socket.userId)) {
          return;
        }

        await Message.updateMany(
          {
            chatId,
            senderId: { $ne: socket.userId },
            'readBy.userId': { $ne: socket.userId }
          },
          {
            $push: {
              readBy: {
                userId: socket.userId,
                readAt: new Date()
              }
            }
          }
        );

        ensureUnreadCountMap(chat);
        chat.unreadCount.set(socket.userId.toString(), 0);
        await chat.save();

        emitReadReceiptToParticipants(io, chat, chatId, socket.userId);
      } catch (error) {
        console.error('Mark read error:', error);
        socket.emit('error', { message: error.message });
      }
    });

    // Join chat room
    socket.on('join-chat', (chatId) => {
      const chatIdStr = toIdString(chatId);
      if (!chatIdStr) return;
      socket.join(`chat:${chatIdStr}`);
      console.log(`✅ User ${socket.userId} joined chat room: chat:${chatIdStr}`);
    });

    // Leave chat room
    socket.on('leave-chat', (chatId) => {
      const chatIdStr = toIdString(chatId);
      if (!chatIdStr) return;
      socket.leave(`chat:${chatIdStr}`);
      console.log(`✅ User ${socket.userId} left chat room: chat:${chatIdStr}`);
    });

    // Call events
    socket.on('start-call', async (data) => {
      try {
        const { receiverId, callType, chatId } = data;

        // This would typically create a call record and notify the receiver
        // For now, just emit to receiver
        const receiverSocketId = connectedUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('incoming-call', {
            callerId: socket.userId,
            callType: callType || 'audio',
            chatId
          });
        }
      } catch (error) {
        console.error('Start call error:', error);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('answer-call', async (data) => {
      try {
        const { callId } = data;
        // Update call status to accepted
        // Emit to caller that call was answered
        socket.emit('call-answered', { callId });
      } catch (error) {
        console.error('Answer call error:', error);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('decline-call', async (data) => {
      try {
        const { callId } = data;
        // Update call status to declined
        // Emit to caller that call was declined
        socket.emit('call-declined', { callId });
      } catch (error) {
        console.error('Decline call error:', error);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('end-call', async (data) => {
      try {
        const { callId } = data;
        // Update call status to ended
        // Emit to other participants that call ended
        socket.emit('call-ended', { callId });
      } catch (error) {
        console.error('End call error:', error);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('call-signal', (data) => {
      const { callId, targetUserId, signalType, signalData } = data;
      // Forward WebRTC signaling data
      if (targetUserId) {
        const targetSocketId = connectedUsers.get(targetUserId);
        if (targetSocketId) {
          io.to(targetSocketId).emit('call-signal', {
            callId,
            fromUserId: socket.userId,
            signalType,
            signalData
          });
        }
      }
    });

    socket.on('join-call-room', (data) => {
      const { callId } = data;
      socket.join(`call:${callId}`);
      console.log(`User ${socket.userId} joined call room ${callId}`);
    });

    socket.on('leave-call-room', (data) => {
      const { callId } = data;
      socket.leave(`call:${callId}`);
      console.log(`User ${socket.userId} left call room ${callId}`);
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log(`❌ User disconnected: ${socket.userId}`);
      connectedUsers.delete(socket.userId);

      // Update user offline status
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date()
      }).catch(err => console.error('Failed to update offline status:', err));

      // Notify all connected users that someone went offline
      const userIdStr = socket.userId.toString();
      io.emit('user-offline', { userId: userIdStr });
    });
  });
};

