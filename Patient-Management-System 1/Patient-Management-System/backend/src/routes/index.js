const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

const authCtrl = require('../controllers/authController');
const patientCtrl = require('../controllers/patientController');
const apptCtrl = require('../controllers/appointmentController');
const consultCtrl = require('../controllers/consultationController');
const admitCtrl = require('../controllers/admissionController');
const billCtrl = require('../controllers/billingController');
const adminCtrl = require('../controllers/adminController');

// ========== Auth (Public) ==========
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', authenticate, authCtrl.me);

// ========== Patients ==========
router.post('/patients', authenticate, authorize('Receptionist', 'Admin'), patientCtrl.registerPatient);
router.get('/patients', authenticate, authorize('Receptionist', 'Doctor', 'Admin'), patientCtrl.searchPatients);
router.get('/patients/:id', authenticate, patientCtrl.getPatient);
router.put('/patients/:id', authenticate, authorize('Receptionist', 'Patient', 'Admin'), patientCtrl.updatePatient);

// ========== Doctors & Appointments ==========
router.get('/doctors', authenticate, apptCtrl.listDoctors);
router.get('/doctors/:id/slots', authenticate, apptCtrl.getSlots);
router.post('/appointments', authenticate, authorize('Patient', 'Receptionist', 'Admin'), apptCtrl.bookAppointment);
router.get('/appointments/my', authenticate, apptCtrl.myAppointments);
router.put('/appointments/:id', authenticate, apptCtrl.updateAppointment);
router.put('/appointments/:id/checkin', authenticate, authorize('Receptionist', 'Admin'), apptCtrl.checkIn);
router.get('/queue/today', authenticate, authorize('Doctor', 'Receptionist', 'Admin'), apptCtrl.todayQueue);

// ========== Consultations, Prescriptions, Reports ==========
router.post('/consultations', authenticate, authorize('Doctor'), consultCtrl.createConsultation);
router.get('/consultations/patient/:id', authenticate, consultCtrl.getPatientHistory);
router.post('/prescriptions', authenticate, authorize('Doctor'), consultCtrl.issuePrescription);
router.get('/medicines', authenticate, consultCtrl.listMedicines);
router.post('/reports', authenticate, authorize('Doctor'), consultCtrl.upload.single('file'), consultCtrl.uploadReport);
router.get('/reports/:id/download', authenticate, consultCtrl.downloadReport);

// ========== Admissions & Beds ==========
router.get('/beds', authenticate, authorize('Receptionist', 'Doctor', 'Admin'), admitCtrl.listBeds);
router.post('/admissions', authenticate, authorize('Receptionist', 'Doctor', 'Admin'), admitCtrl.admitPatient);
router.put('/admissions/:id/transfer', authenticate, authorize('Receptionist', 'Doctor', 'Admin'), admitCtrl.transferPatient);
router.put('/admissions/:id/discharge', authenticate, authorize('Doctor', 'Receptionist', 'Admin'), admitCtrl.dischargePatient);
router.get('/admissions/current', authenticate, authorize('Receptionist', 'Doctor', 'Admin'), admitCtrl.currentAdmissions);

// ========== Billing ==========
router.post('/bills', authenticate, authorize('Receptionist', 'Admin'), billCtrl.generateBill);
router.post('/bills/:id/payments', authenticate, authorize('Receptionist', 'Admin'), billCtrl.recordPayment);
router.get('/bills', authenticate, billCtrl.getBills);
router.get('/bills/my', authenticate, authorize('Patient'), billCtrl.getBills);

// ========== Admin ==========
router.get('/users', authenticate, authorize('Admin'), adminCtrl.listUsers);
router.post('/users', authenticate, authorize('Admin'), adminCtrl.createUser);
router.put('/users/:id', authenticate, authorize('Admin'), adminCtrl.updateUserRole);

router.get('/departments', authenticate, adminCtrl.listDepartments);
router.post('/departments', authenticate, authorize('Admin'), adminCtrl.addDepartment);
router.get('/wards', authenticate, adminCtrl.listWards);
router.post('/wards', authenticate, authorize('Admin'), adminCtrl.addWard);
router.post('/beds', authenticate, authorize('Admin'), adminCtrl.addBed);
router.post('/medicines', authenticate, authorize('Admin'), adminCtrl.addMedicine);

router.get('/audit-logs', authenticate, authorize('Admin'), adminCtrl.getAuditLogs);
router.get('/login-history', authenticate, authorize('Admin'), adminCtrl.getLoginHistory);
router.get('/reports/summary', authenticate, authorize('Admin'), adminCtrl.getDashboardStats);

module.exports = router;
