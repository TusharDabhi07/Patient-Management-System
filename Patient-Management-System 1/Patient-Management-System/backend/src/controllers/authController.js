const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { logAudit } = require('../utils/audit');
require('dotenv').config();

const generateToken = (user) => {
  return jwt.sign(
    { userId: user.user_id, role: user.role, email: user.email, name: user.name },
    process.env.JWT_SECRET || 'pms_secret_key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
};

// POST /api/auth/register  (Patient self-registration)
exports.register = async (req, res) => {
  const { name, email, password, contact_no } = req.body;

  if (!name || name.length < 3) {
    return res.status(400).json({ message: 'Name must be at least 3 characters.' });
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ message: 'Valid email is required.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  try {
    const [existing] = await pool.execute('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'User already exists.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password, contact_no, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashed, contact_no || null, 'Patient']
    );

    const userId = result.insertId;

    // Create linked patient record with UHID
    const uhid = 'UHID' + String(userId).padStart(6, '0');
    await pool.execute(
      'INSERT INTO patients (uhid, user_id, name, contact_no) VALUES (?, ?, ?, ?)',
      [uhid, userId, name, contact_no || null]
    );

    await logAudit(userId, 'CREATE', 'users', `Patient registered: ${email}`);

    const token = generateToken({ user_id: userId, role: 'Patient', email, name });
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { userId, name, email, role: 'Patient', uhid }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }

    // Record login history
    await pool.execute('INSERT INTO login_history (user_id) VALUES (?)', [user.user_id]);
    await logAudit(user.user_id, 'LOGIN', 'users', `User logged in`);

    const token = generateToken(user);

    // Extra info for doctors / patients
    let extra = {};
    if (user.role === 'Doctor') {
      const [docs] = await pool.execute('SELECT doctor_id, department_id FROM doctors WHERE user_id = ?', [user.user_id]);
      if (docs.length) extra = { doctorId: docs[0].doctor_id, departmentId: docs[0].department_id };
    }
    if (user.role === 'Patient') {
      const [pats] = await pool.execute('SELECT patient_id, uhid FROM patients WHERE user_id = ?', [user.user_id]);
      if (pats.length) extra = { patientId: pats[0].patient_id, uhid: pats[0].uhid };
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        userId: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        ...extra
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT user_id, name, email, contact_no, role, created_at FROM users WHERE user_id = ?',
      [req.user.userId]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found.' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch profile.' });
  }
};
