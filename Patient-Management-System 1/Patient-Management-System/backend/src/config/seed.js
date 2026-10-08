/**
 * Seed script – run after schema.sql
 * node src/config/seed.js
 */
const bcrypt = require('bcryptjs');
const pool = require('./db');

async function seed() {
  try {
    console.log('Seeding database...');

    // Departments
    await pool.execute(`INSERT IGNORE INTO departments (department_name) VALUES 
      ('General Medicine'), ('Cardiology'), ('Orthopedics'), ('Pediatrics'), ('Dermatology')`);

    // Admin user (password: Admin@123)
    const adminHash = await bcrypt.hash('Admin@123', 10);
    await pool.execute(
      `INSERT IGNORE INTO users (user_id, name, email, password, contact_no, role) VALUES 
       (1, 'System Admin', 'admin@pms.com', ?, '9999999999', 'Admin')`,
      [adminHash]
    );

    // Receptionist (password: Recep@123)
    const recepHash = await bcrypt.hash('Recep@123', 10);
    await pool.execute(
      `INSERT IGNORE INTO users (user_id, name, email, password, contact_no, role) VALUES 
       (2, 'Priya Sharma', 'receptionist@pms.com', ?, '9888888888', 'Receptionist')`,
      [recepHash]
    );

    // Doctor (password: Doctor@123)
    const docHash = await bcrypt.hash('Doctor@123', 10);
    await pool.execute(
      `INSERT IGNORE INTO users (user_id, name, email, password, contact_no, role) VALUES 
       (3, 'Dr. Rajesh Kumar', 'doctor@pms.com', ?, '9777777777', 'Doctor')`,
      [docHash]
    );
    await pool.execute(
      `INSERT IGNORE INTO doctors (doctor_id, user_id, department_id, specialization, license_no, consultation_fee)
       VALUES (1, 3, 1, 'General Physician', 'MCI-12345', 500.00)`
    );

    // Sample Patient account (password: Patient@123)
    const patHash = await bcrypt.hash('Patient@123', 10);
    await pool.execute(
      `INSERT IGNORE INTO users (user_id, name, email, password, contact_no, role) VALUES 
       (4, 'Amit Patel', 'patient@pms.com', ?, '9666666666', 'Patient')`,
      [patHash]
    );
    await pool.execute(
      `INSERT IGNORE INTO patients (patient_id, uhid, user_id, name, date_of_birth, gender, blood_group, contact_no)
       VALUES (1, 'UHID000001', 4, 'Amit Patel', '1990-05-15', 'Male', 'B+', '9666666666')`
    );

    // Wards & Beds
    await pool.execute(`INSERT IGNORE INTO wards (ward_id, ward_name, ward_type, charge_per_day) VALUES 
      (1, 'General Ward A', 'General', 800.00),
      (2, 'Private Room', 'Private', 2500.00),
      (3, 'ICU', 'ICU', 5000.00)`);

    await pool.execute(`INSERT IGNORE INTO beds (ward_id, bed_number, status) VALUES 
      (1, 'G-01', 'Available'), (1, 'G-02', 'Available'), (1, 'G-03', 'Available'),
      (1, 'G-04', 'Available'), (1, 'G-05', 'Available'),
      (2, 'P-01', 'Available'), (2, 'P-02', 'Available'),
      (3, 'ICU-01', 'Available'), (3, 'ICU-02', 'Available')`);

    // Medicines
    await pool.execute(`INSERT IGNORE INTO medicines (medicine_name, medicine_type) VALUES 
      ('Paracetamol 500mg', 'Tablet'),
      ('Amoxicillin 250mg', 'Capsule'),
      ('Cetirizine 10mg', 'Tablet'),
      ('Omeprazole 20mg', 'Capsule'),
      ('Ibuprofen 400mg', 'Tablet'),
      ('ORS Powder', 'Powder'),
      ('Cough Syrup', 'Syrup'),
      ('Vitamin D3', 'Tablet')`);

    console.log('Seed completed successfully!');
    console.log('\n=== Demo Login Credentials ===');
    console.log('Admin        : admin@pms.com       / Admin@123');
    console.log('Receptionist : receptionist@pms.com / Recep@123');
    console.log('Doctor       : doctor@pms.com      / Doctor@123');
    console.log('Patient      : patient@pms.com     / Patient@123');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
