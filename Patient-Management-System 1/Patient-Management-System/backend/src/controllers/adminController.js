const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { logAudit } = require('../utils/audit');

// ========== Users ==========
exports.listUsers = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT user_id, name, email, contact_no, role, is_active, created_at FROM users ORDER BY created_at DESC`
    );
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to list users.' });
  }
};

exports.createUser = async (req, res) => {
  const { name, email, password, contact_no, role, specialization, department_id, license_no, consultation_fee } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'name, email, password and role are required.' });
  }
  if (!['Admin', 'Doctor', 'Receptionist'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role.' });
  }

  try {
    const [existing] = await pool.execute('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ message: 'User already exists.' });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password, contact_no, role) VALUES (?, ?, ?, ?, ?)`,
      [name, email, hashed, contact_no || null, role]
    );
    const userId = result.insertId;

    if (role === 'Doctor') {
      if (!department_id) return res.status(400).json({ message: 'department_id required for Doctor.' });
      await pool.execute(
        `INSERT INTO doctors (user_id, department_id, specialization, license_no, consultation_fee)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, department_id, specialization || null, license_no || null, consultation_fee || 0]
      );
    }

    await logAudit(req.user.userId, 'CREATE', 'users', `Created ${role} user ${email}`);
    res.status(201).json({ message: 'User created', userId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create user.' });
  }
};

exports.updateUserRole = async (req, res) => {
  const { role, is_active } = req.body;
  try {
    const updates = [];
    const params = [];
    if (role) { updates.push('role = ?'); params.push(role); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }
    if (!updates.length) return res.status(400).json({ message: 'Nothing to update.' });
    params.push(req.params.id);
    await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`, params);
    await logAudit(req.user.userId, 'UPDATE', 'users', `Updated user ${req.params.id}`);
    res.json({ message: 'User updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Update failed.' });
  }
};

// ========== Master Data ==========
exports.listDepartments = async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM departments ORDER BY department_name');
  res.json({ departments: rows });
};

exports.addDepartment = async (req, res) => {
  const { department_name } = req.body;
  try {
    const [result] = await pool.execute('INSERT INTO departments (department_name) VALUES (?)', [department_name]);
    await logAudit(req.user.userId, 'CREATE', 'departments', department_name);
    res.status(201).json({ message: 'Department added', departmentId: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Department already exists.' });
    res.status(500).json({ message: 'Failed to add department.' });
  }
};

exports.addWard = async (req, res) => {
  const { ward_name, ward_type, charge_per_day } = req.body;
  try {
    const [result] = await pool.execute(
      'INSERT INTO wards (ward_name, ward_type, charge_per_day) VALUES (?, ?, ?)',
      [ward_name, ward_type || 'General', charge_per_day]
    );
    await logAudit(req.user.userId, 'CREATE', 'wards', ward_name);
    res.status(201).json({ message: 'Ward added', wardId: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Ward already exists.' });
    res.status(500).json({ message: 'Failed to add ward.' });
  }
};

exports.addBed = async (req, res) => {
  const { ward_id, bed_number } = req.body;
  try {
    const [result] = await pool.execute(
      'INSERT INTO beds (ward_id, bed_number, status) VALUES (?, ?, "Available")',
      [ward_id, bed_number]
    );
    await logAudit(req.user.userId, 'CREATE', 'beds', `Bed ${bed_number}`);
    res.status(201).json({ message: 'Bed added', bedId: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Bed already exists in this ward.' });
    res.status(500).json({ message: 'Failed to add bed.' });
  }
};

exports.addMedicine = async (req, res) => {
  const { medicine_name, medicine_type } = req.body;
  try {
    const [result] = await pool.execute(
      'INSERT INTO medicines (medicine_name, medicine_type) VALUES (?, ?)',
      [medicine_name, medicine_type || null]
    );
    await logAudit(req.user.userId, 'CREATE', 'medicines', medicine_name);
    res.status(201).json({ message: 'Medicine added', medicineId: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add medicine.' });
  }
};

exports.listWards = async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM wards ORDER BY ward_name');
  res.json({ wards: rows });
};

// ========== Audit & Dashboard ==========
exports.getAuditLogs = async (req, res) => {
  const { userId, action, limit = 100 } = req.query;
  try {
    let query = `
      SELECT a.*, u.name, u.email FROM audit_logs a
      JOIN users u ON a.user_id = u.user_id WHERE 1=1
    `;
    const params = [];
    if (userId) { query += ' AND a.user_id = ?'; params.push(userId); }
    if (action) { query += ' AND a.action = ?'; params.push(action); }
    query += ' ORDER BY a.log_time DESC LIMIT ?';
    params.push(Number(limit));
    const [rows] = await pool.execute(query, params);
    res.json({ logs: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load audit logs.' });
  }
};

exports.getLoginHistory = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT lh.*, u.name, u.email, u.role
       FROM login_history lh JOIN users u ON lh.user_id = u.user_id
       ORDER BY lh.login_time DESC LIMIT 100`
    );
    res.json({ history: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load login history.' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const [[todayAppts]] = await pool.execute(
      `SELECT COUNT(*) as count FROM appointments WHERE DATE(appointment_date) = CURDATE()`
    );
    const [[newRegs]] = await pool.execute(
      `SELECT COUNT(*) as count FROM patients WHERE DATE(registered_at) = CURDATE()`
    );
    const [[occupied]] = await pool.execute(
      `SELECT COUNT(*) as count FROM beds WHERE status = 'Occupied'`
    );
    const [[totalBeds]] = await pool.execute(`SELECT COUNT(*) as count FROM beds`);
    const [[collections]] = await pool.execute(
      `SELECT COALESCE(SUM(paid_amount),0) as total FROM bills WHERE DATE(bill_date) = CURDATE()`
    );
    const [[pendingBills]] = await pool.execute(
      `SELECT COUNT(*) as count FROM bills WHERE payment_status != 'Paid'`
    );

    res.json({
      todayAppointments: todayAppts.count,
      newRegistrations: newRegs.count,
      bedOccupancy: { occupied: occupied.count, total: totalBeds.count },
      todayCollections: collections.total,
      pendingBills: pendingBills.count
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load stats.' });
  }
};
