import mongoose from 'mongoose';

const callSchema = new mongoose.Schema({
    callerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    chatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat'
    },
    callType: {
        type: String,
        enum: ['audio', 'video'],
        default: 'audio'
    },
    status: {
        type: String,
        enum: ['ringing', 'accepted', 'declined', 'ended', 'missed'],
        default: 'ringing'
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: {
        type: Date
    },
    duration: {
        type: Number, // in seconds
        default: 0
    },
    participants: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        leftAt: {
            type: Date
        }
    }],
    isGroupCall: {
        type: Boolean,
        default: false
    },
    roomId: {
        type: String,
        unique: true
    }
}, {
    timestamps: true
});

// Index for efficient queries
callSchema.index({ callerId: 1, createdAt: -1 });
callSchema.index({ receiverId: 1, createdAt: -1 });
callSchema.index({ status: 1 });
// roomId index is automatically created by unique: true

// Pre-save middleware to generate roomId
callSchema.pre('save', function (next) {
    if (!this.roomId) {
        this.roomId = `call_${this._id}`;
    }
    next();
});

export default mongoose.model('Call', callSchema);