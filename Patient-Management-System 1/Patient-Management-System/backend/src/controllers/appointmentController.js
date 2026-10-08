const pool = require('../config/db');
const { logAudit } = require('../utils/audit');

// GET /api/doctors
exports.listDoctors = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT d.doctor_id, u.name, d.specialization, d.consultation_fee, 
              dep.department_name, dep.department_id
       FROM doctors d
       JOIN users u ON d.user_id = u.user_id
       JOIN departments dep ON d.department_id = dep.department_id
       WHERE u.is_active = TRUE`
    );
    res.json({ doctors: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to list doctors.' });
  }
};

// GET /api/doctors/:id/slots?date=YYYY-MM-DD
exports.getSlots = async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: 'Date is required.' });

  try {
    // Simple slots: 09:00 to 17:00 every 30 min
    const allSlots = [];
    for (let h = 9; h < 17; h++) {
      allSlots.push(`${String(h).padStart(2, '0')}:00`);
      allSlots.push(`${String(h).padStart(2, '0')}:30`);
    }

    const [booked] = await pool.execute(
      `SELECT TIME(appointment_date) as t FROM appointments 
       WHERE doctor_id = ? AND DATE(appointment_date) = ? 
       AND status NOT IN ('Cancelled','No Show')`,
      [req.params.id, date]
    );
    const bookedTimes = booked.map(b => b.t?.substring(0, 5));
    const available = allSlots.filter(s => !bookedTimes.includes(s));

    res.json({ date, availableSlots: available });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get slots.' });
  }
};

// POST /api/appointments
exports.bookAppointment = async (req, res) => {
  const { patientId, doctorId, appointmentDate, reason } = req.body;

  if (!patientId || !doctorId || !appointmentDate) {
    return res.status(400).json({ message: 'patientId, doctorId and appointmentDate are required.' });
  }

  try {
    // Check slot free
    const [existing] = await pool.execute(
      `SELECT appointment_id FROM appointments 
       WHERE doctor_id = ? AND appointment_date = ? AND status NOT IN ('Cancelled','No Show')`,
      [doctorId, appointmentDate]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Selected time slot is already booked.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, reason, created_by, status)
       VALUES (?, ?, ?, ?, ?, 'Booked')`,
      [patientId, doctorId, appointmentDate, reason || null, req.user.userId]
    );

    await logAudit(req.user.userId, 'CREATE', 'appointments', `Booked appointment ${result.insertId}`);

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointmentId: result.insertId,
      status: 'Booked'
    });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Selected time slot is already booked.' });
    }
    res.status(500).json({ message: 'Booking failed.' });
  }
};

// PUT /api/appointments/:id/checkin
exports.checkIn = async (req, res) => {
  try {
    // Generate token number for today
    const [maxTok] = await pool.execute(
      `SELECT COALESCE(MAX(token_no), 0) as maxToken FROM appointments 
       WHERE DATE(appointment_date) = CURDATE() AND doctor_id = 
       (SELECT doctor_id FROM appointments WHERE appointment_id = ?)`,
      [req.params.id]
    );
    const tokenNo = (maxTok[0].maxToken || 0) + 1;

    await pool.execute(
      `UPDATE appointments SET status = 'Checked-In', token_no = ? WHERE appointment_id = ?`,
      [tokenNo, req.params.id]
    );

    await logAudit(req.user.userId, 'UPDATE', 'appointments', `Checked-in appointment ${req.params.id}, token ${tokenNo}`);

    res.json({ message: 'Patient checked in', tokenNo });
  } catch (err) {
    res.status(500).json({ message: 'Check-in failed.' });
  }
};

// GET /api/queue/today
exports.todayQueue = async (req, res) => {
  try {
    let query = `
      SELECT a.appointment_id, a.token_no, a.status, a.appointment_date, a.reason,
             p.patient_id, p.uhid, p.name as patient_name,
             d.doctor_id, u.name as doctor_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN doctors d ON a.doctor_id = d.doctor_id
      JOIN users u ON d.user_id = u.user_id
      WHERE DATE(a.appointment_date) = CURDATE()
        AND a.status IN ('Booked','Confirmed','Checked-In')
    `;
    const params = [];

    if (req.user.role === 'Doctor') {
      const [docs] = await pool.execute('SELECT doctor_id FROM doctors WHERE user_id = ?', [req.user.userId]);
      if (docs.length) {
        query += ' AND a.doctor_id = ?';
        params.push(docs[0].doctor_id);
      }
    }

    query += ' ORDER BY a.token_no ASC, a.appointment_date ASC';
    const [rows] = await pool.execute(query, params);
    res.json({ queue: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load queue.' });
  }
};

// GET /api/appointments/my
exports.myAppointments = async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'Patient') {
      query = `
        SELECT a.*, p.uhid, u.name as doctor_name, d.specialization
        FROM appointments a
        JOIN patients p ON a.patient_id = p.patient_id
        JOIN doctors d ON a.doctor_id = d.doctor_id
        JOIN users u ON d.user_id = u.user_id
        WHERE p.user_id = ?
        ORDER BY a.appointment_date DESC
      `;
      params = [req.user.userId];
    } else if (req.user.role === 'Doctor') {
      query = `
        SELECT a.*, p.uhid, p.name as patient_name
        FROM appointments a
        JOIN patients p ON a.patient_id = p.patient_id
        JOIN doctors d ON a.doctor_id = d.doctor_id
        WHERE d.user_id = ?
        ORDER BY a.appointment_date DESC
      `;
      params = [req.user.userId];
    } else {
      query = `
        SELECT a.*, p.uhid, p.name as patient_name, u.name as doctor_name
        FROM appointments a
        JOIN patients p ON a.patient_id = p.patient_id
        JOIN doctors d ON a.doctor_id = d.doctor_id
        JOIN users u ON d.user_id = u.user_id
        ORDER BY a.appointment_date DESC LIMIT 100
      `;
      params = [];
    }
    const [rows] = await pool.execute(query, params);
    res.json({ appointments: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load appointments.' });
  }
};

// PUT /api/appointments/:id  (cancel / reschedule / complete)
exports.updateAppointment = async (req, res) => {
  const { status, appointmentDate, reason } = req.body;
  try {
    const updates = [];
    const params = [];
    if (status) { updates.push('status = ?'); params.push(status); }
    if (appointmentDate) { updates.push('appointment_date = ?'); params.push(appointmentDate); }
    if (reason !== undefined) { updates.push('reason = ?'); params.push(reason); }
    if (updates.length === 0) return res.status(400).json({ message: 'Nothing to update.' });

    params.push(req.params.id);
    await pool.execute(`UPDATE appointments SET ${updates.join(', ')} WHERE appointment_id = ?`, params);
    await logAudit(req.user.userId, 'UPDATE', 'appointments', `Updated appointment ${req.params.id}`);
    res.json({ message: 'Appointment updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Update failed.' });
  }
};
