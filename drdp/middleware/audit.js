const { getDb, saveDatabase } = require('../db');
const { v4: uuidv4 } = require('uuid');

function auditLog(actorId, action, targetTable, targetId, beforeValue, afterValue) {
  try {
    const db = getDb();
    db.run(`INSERT INTO audit_logs (id, actor_id, action, target_table, target_id, before_value, after_value)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), actorId, action, targetTable, targetId,
        beforeValue ? JSON.stringify(beforeValue) : null,
        afterValue  ? JSON.stringify(afterValue)  : null]
    );
    saveDatabase();
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

module.exports = { auditLog };
