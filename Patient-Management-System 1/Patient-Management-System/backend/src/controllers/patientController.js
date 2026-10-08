const pool = require('../config/db');
const { logAudit } = require('../utils/audit');

// Generate next UHID
async function generateUHID() {
  const [rows] = await pool.execute('SELECT MAX(patient_id) as maxId FROM patients');
  const next = (rows[0].maxId || 0) + 1;
  return 'UHID' + String(next).padStart(6, '0');
}

// POST /api/patients  (Receptionist)
exports.registerPatient = async (req, res) => {
  const {
    name, date_of_birth, gender, blood_group, allergies,
    address, emergency_contact, contact_no
  } = req.body;

  if (!name || name.length < 3) {
    return res.status(400).json({ message: 'Name must be at least 3 characters.' });
  }

  try {
    // Duplicate check
    const [dups] = await pool.execute(
      `SELECT patient_id, uhid, name FROM patients 
       WHERE name = ? AND date_of_birth = ? AND contact_no = ?`,
      [name, date_of_birth || null, contact_no || null]
    );
    if (dups.length > 0) {
      return res.status(409).json({
        message: 'A patient with similar details already exists.',
        existing: dups[0]
      });
    }

    const uhid = await generateUHID();
    const [result] = await pool.execute(
      `INSERT INTO patients 
       (uhid, name, date_of_birth, gender, blood_group, allergies, address, emergency_contact, contact_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uhid, name, date_of_birth || null, gender || null, blood_group || null,
       allergies || null, address || null, emergency_contact || null, contact_no || null]
    );

    await logAudit(req.user.userId, 'CREATE', 'patients', `Registered patient ${uhid}`);

    res.status(201).json({
      message: 'Patient registered successfully',
      patient: { patientId: result.insertId, uhid, name }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to register patient.' });
  }
};

// GET /api/patients?search=
exports.searchPatients = async (req, res) => {
  const { search } = req.query;
  try {
    let query = 'SELECT patient_id, uhid, name, date_of_birth, gender, blood_group, contact_no, registered_at FROM patients';
    let params = [];
    if (search) {
      query += ' WHERE uhid LIKE ? OR name LIKE ? OR contact_no LIKE ?';
      const s = `%${search}%`;
      params = [s, s, s];
    }
    query += ' ORDER BY registered_at DESC LIMIT 50';
    const [rows] = await pool.execute(query, params);
    res.json({ patients: rows });
  } catch (err) {
    res.status(500).json({ message: 'Search failed.' });
  }
};

// GET /api/patients/:id
exports.getPatient = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM patients WHERE patient_id = ?',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Patient not found.' });

    // RBAC: Patient can only see own
    if (req.user.role === 'Patient') {
      const [own] = await pool.execute('SELECT patient_id FROM patients WHERE user_id = ?', [req.user.userId]);
      if (!own.length || own[0].patient_id != req.params.id) {
        return res.status(403).json({ message: 'Access denied.' });
      }
    }

    await logAudit(req.user.userId, 'VIEW', 'patients', `Viewed patient ${req.params.id}`);
    res.json({ patient: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch patient.' });
  }
};

// PUT /api/patients/:id
exports.updatePatient = async (req, res) => {
  const { name, date_of_birth, gender, blood_group, allergies, address, emergency_contact, contact_no } = req.body;
  try {
    await pool.execute(
      `UPDATE patients SET name=?, date_of_birth=?, gender=?, blood_group=?, allergies=?, 
       address=?, emergency_contact=?, contact_no=? WHERE patient_id=?`,
      [name, date_of_birth, gender, blood_group, allergies, address, emergency_contact, contact_no, req.params.id]
    );
    await logAudit(req.user.userId, 'UPDATE', 'patients', `Updated patient ${req.params.id}`);
    res.json({ message: 'Patient updated successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Update failed.' });
  }
};
