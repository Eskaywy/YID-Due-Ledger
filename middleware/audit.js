const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');

const auditLog = async (actorId, action, targetTable, targetId, beforeValue, afterValue) => {
  try {
    const auditId = uuidv4();
    await db.collection('auditLogs').doc(auditId).set({
      id: auditId,
      actorId,
      action,
      targetTable,
      targetId,
      beforeValue: beforeValue ? JSON.stringify(beforeValue) : null,
      afterValue: afterValue ? JSON.stringify(afterValue) : null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
};

module.exports = { auditLog };
