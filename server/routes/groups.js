import express from 'express';
import Group from '../models/Group.js';
import Chat from '../models/Chat.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import crypto from 'crypto';
import { getSocketIO } from '../utils/socketHelper.js';

const router = express.Router();

const toIdString = (value) => value?.toString();

const buildGroupChatPayload = (group, chatDoc) => {
  const chatObj = chatDoc?.toObject ? chatDoc.toObject() : (chatDoc || {});
  const chatId = toIdString(chatObj._id || group.chatId);

  return {
    ...chatObj,
    _id: chatId,
    type: 'group',
    name: group.name,
    profilePhoto: group.profilePhoto || '',
    participants: chatObj.participants || group.memberIds || [],
    lastMessage: chatObj.lastMessage || null,
    lastMessageAt: chatObj.lastMessageAt || new Date()
  };
};

const emitGroupChatToUsers = (userIds, group, chatDoc) => {
  const io = getSocketIO();
  if (!io) return;

  const chatPayload = buildGroupChatPayload(group, chatDoc);
  const chatId = toIdString(chatPayload?._id);
  if (!chatId) return;

  userIds.forEach((userId) => {
    const userIdStr = toIdString(userId);
    if (!userIdStr) return;

    io.in(`user:${userIdStr}`).socketsJoin(`chat:${chatId}`);
    io.to(`user:${userIdStr}`).emit('new-chat', { chat: chatPayload });
  });
};

/* ================= CREATE GROUP ================= */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name, memberIds } = req.body;

    if (!name || name.trim().length < 1) {
      throw new AppError('Group name is required', 400);
    }

    const allMembers = [req.user._id, ...(memberIds || [])];
    const uniqueMembers = [...new Set(allMembers.map((id) => id.toString()))];

    // Existing behavior: same name reuses existing group and adds new members.
    let group = await Group.findOne({ name: name.trim() }).populate('chatId');

    if (group) {
      const existingMemberIds = group.memberIds.map((id) => id.toString());
      const chat = await Chat.findById(group.chatId._id);
      const existingChatParticipantIds = chat.participants.map((id) => id.toString());

      const newMembers = uniqueMembers.filter((memberId) => !existingMemberIds.includes(memberId));
      const combinedMemberIds = [...new Set([...existingMemberIds, ...uniqueMembers])];
      const combinedChatParticipantIds = [...new Set([...existingChatParticipantIds, ...uniqueMembers])];

      group.memberIds = combinedMemberIds;
      chat.participants = combinedChatParticipantIds;

      await group.save();
      await chat.save();

      await group.populate('memberIds', 'username profilePhoto');
      await group.populate('adminIds', 'username profilePhoto');
      await group.populate('chatId');

      emitGroupChatToUsers(newMembers, group, chat);

      return res.json({ success: true, group });
    }

    const chat = await Chat.create({
      type: 'group',
      participants: uniqueMembers
    });

    const inviteLink = crypto.randomBytes(32).toString('hex');

    group = await Group.create({
      name: name.trim(),
      adminIds: [req.user._id],
      memberIds: uniqueMembers,
      chatId: chat._id,
      inviteLink
    });

    await group.populate('memberIds', 'username profilePhoto');
    await group.populate('adminIds', 'username profilePhoto');
    await group.populate('chatId');

    emitGroupChatToUsers(uniqueMembers, group, chat);

    res.json({ success: true, group });
  } catch (error) {
    next(error);
  }
});

/* ================= GET USER GROUPS ================= */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const groups = await Group.find({
      memberIds: req.user._id
    })
      .populate('memberIds', 'username profilePhoto')
      .populate('adminIds', 'username profilePhoto')
      .populate('chatId')
      .sort({ updatedAt: -1 });

    res.json({ success: true, groups });
  } catch (error) {
    next(error);
  }
});

/* ================= GET SINGLE GROUP ================= */
router.get('/:groupId', authenticate, async (req, res, next) => {
  try {
    const group = await Group.findOne({
      _id: req.params.groupId,
      memberIds: req.user._id
    })
      .populate('memberIds', 'username profilePhoto isOnline')
      .populate('adminIds', 'username profilePhoto')
      .populate('chatId');

    if (!group) throw new AppError('Group not found', 404);

    res.json({ success: true, group });
  } catch (error) {
    next(error);
  }
});

/* ================= UPDATE GROUP ================= */
router.put('/:groupId', authenticate, async (req, res, next) => {
  try {
    const group = await Group.findOne({
      _id: req.params.groupId,
      adminIds: req.user._id
    });

    if (!group) throw new AppError('Group not found or unauthorized', 404);

    if (req.body.name) group.name = req.body.name;
    if (req.body.description !== undefined) group.description = req.body.description;
    if (req.body.settings) group.settings = { ...group.settings, ...req.body.settings };

    await group.save();

    await group.populate('memberIds', 'username profilePhoto');
    await group.populate('adminIds', 'username profilePhoto');
    await group.populate('chatId');

    res.json({ success: true, group });
  } catch (error) {
    next(error);
  }
});

/* ================= ADD MEMBERS ================= */
router.post('/:groupId/members', authenticate, async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) throw new AppError('Group not found', 404);

    const isAdmin = group.adminIds.some(
      (id) => id.toString() === req.user._id.toString()
    );

    if (group.settings?.onlyAdminsCanAddMembers && !isAdmin) {
      throw new AppError('Only admins can add members', 403);
    }

    const { memberIds = [] } = req.body;

    const newMembers = memberIds.filter(
      (id) => !group.memberIds.some((member) => member.toString() === id.toString())
    );

    group.memberIds.push(...newMembers);
    await group.save();

    const chat = await Chat.findById(group.chatId);
    chat.participants.push(...newMembers);
    await chat.save();

    await group.populate('memberIds', 'username profilePhoto');
    await group.populate('chatId');

    emitGroupChatToUsers(newMembers, group, chat);

    res.json({ success: true, group });
  } catch (error) {
    next(error);
  }
});

/* ================= REMOVE MEMBER ================= */
router.delete('/:groupId/members/:userId', authenticate, async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) throw new AppError('Group not found', 404);

    const isAdmin = group.adminIds.some(
      (id) => id.toString() === req.user._id.toString()
    );

    const isRemovingSelf = req.params.userId === req.user._id.toString();

    if (!isAdmin && !isRemovingSelf) {
      throw new AppError('Unauthorized', 403);
    }

    group.memberIds = group.memberIds.filter(
      (id) => id.toString() !== req.params.userId
    );

    group.adminIds = group.adminIds.filter(
      (id) => id.toString() !== req.params.userId
    );

    await group.save();

    const chat = await Chat.findById(group.chatId);
    chat.participants = chat.participants.filter(
      (id) => id.toString() !== req.params.userId
    );
    await chat.save();

    res.json({ success: true, message: 'Member removed' });
  } catch (error) {
    next(error);
  }
});

/* ================= MAKE ADMIN ================= */
router.post('/:groupId/admins/:userId', authenticate, async (req, res, next) => {
  try {
    const group = await Group.findOne({
      _id: req.params.groupId,
      adminIds: req.user._id
    });

    if (!group) throw new AppError('Group not found or unauthorized', 404);

    if (!group.memberIds.some(
      (id) => id.toString() === req.params.userId
    )) {
      throw new AppError('User is not a member', 400);
    }

    if (!group.adminIds.some(
      (id) => id.toString() === req.params.userId
    )) {
      group.adminIds.push(req.params.userId);
      await group.save();
    }

    res.json({ success: true, message: 'Admin added' });
  } catch (error) {
    next(error);
  }
});

/* ================= JOIN VIA INVITE ================= */
router.post('/join/:inviteLink', authenticate, async (req, res, next) => {
  try {
    const group = await Group.findOne({
      inviteLink: req.params.inviteLink
    });

    if (!group) throw new AppError('Invalid invite link', 404);

    if (group.memberIds.some(
      (id) => id.toString() === req.user._id.toString()
    )) {
      await group.populate('chatId');
      return res.json({ success: true, group, message: 'Already a member' });
    }

    group.memberIds.push(req.user._id);
    await group.save();

    const chat = await Chat.findById(group.chatId);
    chat.participants.push(req.user._id);
    await chat.save();

    await group.populate('memberIds', 'username profilePhoto');
    await group.populate('chatId');

    emitGroupChatToUsers([req.user._id], group, chat);

    res.json({ success: true, group });
  } catch (error) {
    next(error);
  }
});

export default router;
