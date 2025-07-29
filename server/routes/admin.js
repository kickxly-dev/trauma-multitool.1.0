import express from 'express';
import { Op } from 'sequelize';
import { auth, isAdmin } from '../middleware/auth.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import AuditLog from '../models/AuditLog.js';

const router = express.Router();

// Apply auth and admin middleware to all routes
router.use(auth, isAdmin);

// Get all users with pagination and search
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    if (search) {
      whereClause[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });
    
    // Get active sessions count for each user
    const userIds = users.map(user => user.id);
    const activeSessions = await Session.findAll({
      where: {
        userId: { [Op.in]: userIds },
        expiresAt: { [Op.gt]: new Date() }
      },
      attributes: ['userId', [sequelize.fn('COUNT', sequelize.col('id')), 'sessionCount']],
      group: ['userId']
    });

    // Add session count to each user
    const usersWithSessions = users.map(user => {
      const userSessions = activeSessions.find(s => s.userId === user.id);
      return {
        ...user.get({ plain: true }),
        activeSessions: userSessions ? parseInt(userSessions.get('sessionCount')) : 0
      };
    });
    
    res.json({
      success: true,
      data: usersWithSessions,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// Create a new user
router.post('/users', async (req, res) => {
  try {
    const { username, email, password, role = 'user' } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username, email, and password are required' 
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      where: { 
        [Op.or]: [
          { username },
          { email }
        ]
      } 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'User with this username or email already exists' 
      });
    }
    
    // Create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      role,
      isActive: true
    });
    
    // Log the action
    await AuditLog.create({
      userId: req.user.id,
      action: 'create_user',
      details: `Created user ${username} (${email})`,
      ipAddress: req.ip
    });
    
    // Return user data without password
    const userData = user.get({ plain: true });
    delete userData.password;
    
    res.status(201).json({
      success: true,
      data: userData
    });
    
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create user',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get user details with sessions and activity
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Session,
          as: 'sessions',
          limit: 10,
          order: [['updatedAt', 'DESC']]
        },
        {
          model: AuditLog,
          as: 'activityLogs',
          limit: 10,
          order: [['createdAt', 'DESC']]
        }
      ]
    });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Get active sessions count
    const activeSessions = await Session.count({
      where: {
        userId: user.id,
        expiresAt: { [Op.gt]: new Date() }
      }
    });
    
    const userData = user.get({ plain: true });
    userData.activeSessions = activeSessions;
    
    res.json({ success: true, data: userData });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch user details',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const { username, email, isAdmin: adminStatus, isBanned } = req.body;
    const userId = req.params.id;

    // Prevent modifying own admin status
    if (req.user.id === userId && req.body.isAdmin !== undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot modify your own admin status' 
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Log the update
    const changes = [];
    if (username !== undefined && user.username !== username) {
      changes.push(`username from "${user.username}" to "${username}"`);
    }
    if (email !== undefined && user.email !== email) {
      changes.push(`email from "${user.email}" to "${email}"`);
    }
    if (adminStatus !== undefined && user.isAdmin !== adminStatus) {
      changes.push(`admin status to ${adminStatus ? 'true' : 'false'}`);
    }
    if (isBanned !== undefined && user.isBanned !== isBanned) {
      changes.push(`banned status to ${isBanned ? 'true' : 'false'}`);
    }

    await user.update({
      username,
      email,
      isAdmin: adminStatus,
      isBanned
    });

    // Log the changes
    if (changes.length > 0) {
      await AuditLog.create({
        userId: user.id,
        adminId: req.user.id,
        action: 'update_user',
        details: `Updated user: ${changes.join(', ')}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
    }

    res.json({ 
      success: true, 
      message: 'User updated successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        isBanned: user.isBanned,
        lastLogin: user.lastLogin,
        loginCount: user.loginCount,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        error: 'You cannot delete your own account' 
      });
    }
    
    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Log the action before deletion
    await AuditLog.create({
      userId: req.user.id,
      action: 'delete_user',
      details: `Deleted user ${user.username} (${user.id})`,
      ipAddress: req.ip
    });
    
    // Delete user sessions
    await Session.destroy({ where: { userId } });
    
    // Delete the user
    await user.destroy();
    
    res.json({ 
      success: true, 
      message: 'User deleted successfully' 
    });
    
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete user',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Ban/Unban user
router.post('/users/:id/ban', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, isBanned = true } = req.body;
    
    // Prevent self-ban
    if (id === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        error: 'You cannot ban/unban yourself' 
      });
    }
    
    // Find user
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Update ban status
    user.isBanned = isBanned;
    if (isBanned && reason) {
      user.banReason = reason;
    } else {
      user.banReason = null;
    }
    
    await user.save();
    
    // Log the action
    await AuditLog.create({
      userId: req.user.id,
      action: isBanned ? 'ban_user' : 'unban_user',
      details: `${isBanned ? 'Banned' : 'Unbanned'} user ${user.username} (${user.id})`,
      ipAddress: req.ip,
      metadata: reason ? { reason } : undefined
    });
    
    // If banning, also terminate all active sessions
    if (isBanned) {
      await Session.destroy({ 
        where: { 
          userId: user.id,
          expiresAt: { [Op.gt]: new Date() }
        } 
      });
    }
    
    res.json({ 
      success: true, 
      message: `User ${isBanned ? 'banned' : 'unbanned'} successfully`,
      data: {
        id: user.id,
        isBanned: user.isBanned,
        banReason: user.banReason
      }
    });
    
  } catch (error) {
    console.error('Error updating ban status:', error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to ${req.body.isBanned ? 'ban' : 'unban'} user`,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all sessions with pagination and filters
router.get('/sessions', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      userId, 
      activeOnly = 'true',
      sortBy = 'updatedAt',
      sortOrder = 'DESC'
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    
    // Filter by user ID if provided
    if (userId) {
      whereClause.userId = userId;
    }
    
    // Filter active sessions only if requested
    if (activeOnly === 'true') {
      whereClause.expiresAt = { [Op.gt]: new Date() };
    }
    
    const { count, rows: sessions } = await Session.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          attributes: ['id', 'username', 'email'],
          as: 'user'
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]]
    });
    
    // Format session data
    const formattedSessions = sessions.map(session => ({
      id: session.id,
      userId: session.userId,
      username: session.user?.username || 'Unknown',
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      lastActive: session.updatedAt,
      expiresAt: session.expiresAt,
      isActive: session.expiresAt > new Date(),
      createdAt: session.createdAt
    }));
    
    res.json({
      success: true,
      data: formattedSessions,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch sessions',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Terminate a session
router.delete('/sessions/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    // Find the session
    const session = await Session.findByPk(sessionId, {
      include: [
        {
          model: User,
          attributes: ['id', 'username'],
          as: 'user'
        }
      ]
    });
    
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    // Prevent terminating your own session
    if (session.userId === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        error: 'You cannot terminate your own session' 
      });
    }
    
    // Log the action
    await AuditLog.create({
      userId: req.user.id,
      action: 'terminate_session',
      details: `Terminated session for user ${session.user?.username || 'Unknown'} (${session.userId})`,
      ipAddress: req.ip,
      metadata: {
        sessionId: session.id,
        targetIp: session.ipAddress,
        userAgent: session.userAgent
      }
    });
    
    // Delete the session
    await session.destroy();
    
    res.json({ 
      success: true, 
      message: 'Session terminated successfully' 
    });
    
  } catch (error) {
    console.error('Error terminating session:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to terminate session',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Terminate all sessions for a user
router.delete('/users/:id/sessions', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Prevent terminating your own sessions
    if (userId === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        error: 'You cannot terminate your own sessions' 
      });
    }
    
    // Find the user
    const user = await User.findByPk(userId, {
      attributes: ['id', 'username']
    });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Get active sessions count before deletion
    const activeSessions = await Session.count({
      where: {
        userId,
        expiresAt: { [Op.gt]: new Date() }
      }
    });
    
    if (activeSessions === 0) {
      return res.json({ 
        success: true, 
        message: 'No active sessions to terminate' 
      });
    }
    
    // Log the action
    await AuditLog.create({
      userId: req.user.id,
      action: 'terminate_all_sessions',
      details: `Terminated all (${activeSessions}) sessions for user ${user.username} (${user.id})`,
      ipAddress: req.ip,
      metadata: { terminatedSessions: activeSessions }
    });
    
    // Delete all active sessions for the user
    await Session.destroy({
      where: {
        userId,
        expiresAt: { [Op.gt]: new Date() }
      }
    });
    
    res.json({ 
      success: true, 
      message: `Terminated ${activeSessions} active session(s)`,
      data: { terminatedSessions: activeSessions }
    });
    
  } catch (error) {
    console.error('Error terminating user sessions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to terminate user sessions',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get audit logs
router.get('/audit-logs', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      action, 
      userId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    const whereClause = {};
    
    // Filter by action if provided
    if (action) {
      whereClause.action = action;
    }
    
    // Filter by user ID if provided
    if (userId) {
      whereClause.userId = userId;
    }
    
    // Filter by date range if provided
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
      if (endDate) {
        // Include the entire end date
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        whereClause.createdAt[Op.lte] = endOfDay;
      }
    }
    
    const { count, rows: logs } = await AuditLog.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          attributes: ['id', 'username', 'email'],
          as: 'user'
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, sortOrder.toUpperCase()]]
    });
    
    // Format log data
    const formattedLogs = logs.map(log => ({
      id: log.id,
      action: log.action,
      details: log.details,
      ipAddress: log.ipAddress,
      metadata: log.metadata,
      userId: log.userId,
      username: log.user?.username || 'System',
      createdAt: log.createdAt,
      updatedAt: log.updatedAt
    }));
    
    // Get available actions for filtering
    const actions = await AuditLog.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('action')), 'action']],
      raw: true
    });
    
    res.json({
      success: true,
      data: formattedLogs,
      filters: {
        actions: actions.map(a => a.action).sort()
      },
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch audit logs',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get system stats
router.get('/stats', async (req, res) => {
  console.log('Fetching system stats...');
  
  try {
    // Get counts from the database
    const [
      totalUsers,
      activeSessions,
      todayLogins,
      recentActions
    ] = await Promise.all([
      // Total users count
      User.count(),
      
      // Active sessions count (not expired)
      Session.count({
        where: {
          expiresAt: { [Op.gt]: new Date() }
        }
      }),
      
      // Today's logins
      AuditLog.count({
        where: {
          action: 'login',
          createdAt: { [Op.gte]: new Date().setHours(0, 0, 0, 0) }
        }
      }),
      
      // Recent actions
      AuditLog.findAll({
        include: [
          {
            model: User,
            attributes: ['username'],
            as: 'user'
          }
        ],
        limit: 10,
        order: [['createdAt', 'DESC']]
      })
    ]);
    
    // Format recent actions
    const formattedActions = recentActions.map(action => ({
      id: action.id,
      action: action.action,
      details: action.details,
      user: action.user ? action.user.username : 'System',
      timestamp: action.createdAt
    }));
    
    // Get system information
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      database: {
        dialect: sequelize.getDialect(),
        database: sequelize.getDatabaseName(),
        host: sequelize.config.host
      },
      environment: process.env.NODE_ENV || 'development'
    };
    
    res.json({
      success: true,
      data: {
        totalUsers,
        activeSessions,
        todayLogins,
        recentActions: formattedActions,
        systemInfo
      }
    });
    
  } catch (error) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch system stats',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all active sessions
router.get('/sessions', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows: sessions } = await Session.findAndCountAll({
      where: {
        isRevoked: false,
        expiresAt: { [Op.gt]: new Date() }
      },
      include: [{
        model: User,
        attributes: ['id', 'username', 'isAdmin']
      }],
      order: [['lastActivity', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: sessions,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
  }
});

// Revoke session
router.post('/sessions/revoke/:id', async (req, res) => {
  try {
    const session = await Session.findOne({
      where: {
        id: req.params.id,
        isRevoked: false,
        expiresAt: { [Op.gt]: new Date() }
      },
      include: [{
        model: User,
        attributes: ['id', 'username']
      }]
    });

    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Active session not found' 
      });
    }

    // Prevent revoking your own session
    if (session.userId === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot revoke your own active session' 
      });
    }

    await session.update({ isRevoked: true });

    // Log the action
    await AuditLog.create({
      userId: session.userId,
      adminId: req.user.id,
      action: 'kick_user',
      details: `Revoked session for user ${session.User.username} (IP: ${session.ipAddress})`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ 
      success: true, 
      message: 'Session revoked successfully' 
    });
  } catch (error) {
    console.error('Error revoking session:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke session' });
  }
});

// Get audit logs
router.get('/audit-logs', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      action,
      userId,
      dateFrom,
      dateTo 
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    if (action) whereClause.action = action;
    if (userId) whereClause.userId = userId;
    
    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) whereClause.createdAt[Op.gte] = new Date(dateFrom);
      if (dateTo) whereClause.createdAt[Op.lte] = new Date(dateTo);
    }

    const { count, rows: logs } = await AuditLog.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'admin',
          attributes: ['id', 'username']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: logs,
      pagination: {
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

// Get system statistics
router.get('/stats', async (req, res) => {
  console.log('Fetching system stats...');
  
  try {
    // Get counts from the database
    const totalUsers = await User.count();
    const activeSessions = await Session.count({
      where: {
        expiresAt: { [Op.gt]: new Date() }
      }
    });
    
    // Get today's logins
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayLogins = await AuditLog.count({
      where: {
        action: 'login',
        createdAt: { [Op.gte]: today }
      }
    });
    
    // Get recent actions
    const recentActions = await AuditLog.findAll({
      order: [['createdAt', 'DESC']],
      limit: 10,
      include: [{
        model: User,
        attributes: ['id', 'username'],
        required: false
      }]
    });
    
    const response = {
      success: true,
      data: {
        totalUsers,
        activeSessions,
        todayLogins,
        systemStatus: 'Online',
        recentActivity: recentActions.map(log => ({
          id: log.id,
          action: log.action,
          details: log.details,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          createdAt: log.createdAt,
          user: log.User ? {
            id: log.User.id,
            username: log.User.username
          } : null
        }))
      }
    };
    
    console.log('Sending stats response:', {
      totalUsers,
      activeSessions,
      todayLogins,
      recentActions: recentActions.length
    });
    
    return res.json(response);
    
  } catch (error) {
    console.error('Error in /stats endpoint:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch stats',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;
