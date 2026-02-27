import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';
import User from '../models/User.js';
import Session from '../models/Session.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    console.log('🔐 Auth check - Token present:', !!token);

    if (!token) {
      throw new AppError('Authentication required', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verified for user:', decoded.userId);

    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      console.error('❌ User not found:', decoded.userId);
      throw new AppError('User not found', 404);
    }

    // Check if session is valid
    const session = await Session.findOne({
      userId: user._id,
      token,
      isActive: true
    });

    if (!session) {
      console.warn('⚠️ Session not found or inactive');
      throw new AppError('Session expired or invalid', 401);
    }

    // Update last activity
    await Session.updateOne(
      { _id: session._id },
      { lastActivity: new Date() }
    );

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('❌ Auth error:', error.message);

    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Token expired', 401));
    }
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError('Authentication failed', 401));
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    next();
  }
};

