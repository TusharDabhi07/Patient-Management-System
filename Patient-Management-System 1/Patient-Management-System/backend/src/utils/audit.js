const pool = require('../config/db');

async function logAudit(userId, action, entity, details = null) {
  try {
    await pool.execute(
      'INSERT INTO audit_logs (user_id, action, entity, details) VALUES (?, ?, ?, ?)',
      [userId, action, entity, details]
    );
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { logAudit };
