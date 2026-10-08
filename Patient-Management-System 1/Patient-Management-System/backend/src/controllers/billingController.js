const pool = require('../config/db');
const { logAudit } = require('../utils/audit');

// POST /api/bills
exports.generateBill = async (req, res) => {
  const { patientId, appointmentId, admissionId, extraItems = [] } = req.body;
  // extraItems: [{description, quantity, unitPrice}]

  if (!patientId) return res.status(400).json({ message: 'patientId required.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const items = [];
    let total = 0;

    // Consultation fee if appointment
    if (appointmentId) {
      const [appts] = await conn.execute(
        `SELECT d.consultation_fee FROM appointments a
         JOIN doctors d ON a.doctor_id = d.doctor_id
         WHERE a.appointment_id = ?`,
        [appointmentId]
      );
      if (appts.length && appts[0].consultation_fee > 0) {
        items.push({
          description: 'Consultation Fee',
          quantity: 1,
          unit_price: appts[0].consultation_fee,
          amount: appts[0].consultation_fee
        });
        total += Number(appts[0].consultation_fee);
      }
    }

    // Ward charges if admission
    if (admissionId) {
      const [adm] = await conn.execute(
        `SELECT a.admit_date, a.discharge_date, w.charge_per_day
         FROM admissions a
         JOIN beds b ON a.bed_id = b.bed_id
         JOIN wards w ON b.ward_id = w.ward_id
         WHERE a.admission_id = ?`,
        [admissionId]
      );
      if (adm.length) {
        const start = new Date(adm[0].admit_date);
        const end = adm[0].discharge_date ? new Date(adm[0].discharge_date) : new Date();
        const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
        const charge = days * Number(adm[0].charge_per_day);
        items.push({
          description: `Ward Charges (${days} day(s))`,
          quantity: days,
          unit_price: adm[0].charge_per_day,
          amount: charge
        });
        total += charge;
      }
    }

    // Extra items
    for (const e of extraItems) {
      const amt = (e.quantity || 1) * e.unitPrice;
      items.push({
        description: e.description,
        quantity: e.quantity || 1,
        unit_price: e.unitPrice,
        amount: amt
      });
      total += amt;
    }

    const [billResult] = await conn.execute(
      `INSERT INTO bills (patient_id, appointment_id, admission_id, total_amount, payment_status)
       VALUES (?, ?, ?, ?, 'Pending')`,
      [patientId, appointmentId || null, admissionId || null, total]
    );
    const billId = billResult.insertId;

    for (const item of items) {
      await conn.execute(
        `INSERT INTO bill_items (bill_id, description, quantity, unit_price, amount)
         VALUES (?, ?, ?, ?, ?)`,
        [billId, item.description, item.quantity, item.unit_price, item.amount]
      );
    }

    await conn.commit();
    await logAudit(req.user.userId, 'CREATE', 'bills', `Generated bill ${billId}`);

    res.status(201).json({
      message: 'Bill generated',
      billId,
      totalAmount: total,
      items
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Bill generation failed.' });
  } finally {
    conn.release();
  }
};

// POST /api/bills/:id/payments
exports.recordPayment = async (req, res) => {
  const { amount, paymentMode } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Valid payment amount required.' });
  }

  try {
    const [bills] = await pool.execute('SELECT * FROM bills WHERE bill_id = ?', [req.params.id]);
    if (!bills.length) return res.status(404).json({ message: 'Bill not found.' });

    const bill = bills[0];
    const pending = Number(bill.total_amount) - Number(bill.paid_amount);
    if (amount > pending) {
      return res.status(400).json({ message: 'Payment cannot exceed pending amount.' });
    }

    const newPaid = Number(bill.paid_amount) + Number(amount);
    let status = 'Partial';
    if (newPaid >= Number(bill.total_amount)) status = 'Paid';
    else if (newPaid === 0) status = 'Pending';

    await pool.execute(
      `UPDATE bills SET paid_amount = ?, payment_status = ?, payment_mode = ? WHERE bill_id = ?`,
      [newPaid, status, paymentMode || 'Cash', req.params.id]
    );

    await logAudit(req.user.userId, 'UPDATE', 'bills', `Payment ${amount} on bill ${req.params.id}`);

    res.json({
      message: 'Payment recorded',
      paidAmount: newPaid,
      paymentStatus: status
    });
  } catch (err) {
    res.status(500).json({ message: 'Payment recording failed.' });
  }
};

// GET /api/bills/my  or /api/bills?patientId=
exports.getBills = async (req, res) => {
  try {
    let query = `
      SELECT b.*, p.uhid, p.name as patient_name
      FROM bills b JOIN patients p ON b.patient_id = p.patient_id
    `;
    const params = [];

    if (req.user.role === 'Patient') {
      query += ' WHERE p.user_id = ?';
      params.push(req.user.userId);
    } else if (req.query.patientId) {
      query += ' WHERE b.patient_id = ?';
      params.push(req.query.patientId);
    }

    query += ' ORDER BY b.bill_date DESC LIMIT 50';
    const [rows] = await pool.execute(query, params);

    // Attach items
    for (const bill of rows) {
      const [items] = await pool.execute('SELECT * FROM bill_items WHERE bill_id = ?', [bill.bill_id]);
      bill.items = items;
    }

    res.json({ bills: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load bills.' });
  }
};
