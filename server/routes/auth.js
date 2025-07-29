import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import Session from '../models/Session.js';
import AuditLog from '../models/AuditLog.js';

const router = express.Router();

// Helper to get client IP
const getClientIp = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null);
};

// Login route
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    const user = await User.findOne({ where: { username } });
    
    // Check if user exists and is not banned
    if (!user || user.isBanned) {
      await AuditLog.create({
        userId: user ? user.id : null,
        action: 'login',
        details: 'Failed login attempt - invalid credentials',
        ipAddress,
        userAgent
      });
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await AuditLog.create({
        userId: user.id,
        action: 'login',
        details: 'Failed login attempt - invalid password',
        ipAddress,
        userAgent
      });
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Create session token
    const sessionToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    // Create session in database
    await Session.create({
      userId: user.id,
      token: sessionToken,
      ipAddress,
      userAgent,
      expiresAt,
      lastActivity: new Date()
    });

    // Update user's last login and login count
    await user.update({
      lastLogin: new Date(),
      loginCount: (user.loginCount || 0) + 1
    });

    // Log successful login
    await AuditLog.create({
      userId: user.id,
      action: 'login',
      details: 'User logged in successfully',
      ipAddress,
      userAgent
    });

    // Generate JWT
    const token = jwt.sign(
      { 
        userId: user.id,
        isAdmin: user.isAdmin,
        sessionId: sessionToken
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({ 
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        lastLogin: user.lastLogin,
        loginCount: user.loginCount
      },
      token,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Update session last activity
    if (decoded.sessionId) {
      await Session.update(
        { lastActivity: new Date() },
        { where: { token: decoded.sessionId } }
      );
    }

    res.json({ 
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        lastLogin: user.lastLogin,
        loginCount: user.loginCount
      }
    });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
  }
});

// Logout route
router.post('/logout', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      if (decoded.sessionId) {
        // Mark session as revoked
        await Session.update(
          { isRevoked: true },
          { where: { token: decoded.sessionId } }
        );

        // Log the logout
        await AuditLog.create({
          userId: decoded.userId,
          action: 'logout',
          details: 'User logged out',
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent']
        });
      }
    }
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'Server error during logout' });
  }
});

// Check session validity
router.get('/check-session', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ valid: false });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const session = await Session.findOne({
      where: { 
        token: decoded.sessionId,
        isRevoked: false,
        expiresAt: { [Sequelize.Op.gt]: new Date() }
      },
      include: [{
        model: User,
        attributes: ['id', 'username', 'isAdmin', 'isBanned']
      }]
    });

    if (!session || !session.User || session.User.isBanned) {
      return res.json({ valid: false });
    }

    // Update last activity
    await session.update({ lastActivity: new Date() });

    res.json({
      valid: true,
      user: {
        id: session.User.id,
        username: session.User.username,
        isAdmin: session.User.isAdmin
      }
    });
  } catch (error) {
    res.json({ valid: false });
  }
});

export default router;
