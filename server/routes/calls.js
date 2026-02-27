import express from 'express';
import Call from '../models/Call.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getSocketIO } from '../utils/socketHelper.js';

const router = express.Router();

// Get call history
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const calls = await Call.find({
            $or: [
                { callerId: req.user._id },
                { receiverId: req.user._id }
            ]
        })
            .populate('callerId', 'username profilePhoto')
            .populate('receiverId', 'username profilePhoto')
            .populate('chatId', 'name isGroup')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skip);

        const total = await Call.countDocuments({
            $or: [
                { callerId: req.user._id },
                { receiverId: req.user._id }
            ]
        });

        res.json({
            calls,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
});

// Create a new call
router.post('/', authenticate, async (req, res, next) => {
    try {
        const { receiverId, callType = 'audio', chatId } = req.body;

        if (!receiverId) {
            throw new AppError('Receiver ID is required', 400);
        }

        // Check if receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            throw new AppError('Receiver not found', 404);
        }

        // Check if chat exists (optional)
        if (chatId) {
            const chat = await Chat.findOne({
                _id: chatId,
                participants: { $all: [req.user._id, receiverId] }
            });
            if (!chat) {
                throw new AppError('Chat not found', 404);
            }
        }

        const call = new Call({
            callerId: req.user._id,
            receiverId,
            callType,
            chatId,
            status: 'ringing'
        });

        await call.save();
        await call.populate('callerId', 'username profilePhoto');
        await call.populate('receiverId', 'username profilePhoto');

        // Emit socket event to receiver
        const io = getSocketIO();
        io.to(receiverId.toString()).emit('incoming-call', {
            call: call.toObject(),
            caller: call.callerId
        });

        res.status(201).json(call);
    } catch (error) {
        next(error);
    }
});

// Get call details
router.get('/:callId', authenticate, async (req, res, next) => {
    try {
        const { callId } = req.params;

        const call = await Call.findOne({
            _id: callId,
            $or: [
                { callerId: req.user._id },
                { receiverId: req.user._id }
            ]
        })
            .populate('callerId', 'username profilePhoto')
            .populate('receiverId', 'username profilePhoto')
            .populate('chatId', 'name isGroup')
            .populate('participants.userId', 'username profilePhoto');

        if (!call) {
            throw new AppError('Call not found', 404);
        }

        res.json(call);
    } catch (error) {
        next(error);
    }
});

// Update call status
router.put('/:callId', authenticate, async (req, res, next) => {
    try {
        const { callId } = req.params;
        const { status, duration } = req.body;

        const call = await Call.findOne({
            _id: callId,
            $or: [
                { callerId: req.user._id },
                { receiverId: req.user._id }
            ]
        });

        if (!call) {
            throw new AppError('Call not found', 404);
        }

        // Update status
        if (status) {
            call.status = status;

            if (status === 'ended' || status === 'declined') {
                call.endTime = new Date();
                if (duration !== undefined) {
                    call.duration = duration;
                } else if (call.startTime) {
                    call.duration = Math.floor((call.endTime - call.startTime) / 1000);
                }
            }
        }

        await call.save();

        // Emit socket event
        const io = getSocketIO();
        const roomId = call.roomId;
        io.to(roomId).emit('call-status-updated', {
            callId,
            status: call.status,
            duration: call.duration
        });

        res.json(call);
    } catch (error) {
        next(error);
    }
});

// End call
router.delete('/:callId', authenticate, async (req, res, next) => {
    try {
        const { callId } = req.params;

        const call = await Call.findOneAndUpdate(
            {
                _id: callId,
                $or: [
                    { callerId: req.user._id },
                    { receiverId: req.user._id }
                ],
                status: { $ne: 'ended' }
            },
            {
                status: 'ended',
                endTime: new Date(),
                duration: function () {
                    return this.startTime ? Math.floor((new Date() - this.startTime) / 1000) : 0;
                }
            },
            { new: true }
        );

        if (!call) {
            throw new AppError('Call not found or already ended', 404);
        }

        // Emit socket event
        const io = getSocketIO();
        const roomId = call.roomId;
        io.to(roomId).emit('call-ended', {
            callId,
            duration: call.duration
        });

        res.json({ message: 'Call ended successfully', call });
    } catch (error) {
        next(error);
    }
});

// Get active calls
router.get('/active', authenticate, async (req, res, next) => {
    try {
        const activeCalls = await Call.find({
            $or: [
                { callerId: req.user._id },
                { receiverId: req.user._id }
            ],
            status: { $in: ['ringing', 'accepted'] }
        })
            .populate('callerId', 'username profilePhoto')
            .populate('receiverId', 'username profilePhoto')
            .sort({ createdAt: -1 });

        res.json(activeCalls);
    } catch (error) {
        next(error);
    }
});

// Join call (for group calls)
router.post('/:callId/join', authenticate, async (req, res, next) => {
    try {
        const { callId } = req.params;

        const call = await Call.findOne({
            _id: callId,
            status: { $in: ['ringing', 'accepted'] }
        });

        if (!call) {
            throw new AppError('Call not found or not active', 404);
        }

        // Add participant
        const existingParticipant = call.participants.find(
            p => p.userId.toString() === req.user._id.toString()
        );

        if (!existingParticipant) {
            call.participants.push({
                userId: req.user._id,
                joinedAt: new Date()
            });
            await call.save();
        }

        // Join socket room
        const io = getSocketIO();
        const socket = req.socket;
        if (socket) {
            socket.join(call.roomId);
        }

        res.json({ message: 'Joined call successfully', call });
    } catch (error) {
        next(error);
    }
});

// Leave call
router.post('/:callId/leave', authenticate, async (req, res, next) => {
    try {
        const { callId } = req.params;

        const call = await Call.findOne({
            _id: callId,
            'participants.userId': req.user._id
        });

        if (!call) {
            throw new AppError('Call not found', 404);
        }

        // Update participant left time
        const participant = call.participants.find(
            p => p.userId.toString() === req.user._id.toString()
        );

        if (participant && !participant.leftAt) {
            participant.leftAt = new Date();
            await call.save();
        }

        // Leave socket room
        const io = getSocketIO();
        const socket = req.socket;
        if (socket) {
            socket.leave(call.roomId);
        }

        res.json({ message: 'Left call successfully' });
    } catch (error) {
        next(error);
    }
});

// Send call signal (WebRTC signaling)
router.post('/:callId/signal', authenticate, async (req, res, next) => {
    try {
        const { callId } = req.params;
        const { signalType, signalData, targetUserId } = req.body;

        const call = await Call.findOne({
            _id: callId,
            $or: [
                { callerId: req.user._id },
                { receiverId: req.user._id },
                { 'participants.userId': req.user._id }
            ]
        });

        if (!call) {
            throw new AppError('Call not found', 404);
        }

        // Emit signal to target user or room
        const io = getSocketIO();
        const signalPayload = {
            callId,
            fromUserId: req.user._id,
            signalType,
            signalData
        };

        if (targetUserId) {
            io.to(targetUserId).emit('call-signal', signalPayload);
        } else {
            io.to(call.roomId).emit('call-signal', signalPayload);
        }

        res.json({ message: 'Signal sent successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;