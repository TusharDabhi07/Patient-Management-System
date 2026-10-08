const pool = require('../config/db');
const { logAudit } = require('../utils/audit');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Multer setup for lab reports
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Unsupported file type. Only PDF/JPG/PNG allowed.'), false);
};

exports.upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// POST /api/consultations
exports.createConsultation = async (req, res) => {
  const {
    patientId, appointmentId, admissionId,
    bp, pulse_rate, temperature, weight_kg,
    symptoms, diagnosis, treatment_plan, notes
  } = req.body;

  if (!patientId || !diagnosis) {
    return res.status(400).json({ message: 'patientId and diagnosis are required.' });
  }

  try {
    // Get doctor_id from logged-in user
    const [docs] = await pool.execute('SELECT doctor_id FROM doctors WHERE user_id = ?', [req.user.userId]);
    if (!docs.length) return res.status(403).json({ message: 'Only doctors can create consultations.' });
    const doctorId = docs[0].doctor_id;

    const [result] = await pool.execute(
      `INSERT INTO consultations 
       (patient_id, doctor_id, appointment_id, admission_id, bp, pulse_rate, temperature, weight_kg,
        symptoms, diagnosis, treatment_plan, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [patientId, doctorId, appointmentId || null, admissionId || null,
       bp || null, pulse_rate || null, temperature || null, weight_kg || null,
       symptoms || null, diagnosis, treatment_plan || null, notes || null]
    );

    // Mark appointment completed if linked
    if (appointmentId) {
      await pool.execute(`UPDATE appointments SET status = 'Completed' WHERE appointment_id = ?`, [appointmentId]);
    }

    await logAudit(req.user.userId, 'CREATE', 'consultations', `Created consultation ${result.insertId}`);

    res.status(201).json({
      message: 'Consultation saved',
      consultationId: result.insertId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to save consultation.' });
  }
};

// GET /api/consultations/patient/:id
exports.getPatientHistory = async (req, res) => {
  try {
    // RBAC check for Patient
    if (req.user.role === 'Patient') {
      const [own] = await pool.execute('SELECT patient_id FROM patients WHERE user_id = ?', [req.user.userId]);
      if (!own.length || own[0].patient_id != req.params.id) {
        return res.status(403).json({ message: 'Access denied.' });
      }
    }

    const [consultations] = await pool.execute(
      `SELECT c.*, u.name as doctor_name
       FROM consultations c
       JOIN doctors d ON c.doctor_id = d.doctor_id
       JOIN users u ON d.user_id = u.user_id
       WHERE c.patient_id = ?
       ORDER BY c.visit_date DESC`,
      [req.params.id]
    );

    // Attach prescriptions
    for (const c of consultations) {
      const [rx] = await pool.execute(
        `SELECT pr.*, m.medicine_name, m.medicine_type
         FROM prescriptions pr
         JOIN medicines m ON pr.medicine_id = m.medicine_id
         WHERE pr.consultation_id = ?`,
        [c.consultation_id]
      );
      c.prescriptions = rx;

      const [reports] = await pool.execute(
        `SELECT report_id, report_name, file_path, uploaded_at FROM lab_reports WHERE consultation_id = ?`,
        [c.consultation_id]
      );
      c.labReports = reports;
    }

    await logAudit(req.user.userId, 'VIEW', 'consultations', `Viewed history of patient ${req.params.id}`);
    res.json({ history: consultations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load history.' });
  }
};

// POST /api/prescriptions
exports.issuePrescription = async (req, res) => {
  const { consultationId, medicines } = req.body; // medicines: [{medicineId, dosage, duration, instructions}]

  if (!consultationId || !Array.isArray(medicines) || medicines.length === 0) {
    return res.status(400).json({ message: 'consultationId and medicines array required.' });
  }

  try {
    for (const med of medicines) {
      if (!med.medicineId || !med.dosage || !med.duration) {
        return res.status(400).json({ message: 'Each medicine needs medicineId, dosage and duration.' });
      }
      await pool.execute(
        `INSERT INTO prescriptions (consultation_id, medicine_id, dosage, duration, instructions)
         VALUES (?, ?, ?, ?, ?)`,
        [consultationId, med.medicineId, med.dosage, med.duration, med.instructions || null]
      );
    }
    await logAudit(req.user.userId, 'CREATE', 'prescriptions', `Issued prescription for consultation ${consultationId}`);
    res.status(201).json({ message: 'Prescription issued successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to issue prescription.' });
  }
};

// POST /api/reports  (upload)
exports.uploadReport = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
  const { consultationId, reportName } = req.body;

  try {
    const [result] = await pool.execute(
      `INSERT INTO lab_reports (consultation_id, report_name, file_path, uploaded_by)
       VALUES (?, ?, ?, ?)`,
      [consultationId, reportName || req.file.originalname, req.file.filename, req.user.userId]
    );
    await logAudit(req.user.userId, 'CREATE', 'lab_reports', `Uploaded report ${result.insertId}`);
    res.status(201).json({
      message: 'Report uploaded',
      reportId: result.insertId,
      filePath: req.file.filename
    });
  } catch (err) {
    res.status(500).json({ message: 'Upload failed.' });
  }
};

// GET /api/reports/:id/download
exports.downloadReport = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM lab_reports WHERE report_id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Report not found.' });
    const filePath = path.join(__dirname, '../../uploads', rows[0].file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File missing on server.' });
    res.download(filePath, rows[0].report_name || rows[0].file_path);
  } catch (err) {
    res.status(500).json({ message: 'Download failed.' });
  }
};

// GET /api/medicines
exports.listMedicines = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM medicines ORDER BY medicine_name');
    res.json({ medicines: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to list medicines.' });
  }
};
