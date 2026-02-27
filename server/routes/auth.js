import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import { generateTokens, createSession, refreshAccessToken, invalidateSession } from '../utils/jwt.js';
import { generateEncryptionKey, generateKeyPair } from '../utils/encryption.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { AppError } from '../middleware/errorHandler.js';
import { normalizeEmail } from '../utils/emailNormalizer.js';

const router = express.Router();

// Register new user
router.post('/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('username').trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username must be 3-30 characters, alphanumeric and underscores only'),
    body('phoneNumber').optional().trim().custom((value) => {
      if (value && !/^\+?[1-9]\d{1,14}$/.test(value)) {
        throw new Error('Phone number must be in E.164 format (e.g., +1234567890)');
      }
      return true;
    })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => err.msg).join(', ');
        return res.status(400).json({
          success: false,
          error: errorMessages,
          errors: errors.array()
        });
      }

      const { email, password, username, phoneNumber } = req.body;

      // Normalize email for consistent storage
      const normalizedEmail = normalizeEmail(email);

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { email: normalizedEmail },
          { email: email.toLowerCase() },
          ...(username && username.trim() ? [{ username: username.toLowerCase().trim() }] : []),
          ...(phoneNumber && phoneNumber.trim() ? [{ phoneNumber: phoneNumber.trim() }] : [])
        ]
      });

      if (existingUser) {
        const existingEmailNormalized = normalizeEmail(existingUser.email);
        if (existingEmailNormalized === normalizedEmail || existingUser.email === email.toLowerCase()) {
          return res.status(400).json({
            success: false,
            error: 'Email already registered'
          });
        }
        if (username && username.trim() && existingUser.username === username.toLowerCase().trim()) {
          return res.status(400).json({
            success: false,
            error: 'Username already taken'
          });
        }
        if (existingUser.phoneNumber === phoneNumber.trim()) {
          return res.status(400).json({
            success: false,
            error: 'Phone number already registered'
          });
        }
      }

      // Create new user with normalized email
      const encryptionKey = generateEncryptionKey();
      const { publicKey } = generateKeyPair();

      const user = new User({
        email: normalizedEmail,
        username: username.toLowerCase().trim(),
        phoneNumber: phoneNumber && phoneNumber.trim() ? phoneNumber.trim() : undefined,
        isEmailVerified: true,
        encryptionKey,
        publicKey
      });

      await user.setPassword(password);
      await user.save();

      const { accessToken, refreshToken } = generateTokens(user._id.toString());

      const deviceInfo = {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        deviceType: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop'
      };

      await createSession(user._id.toString(), accessToken, refreshToken, deviceInfo);

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          phoneNumber: user.phoneNumber,
          profilePhoto: user.profilePhoto,
          isEmailVerified: user.isEmailVerified
        },
        tokens: {
          accessToken,
          refreshToken
        }
      });
    } catch (error) {
      // Handle MongoDB duplicate key errors
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern || {})[0] || 'field';
        return res.status(400).json({
          success: false,
          error: `${field === 'email' ? 'Email' : field === 'username' ? 'Username' : 'Field'} already exists`
        });
      }

      // Handle validation errors
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors || {}).map(e => e.message).join(', ');
        return res.status(400).json({
          success: false,
          error: messages || 'Validation error'
        });
      }

      // Log error for debugging
      console.error('Registration error:', {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        code: error.code,
        name: error.name
      });

      next(error);
    }
  }
);

// Login
router.post('/login',
  authLimiter,
  [
    body('email').notEmpty().withMessage('Email or username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }

      // Normalize email (handles Gmail dot-ignoring)
      const normalizedEmail = normalizeEmail(email);
      const emailLower = email.toLowerCase().trim();

      // Find user by normalized email, original email, or username
      const user = await User.findOne({
        $or: [
          { email: normalizedEmail },
          { email: emailLower },
          { username: emailLower }
        ]
      }).select('+password');

      if (!user) {
        console.error('Login failed: User not found', {
          searchedEmail: emailLower,
          searchedAs: 'email or username'
        });
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      // Check if password field was actually loaded
      if (!user.password) {
        console.error('Login failed: Password field not loaded or not set', {
          userId: user._id,
          email: user.email,
          hasPasswordField: 'password' in user
        });
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        console.error('Login failed: Password mismatch', {
          userId: user._id,
          email: user.email,
          passwordHashPrefix: user.password?.substring(0, 10)
        });
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      console.log('Login successful:', { userId: user._id, email: user.email });

      // Update last seen
      user.lastSeen = new Date();
      await user.save();

      const { accessToken, refreshToken } = generateTokens(user._id.toString());

      const deviceInfo = {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        deviceType: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop'
      };

      await createSession(user._id, accessToken, refreshToken, deviceInfo);

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          profilePhoto: user.profilePhoto,
          isEmailVerified: user.isEmailVerified
        },
        tokens: {
          accessToken,
          refreshToken
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Change Password
router.post('/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must be at least 8 characters with uppercase, lowercase, and number')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const user = await User.findById(req.user._id).select('+password');
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Verify current password
      const isPasswordValid = await user.comparePassword(req.body.currentPassword);
      if (!isPasswordValid) {
        throw new AppError('Current password is incorrect', 400);
      }

      // Set new password
      await user.setPassword(req.body.newPassword);
      await user.save();

      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Refresh Token
router.post('/refresh-token', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new AppError('Refresh token required', 400);
    }

    const accessToken = await refreshAccessToken(refreshToken);
    res.json({ success: true, accessToken });
  } catch (error) {
    next(new AppError('Invalid refresh token', 401));
  }
});

// Logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await invalidateSession(req.token);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -encryptionKey -publicKey');

    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
});

// Forgot Password - Request Reset
router.post('/forgot-password',
  [
    body('email').isEmail().notEmpty().withMessage('Valid email is required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { email } = req.body;
      const normalizedEmail = normalizeEmail(email);

      const user = await User.findOne({
        $or: [
          { email: normalizedEmail },
          { email: email.toLowerCase() }
        ]
      });

      // Always return success for security (don't reveal if email exists)
      if (!user) {
        return res.json({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.'
        });
      }

      // Generate reset token
      const PasswordReset = (await import('../models/PasswordReset.js')).default;
      const { resetToken, resetTokenHash, expiresAt } = PasswordReset.generate(user._id, user.email);

      // Save reset token to database
      await PasswordReset.create({
        userId: user._id,
        email: user.email,
        resetToken,
        resetTokenHash,
        expiresAt
      });

      // TODO: Send email with reset link
      // const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
      // await sendPasswordResetEmail(user.email, resetLink);

      res.json({
        success: true,
        message: 'Password reset link sent to email (email functionality not configured)'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Reset Password - Complete Reset
router.post('/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must be at least 8 characters with uppercase, lowercase, and number')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { token, newPassword } = req.body;
      const PasswordReset = (await import('../models/PasswordReset.js')).default;

      const resetRecord = await PasswordReset.findOne({ resetToken: token });

      if (!resetRecord || !resetRecord.verifyToken(token)) {
        throw new AppError('Invalid or expired reset token', 400);
      }

      const user = await User.findById(resetRecord.userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Update password
      await user.setPassword(newPassword);
      await user.save();

      // Mark token as used
      resetRecord.isUsed = true;
      await resetRecord.save();

      res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Reset Password - Direct Reset (without token)
router.post('/reset-password-direct',
  authLimiter,
  [
    body('email').isEmail().notEmpty().withMessage('Valid email is required'),
    body('newPassword').isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => err.msg).join(', ');
        return res.status(400).json({
          success: false,
          error: errorMessages,
          errors: errors.array()
        });
      }

      const { email, newPassword } = req.body;
      const normalizedEmail = normalizeEmail(email);

      // Find user by email
      const user = await User.findOne({
        $or: [
          { email: normalizedEmail },
          { email: email.toLowerCase() }
        ]
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User with this email not found'
        });
      }

      // Update password
      await user.setPassword(newPassword);
      await user.save();

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

