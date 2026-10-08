-- Patient Management System - MySQL Schema
-- Run this file to create the database and all tables

CREATE DATABASE IF NOT EXISTS pms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pms_db;

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  contact_no VARCHAR(15),
  role ENUM('Admin','Doctor','Receptionist','Patient') NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Patients
CREATE TABLE IF NOT EXISTS patients (
  patient_id INT AUTO_INCREMENT PRIMARY KEY,
  uhid VARCHAR(20) NOT NULL UNIQUE,
  user_id INT UNIQUE,
  name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(10),
  blood_group VARCHAR(5),
  allergies TEXT,
  address VARCHAR(255),
  emergency_contact VARCHAR(15),
  contact_no VARCHAR(15),
  registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 3. Departments
CREATE TABLE IF NOT EXISTS departments (
  department_id INT AUTO_INCREMENT PRIMARY KEY,
  department_name VARCHAR(100) NOT NULL UNIQUE
);

-- 4. Doctors
CREATE TABLE IF NOT EXISTS doctors (
  doctor_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  department_id INT NOT NULL,
  specialization VARCHAR(100),
  license_no VARCHAR(50) UNIQUE,
  consultation_fee DECIMAL(8,2) DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

-- 5. Wards
CREATE TABLE IF NOT EXISTS wards (
  ward_id INT AUTO_INCREMENT PRIMARY KEY,
  ward_name VARCHAR(100) NOT NULL UNIQUE,
  ward_type VARCHAR(20),
  charge_per_day DECIMAL(8,2) NOT NULL
);

-- 6. Beds
CREATE TABLE IF NOT EXISTS beds (
  bed_id INT AUTO_INCREMENT PRIMARY KEY,
  ward_id INT NOT NULL,
  bed_number VARCHAR(10) NOT NULL,
  status ENUM('Available','Occupied','Maintenance') DEFAULT 'Available',
  UNIQUE KEY uq_bed (ward_id, bed_number),
  FOREIGN KEY (ward_id) REFERENCES wards(ward_id) ON DELETE CASCADE
);

-- 7. Appointments
CREATE TABLE IF NOT EXISTS appointments (
  appointment_id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  appointment_date DATETIME NOT NULL,
  token_no INT,
  status ENUM('Booked','Confirmed','Checked-In','Completed','Cancelled','No Show') DEFAULT 'Booked',
  reason VARCHAR(255),
  created_by INT,
  UNIQUE KEY uq_slot (doctor_id, appointment_date),
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
  FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- 8. Admissions
CREATE TABLE IF NOT EXISTS admissions (
  admission_id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  bed_id INT NOT NULL,
  admit_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  discharge_date DATETIME,
  reason VARCHAR(255),
  status ENUM('Admitted','Discharged') DEFAULT 'Admitted',
  discharge_summary TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
  FOREIGN KEY (bed_id) REFERENCES beds(bed_id)
);

-- 9. Consultations
CREATE TABLE IF NOT EXISTS consultations (
  consultation_id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  appointment_id INT UNIQUE,
  admission_id INT,
  bp VARCHAR(10),
  pulse_rate INT,
  temperature DECIMAL(4,1),
  weight_kg DECIMAL(5,2),
  symptoms TEXT,
  diagnosis TEXT NOT NULL,
  treatment_plan TEXT,
  notes TEXT,
  visit_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
  FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id),
  FOREIGN KEY (admission_id) REFERENCES admissions(admission_id)
);

-- 10. Medicines
CREATE TABLE IF NOT EXISTS medicines (
  medicine_id INT AUTO_INCREMENT PRIMARY KEY,
  medicine_name VARCHAR(100) NOT NULL,
  medicine_type VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
  prescription_id INT AUTO_INCREMENT PRIMARY KEY,
  consultation_id INT NOT NULL,
  medicine_id INT NOT NULL,
  dosage VARCHAR(50) NOT NULL,
  duration VARCHAR(50) NOT NULL,
  instructions VARCHAR(255),
  prescribed_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (consultation_id) REFERENCES consultations(consultation_id) ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id)
);

-- 12. Lab Reports
CREATE TABLE IF NOT EXISTS lab_reports (
  report_id INT AUTO_INCREMENT PRIMARY KEY,
  consultation_id INT NOT NULL,
  report_name VARCHAR(100),
  file_path VARCHAR(255) NOT NULL,
  uploaded_by INT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (consultation_id) REFERENCES consultations(consultation_id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
);

-- 13. Bills
CREATE TABLE IF NOT EXISTS bills (
  bill_id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  admission_id INT,
  appointment_id INT,
  total_amount DECIMAL(10,2) DEFAULT 0,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  payment_status ENUM('Pending','Partial','Paid') DEFAULT 'Pending',
  payment_mode VARCHAR(20),
  bill_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (admission_id) REFERENCES admissions(admission_id),
  FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id)
);

-- 14. Bill Items
CREATE TABLE IF NOT EXISTS bill_items (
  item_id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NOT NULL,
  description VARCHAR(150) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(8,2) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (bill_id) REFERENCES bills(bill_id) ON DELETE CASCADE
);

-- 15. Login History
CREATE TABLE IF NOT EXISTS login_history (
  login_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 16. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(50),
  details TEXT,
  log_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_patient_name ON patients(name);
CREATE INDEX idx_consult_patient ON consultations(patient_id, visit_date);
CREATE INDEX idx_appt_doctor ON appointments(doctor_id, appointment_date);
CREATE INDEX idx_adm_status ON admissions(status);
CREATE INDEX idx_bed_status ON beds(status);
CREATE INDEX idx_bill_patient ON bills(patient_id);
CREATE INDEX idx_audit_time ON audit_logs(log_time);
