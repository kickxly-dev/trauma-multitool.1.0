import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users', // Changed from 'users' to 'Users' to match model name
      key: 'id'
    }
  },
  adminId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users', // Changed from 'users' to 'Users' to match model name
      key: 'id'
    }
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [
        ['login', 'logout', 'create_user', 'update_user', 'delete_user', 
         'ban_user', 'unban_user', 'kick_user', 'role_change']
      ]
    }
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'audit_logs',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['admin_id'] },
    { fields: ['action'] },
    { fields: ['created_at'] }
  ]
});

export default AuditLog;
