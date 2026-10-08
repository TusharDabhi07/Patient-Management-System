# Patient Management System (PMS)

A complete web-based Patient Management System for clinics and small hospitals.

**Tech Stack:** React (Vite) · Node.js · Express · MySQL · JWT · bcrypt · Multer

**Roles:** Admin · Doctor · Receptionist · Patient

---

## Features Implemented

- ✅ User authentication (JWT + bcrypt) with role-based access control
- ✅ Patient registration with unique UHID + duplicate detection
- ✅ Appointment booking, slot availability, OPD queue & check-in (token)
- ✅ Doctor consultation (vitals, diagnosis, treatment plan)
- ✅ Digital prescriptions linked to consultations
- ✅ Lab report upload / download (PDF/JPG/PNG, max 5 MB)
- ✅ In-patient admission with **transaction-safe bed allocation** (row locking)
- ✅ Bed transfer & discharge (with pending-bill check)
- ✅ Itemized billing (consultation fee + ward charges) + partial/full payments
- ✅ Admin: user management, departments, wards, beds, medicines
- ✅ Dashboard statistics
- ✅ Complete audit trail + login history
- ✅ Role-based dashboards for all four user types

---

## Project Structure

```
Patient-Management-System/
├── backend/
│   ├── schema.sql          # Full MySQL schema
│   ├── package.json
│   ├── .env.example
│   ├── uploads/            # Lab report files
│   └── src/
│       ├── server.js
│       ├── config/         # db.js, seed.js
│       ├── middleware/     # auth.js (JWT + RBAC)
│       ├── controllers/    # All business logic
│       ├── routes/
│       └── utils/          # audit logger
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── context/AuthContext.jsx
        ├── services/api.js
        ├── components/Layout.jsx
        └── pages/          # Login, Register, 4 dashboards
```

---

## Setup Instructions

### 1. Prerequisites
- Node.js 18+
- MySQL 8.0+
- npm

### 2. Database
```bash
# Login to MySQL and run:
mysql -u root -p < backend/schema.sql
```

### 3. Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your MySQL credentials and a strong JWT_SECRET

npm install
node src/config/seed.js    # Creates demo users, departments, wards, beds, medicines
npm run dev                # Starts on http://localhost:5000
```

### 4. Frontend
```bash
cd frontend
npm install
npm run dev                # Starts on http://localhost:3000
```

Open **http://localhost:3000** in your browser.

---

## Demo Login Credentials

| Role         | Email                  | Password    |
|--------------|------------------------|-------------|
| Admin        | admin@pms.com          | Admin@123   |
| Doctor       | doctor@pms.com         | Doctor@123  |
| Receptionist | receptionist@pms.com   | Recep@123   |
| Patient      | patient@pms.com        | Patient@123 |

---

## API Overview

All endpoints (except `/api/auth/register` and `/api/auth/login`) require:

```
Authorization: Bearer <JWT>
```

Key endpoints:
- `POST /api/auth/login` · `POST /api/auth/register`
- `POST /api/patients` · `GET /api/patients?search=`
- `POST /api/appointments` · `PUT /api/appointments/:id/checkin` · `GET /api/queue/today`
- `POST /api/consultations` · `POST /api/prescriptions` · `POST /api/reports`
- `POST /api/admissions` · `PUT /api/admissions/:id/discharge` · `GET /api/beds`
- `POST /api/bills` · `POST /api/bills/:id/payments`
- `GET /api/reports/summary` · `GET /api/audit-logs`

---

## Security Highlights

- Passwords hashed with bcrypt (10 rounds)
- JWT with expiry
- Role-based middleware on every protected route
- Parameterized SQL queries (no SQL injection)
- File upload restricted to PDF/JPG/PNG ≤ 5 MB
- Bed allocation uses `SELECT ... FOR UPDATE` inside a transaction
- Every login and data change is written to `audit_logs`

---

## Author

Dabhi Tushar Kamleshbhai — 24BECE30060  
LDRP Institute of Technology and Research, Gandhinagar  
Bachelor of Engineering in Computer Engineering (2026-27)

