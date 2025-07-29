import User from './User.js';
import Session from './Session.js';
import AuditLog from './AuditLog.js';

// Define associations between models
function setupAssociations() {
  // User has many Sessions
  User.hasMany(Session, {
    foreignKey: 'userId',
    as: 'sessions'
  });
  
  // Session belongs to a User
  Session.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
  });
  
  // User has many AuditLogs (as the user who performed the action)
  User.hasMany(AuditLog, {
    foreignKey: 'userId',
    as: 'actionLogs'
  });
  
  // AuditLog belongs to a User (the user who performed the action)
  AuditLog.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user'
  });
  
  // User has many AuditLogs (as the admin who performed the action)
  User.hasMany(AuditLog, {
    foreignKey: 'adminId',
    as: 'adminActions'
  });
  
  // AuditLog belongs to a User (the admin who performed the action, can be null)
  AuditLog.belongsTo(User, {
    foreignKey: 'adminId',
    as: 'admin'
  });
  
  console.log('Model associations have been set up');
}

export { setupAssociations };
