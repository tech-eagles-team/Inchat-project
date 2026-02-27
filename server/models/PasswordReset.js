import mongoose from 'mongoose';
import crypto from 'crypto';

const passwordResetSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true
    },
    resetToken: {
        type: String,
        required: true,
        unique: true
    },
    resetTokenHash: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expireAfterSeconds: 0 }
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// TTL index for automatic expiration
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Generate reset token
passwordResetSchema.statics.generate = function (userId, email) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    return { resetToken, resetTokenHash, expiresAt };
};

// Verify reset token
passwordResetSchema.methods.verifyToken = function (resetToken) {
    const hash = crypto.createHash('sha256').update(resetToken).digest('hex');
    return hash === this.resetTokenHash && this.expiresAt > new Date() && !this.isUsed;
};

export default mongoose.model('PasswordReset', passwordResetSchema);
