import express from 'express';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Group from '../models/Group.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();
const ensureUnreadCountMap = (chat) => {
  if (chat.unreadCount instanceof Map) return;
  chat.unreadCount = new Map(Object.entries(chat.unreadCount || {}));
};

// Get all chats for user
router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user._id.toString();

    const chats = await Chat.find({
      participants: req.user._id
    })
      .populate('participants', 'username profilePhoto isOnline lastSeen')
      .sort({ lastMessageAt: -1 })
      .lean();

    // Get the last message for each chat that is not deleted for this user
    const chatIds = chats.map(chat => chat._id);
    const lastMessages = await Message.find({
      chatId: { $in: chatIds },
      isDeleted: false,
      deletedFor: { $ne: req.user._id }
    })
      .populate('senderId', 'username profilePhoto')
      .sort({ createdAt: -1 })
      .lean();

    // Group last messages by chatId
    const lastMessageMap = {};
    lastMessages.forEach(msg => {
      if (!lastMessageMap[msg.chatId.toString()]) {
        lastMessageMap[msg.chatId.toString()] = msg;
      }
    });

    // Attach lastMessage to chats and keep chats even if no messages yet.
    const chatsWithMessages = chats.map(chat => {
      const lastMsg = lastMessageMap[chat._id.toString()];
      if (lastMsg) {
        chat.lastMessage = lastMsg;
        chat.lastMessageAt = lastMsg.createdAt;
      }
      return chat;
    });

    // Re-sort chats by the updated lastMessageAt (most recent first)
    chatsWithMessages.sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tb - ta;
    });

    // Get group info
    const groupChatIds = chatsWithMessages
      .filter(chat => chat.type === 'group')
      .map(chat => chat._id);

    const groups = await Group.find({
      chatId: { $in: groupChatIds }
    })
      .select('name profilePhoto chatId')
      .lean();

    const groupMap = {};
    groups.forEach(group => {
      groupMap[group.chatId.toString()] = group;
    });

    const formattedChats = chatsWithMessages.map(chat => {
      const unread = chat.unreadCount?.[userId] || 0;
      const otherParticipant = chat.participants.find(
        p => p._id.toString() !== userId
      );

      if (chat.type === 'group') {
        const group = groupMap[chat._id.toString()];

        return {
          ...chat,
          unreadCount: unread,
          name: group?.name || 'Group Chat',
          profilePhoto: group?.profilePhoto || null
        };
      }

      return {
        ...chat,
        unreadCount: unread,
        otherParticipant
      };
    });

    res.json({ success: true, chats: formattedChats });

  } catch (error) {
    next(error);
  }
});
// Get or create private chat
router.post('/private/:userId', authenticate, async (req, res, next) => {
  try {
    const otherUserId = req.params.userId;

    if (otherUserId === req.user._id.toString()) {
      throw new AppError('Cannot create chat with yourself', 400);
    }

    const otherUser = await User.findById(otherUserId);
    if (!otherUser) throw new AppError('User not found', 404);

    // Check if blocked
    if (otherUser.blockedUsers.includes(req.user._id)) {
      throw new AppError('You are blocked by this user', 403);
    }

    let chat = await Chat.findOne({
      type: 'private',
      participants: { $all: [req.user._id, otherUserId] }
    })
      .populate('participants', 'username profilePhoto isOnline lastSeen')
      .populate('lastMessage');

    if (!chat) {
      chat = await Chat.create({
        type: 'private',
        participants: [req.user._id, otherUserId]
      });
      await chat.populate('participants', 'username profilePhoto isOnline lastSeen');

      // Notify the other user about the new chat
      const { getSocketIO } = await import('../utils/socketHelper.js');
      const io = getSocketIO();
      if (io) {
        const chatIdStr = chat._id.toString();
        const requesterIdStr = req.user._id.toString();
        const otherUserIdStr = otherUserId.toString();

        // Join every active socket of both users to the room immediately.
        io.in(`user:${requesterIdStr}`).socketsJoin(`chat:${chatIdStr}`);
        io.in(`user:${otherUserIdStr}`).socketsJoin(`chat:${chatIdStr}`);

        io.to(`user:${requesterIdStr}`).emit('new-chat', { chat });
        io.to(`user:${otherUserIdStr}`).emit('new-chat', { chat });
      }
    }

    res.json({ success: true, chat });
  } catch (error) {
    next(error);
  }
});

// Get chat by ID
router.get('/:chatId', authenticate, async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      participants: req.user._id
    })
      .populate('participants', 'username profilePhoto isOnline lastSeen')
      .populate('lastMessage');

    if (!chat) throw new AppError('Chat not found', 404);

    // Reset unread count
    ensureUnreadCountMap(chat);
    chat.unreadCount.set(req.user._id.toString(), 0);
    await chat.save();

    res.json({ success: true, chat });
  } catch (error) {
    next(error);
  }
});

// Archive/Unarchive chat
router.post('/:chatId/archive', authenticate, async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      participants: req.user._id
    });

    if (!chat) throw new AppError('Chat not found', 404);

    const isArchived = chat.isArchived?.get(req.user._id.toString()) || false;
    chat.isArchived.set(req.user._id.toString(), !isArchived);
    await chat.save();

    res.json({ success: true, isArchived: !isArchived });
  } catch (error) {
    next(error);
  }
});

// Mute/Unmute chat
router.post('/:chatId/mute', authenticate, async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      participants: req.user._id
    });

    if (!chat) throw new AppError('Chat not found', 404);

    const isMuted = chat.isMuted?.get(req.user._id.toString()) || false;
    chat.isMuted.set(req.user._id.toString(), !isMuted);
    await chat.save();

    res.json({ success: true, isMuted: !isMuted });
  } catch (error) {
    next(error);
  }
});

// Clear chat (delete all messages for current user)
router.delete('/:chatId/clear', authenticate, async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      participants: req.user._id
    });

    if (!chat) throw new AppError('Chat not found', 404);

    // Mark all messages as deleted for this user
    await Message.updateMany(
      { chatId: chat._id },
      { $addToSet: { deletedFor: req.user._id } }
    );

    // Reset unread count for this user
    ensureUnreadCountMap(chat);
    chat.unreadCount.set(req.user._id.toString(), 0);
    await chat.save();

    res.json({ success: true, message: 'Chat cleared' });
  } catch (error) {
    next(error);
  }
});

// Leave chat (remove user from chat)
router.delete('/:chatId/leave', authenticate, async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      participants: req.user._id
    });

    if (!chat) throw new AppError('Chat not found', 404);

    // Remove user from participants
    chat.participants = chat.participants.filter(p => p.toString() !== req.user._id.toString());

    // If no participants left, delete the chat entirely
    if (chat.participants.length === 0) {
      await Message.deleteMany({ chatId: chat._id });
      await Chat.deleteOne({ _id: chat._id });
    } else {
      await chat.save();
    }

    res.json({ success: true, message: 'Left chat successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
