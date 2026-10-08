const pool = require('../config/db');
const { logAudit } = require('../utils/audit');

// GET /api/beds
exports.listBeds = async (req, res) => {
  const { ward, status } = req.query;
  try {
    let query = `
      SELECT b.bed_id, b.bed_number, b.status, w.ward_id, w.ward_name, w.ward_type, w.charge_per_day
      FROM beds b JOIN wards w ON b.ward_id = w.ward_id WHERE 1=1
    `;
    const params = [];
    if (ward) { query += ' AND b.ward_id = ?'; params.push(ward); }
    if (status) { query += ' AND b.status = ?'; params.push(status); }
    query += ' ORDER BY w.ward_name, b.bed_number';
    const [rows] = await pool.execute(query, params);
    res.json({ beds: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to list beds.' });
  }
};

// POST /api/admissions  (with transaction + row lock)
exports.admitPatient = async (req, res) => {
  const { patientId, doctorId, bedId, reason } = req.body;
  if (!patientId || !doctorId || !bedId) {
    return res.status(400).json({ message: 'patientId, doctorId and bedId are required.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the bed row
    const [beds] = await conn.execute(
      'SELECT * FROM beds WHERE bed_id = ? FOR UPDATE',
      [bedId]
    );
    if (!beds.length || beds[0].status !== 'Available') {
      await conn.rollback();
      return res.status(409).json({ message: 'Selected bed is not available.' });
    }

    // Create admission
    const [result] = await conn.execute(
      `INSERT INTO admissions (patient_id, doctor_id, bed_id, reason, status)
       VALUES (?, ?, ?, ?, 'Admitted')`,
      [patientId, doctorId, bedId, reason || null]
    );

    // Mark bed occupied
    await conn.execute(`UPDATE beds SET status = 'Occupied' WHERE bed_id = ?`, [bedId]);

    await conn.commit();

    await logAudit(req.user.userId, 'CREATE', 'admissions', `Admitted patient ${patientId} to bed ${bedId}`);

    res.status(201).json({
      message: 'Patient admitted successfully',
      admissionId: result.insertId,
      bedNumber: beds[0].bed_number,
      status: 'Admitted'
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Admission failed.' });
  } finally {
    conn.release();
  }
};

// PUT /api/admissions/:id/transfer
exports.transferPatient = async (req, res) => {
  const { newBedId } = req.body;
  if (!newBedId) return res.status(400).json({ message: 'newBedId required.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [adm] = await conn.execute('SELECT * FROM admissions WHERE admission_id = ? AND status = "Admitted"', [req.params.id]);
    if (!adm.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Active admission not found.' });
    }

    const [newBed] = await conn.execute('SELECT * FROM beds WHERE bed_id = ? FOR UPDATE', [newBedId]);
    if (!newBed.length || newBed[0].status !== 'Available') {
      await conn.rollback();
      return res.status(409).json({ message: 'Target bed is not available.' });
    }

    // Free old bed
    await conn.execute(`UPDATE beds SET status = 'Available' WHERE bed_id = ?`, [adm[0].bed_id]);
    // Occupy new
    await conn.execute(`UPDATE beds SET status = 'Occupied' WHERE bed_id = ?`, [newBedId]);
    // Update admission
    await conn.execute(`UPDATE admissions SET bed_id = ? WHERE admission_id = ?`, [newBedId, req.params.id]);

    await conn.commit();
    await logAudit(req.user.userId, 'UPDATE', 'admissions', `Transferred admission ${req.params.id} to bed ${newBedId}`);
    res.json({ message: 'Patient transferred successfully.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Transfer failed.' });
  } finally {
    conn.release();
  }
};

// PUT /api/admissions/:id/discharge
exports.dischargePatient = async (req, res) => {
  const { dischargeSummary, force = false } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [adm] = await conn.execute('SELECT * FROM admissions WHERE admission_id = ? AND status = "Admitted"', [req.params.id]);
    if (!adm.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Active admission not found.' });
    }

    // Check pending bills (unless Admin force)
    if (!force || req.user.role !== 'Admin') {
      const [bills] = await conn.execute(
        `SELECT bill_id FROM bills WHERE admission_id = ? AND payment_status != 'Paid'`,
        [req.params.id]
      );
      if (bills.length > 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'Discharge not allowed until bill is cleared.' });
      }
    }

    await conn.execute(
      `UPDATE admissions SET status = 'Discharged', discharge_date = NOW(), discharge_summary = ? WHERE admission_id = ?`,
      [dischargeSummary || null, req.params.id]
    );
    await conn.execute(`UPDATE beds SET status = 'Available' WHERE bed_id = ?`, [adm[0].bed_id]);

    await conn.commit();
    await logAudit(req.user.userId, 'UPDATE', 'admissions', `Discharged admission ${req.params.id}`);
    res.json({ message: 'Patient discharged successfully. Bed released.' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Discharge failed.' });
  } finally {
    conn.release();
  }
};

// GET /api/admissions/current
exports.currentAdmissions = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT a.*, p.uhid, p.name as patient_name, u.name as doctor_name,
              b.bed_number, w.ward_name
       FROM admissions a
       JOIN patients p ON a.patient_id = p.patient_id
       JOIN doctors d ON a.doctor_id = d.doctor_id
       JOIN users u ON d.user_id = u.user_id
       JOIN beds b ON a.bed_id = b.bed_id
       JOIN wards w ON b.ward_id = w.ward_id
       WHERE a.status = 'Admitted'
       ORDER BY a.admit_date DESC`
    );
    res.json({ admissions: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load admissions.' });
  }
};
