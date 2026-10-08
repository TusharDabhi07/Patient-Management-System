import { useState, useEffect } from 'react'
import api from '../services/api'

export default function ReceptionistDashboard() {
  const [tab, setTab] = useState('register')
  const [msg, setMsg] = useState('')
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState('')
  const [doctors, setDoctors] = useState([])
  const [beds, setBeds] = useState([])
  const [queue, setQueue] = useState([])
  const [admissions, setAdmissions] = useState([])

  // Forms
  const [regForm, setRegForm] = useState({ name: '', date_of_birth: '', gender: 'Male', blood_group: '', contact_no: '', address: '', allergies: '', emergency_contact: '' })
  const [apptForm, setApptForm] = useState({ patientId: '', doctorId: '', date: '', time: '', reason: '' })
  const [admitForm, setAdmitForm] = useState({ patientId: '', doctorId: '', bedId: '', reason: '' })

  useEffect(() => {
    api.get('/doctors').then(r => setDoctors(r.data.doctors)).catch(() => {})
    api.get('/beds?status=Available').then(r => setBeds(r.data.beds)).catch(() => {})
    api.get('/queue/today').then(r => setQueue(r.data.queue)).catch(() => {})
    api.get('/admissions/current').then(r => setAdmissions(r.data.admissions)).catch(() => {})
  }, [])

  const searchPatients = async () => {
    const r = await api.get(`/patients?search=${search}`)
    setPatients(r.data.patients)
  }

  const registerPatient = async (e) => {
    e.preventDefault()
    setMsg('')
    try {
      const { data } = await api.post('/patients', regForm)
      setMsg(`Patient registered! UHID: ${data.patient.uhid}`)
      setRegForm({ name: '', date_of_birth: '', gender: 'Male', blood_group: '', contact_no: '', address: '', allergies: '', emergency_contact: '' })
    } catch (err) {
      setMsg(err.response?.data?.message || 'Registration failed')
    }
  }

  const bookAppointment = async (e) => {
    e.preventDefault()
    setMsg('')
    try {
      const appointmentDate = `${apptForm.date}T${apptForm.time}:00`
      await api.post('/appointments', {
        patientId: Number(apptForm.patientId),
        doctorId: Number(apptForm.doctorId),
        appointmentDate,
        reason: apptForm.reason
      })
      setMsg('Appointment booked successfully!')
    } catch (err) {
      setMsg(err.response?.data?.message || 'Booking failed')
    }
  }

  const checkIn = async (id) => {
    try {
      const { data } = await api.put(`/appointments/${id}/checkin`)
      setMsg(`Checked in! Token: ${data.tokenNo}`)
      const q = await api.get('/queue/today')
      setQueue(q.data.queue)
    } catch (err) {
      setMsg(err.response?.data?.message || 'Check-in failed')
    }
  }

  const admitPatient = async (e) => {
    e.preventDefault()
    setMsg('')
    try {
      const { data } = await api.post('/admissions', {
        patientId: Number(admitForm.patientId),
        doctorId: Number(admitForm.doctorId),
        bedId: Number(admitForm.bedId),
        reason: admitForm.reason
      })
      setMsg(`Admitted! Bed: ${data.bedNumber}`)
      const b = await api.get('/beds?status=Available')
      setBeds(b.data.beds)
      const a = await api.get('/admissions/current')
      setAdmissions(a.data.admissions)
    } catch (err) {
      setMsg(err.response?.data?.message || 'Admission failed')
    }
  }

  const generateBill = async (patientId, appointmentId, admissionId) => {
    try {
      const { data } = await api.post('/bills', { patientId, appointmentId, admissionId })
      setMsg(`Bill generated! Total: ₹${data.totalAmount} (Bill #${data.billId})`)
    } catch (err) {
      setMsg(err.response?.data?.message || 'Bill failed')
    }
  }

  const tabs = [
    { id: 'register', label: 'Register Patient' },
    { id: 'search', label: 'Search' },
    { id: 'appointments', label: 'Book Appointment' },
    { id: 'queue', label: 'OPD Queue' },
    { id: 'admit', label: 'Admission' },
    { id: 'inpatients', label: 'In-Patients' }
  ]

  return (
    <div>
      <h2 style={{ marginBottom: '1rem' }}>Receptionist Dashboard</h2>
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} className={tab === t.id ? 'btn-primary' : 'btn-outline'} onClick={() => { setTab(t.id); setMsg('') }}>
            {t.label}
          </button>
        ))}
      </div>
      {msg && <div className={`alert ${msg.includes('failed') || msg.includes('Failed') || msg.includes('already') ? 'alert-error' : 'alert-success'}`}>{msg}</div>}

      {tab === 'register' && (
        <div className="card" style={{ maxWidth: 600 }}>
          <form onSubmit={registerPatient}>
            <div className="grid-2">
              <div className="form-group"><label>Full Name *</label><input value={regForm.name} onChange={e => setRegForm({...regForm, name: e.target.value})} required /></div>
              <div className="form-group"><label>Date of Birth</label><input type="date" value={regForm.date_of_birth} onChange={e => setRegForm({...regForm, date_of_birth: e.target.value})} /></div>
              <div className="form-group"><label>Gender</label>
                <select value={regForm.gender} onChange={e => setRegForm({...regForm, gender: e.target.value})}><option>Male</option><option>Female</option><option>Other</option></select>
              </div>
              <div className="form-group"><label>Blood Group</label><input value={regForm.blood_group} onChange={e => setRegForm({...regForm, blood_group: e.target.value})} placeholder="B+" /></div>
              <div className="form-group"><label>Contact No</label><input value={regForm.contact_no} onChange={e => setRegForm({...regForm, contact_no: e.target.value})} /></div>
              <div className="form-group"><label>Emergency Contact</label><input value={regForm.emergency_contact} onChange={e => setRegForm({...regForm, emergency_contact: e.target.value})} /></div>
            </div>
            <div className="form-group"><label>Address</label><input value={regForm.address} onChange={e => setRegForm({...regForm, address: e.target.value})} /></div>
            <div className="form-group"><label>Allergies</label><input value={regForm.allergies} onChange={e => setRegForm({...regForm, allergies: e.target.value})} /></div>
            <button type="submit" className="btn-primary">Register Patient</button>
          </form>
        </div>
      )}

      {tab === 'search' && (
        <div className="card">
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by UHID, name or phone..." style={{ flex: 1 }} />
            <button className="btn-primary" onClick={searchPatients}>Search</button>
          </div>
          <table className="table">
            <thead><tr><th>UHID</th><th>Name</th><th>Gender</th><th>Contact</th><th>DOB</th></tr></thead>
            <tbody>
              {patients.map(p => (
                <tr key={p.patient_id}><td>{p.uhid}</td><td>{p.name}</td><td>{p.gender}</td><td>{p.contact_no}</td><td>{p.date_of_birth}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'appointments' && (
        <div className="card" style={{ maxWidth: 500 }}>
          <form onSubmit={bookAppointment}>
            <div className="form-group"><label>Patient ID</label><input value={apptForm.patientId} onChange={e => setApptForm({...apptForm, patientId: e.target.value})} required placeholder="Enter patient_id from search" /></div>
            <div className="form-group"><label>Doctor</label>
              <select value={apptForm.doctorId} onChange={e => setApptForm({...apptForm, doctorId: e.target.value})} required>
                <option value="">Select doctor</option>
                {doctors.map(d => <option key={d.doctor_id} value={d.doctor_id}>{d.name} — {d.specialization} (₹{d.consultation_fee})</option>)}
              </select>
            </div>
            <div className="grid-2">
              <div className="form-group"><label>Date</label><input type="date" value={apptForm.date} onChange={e => setApptForm({...apptForm, date: e.target.value})} required /></div>
              <div className="form-group"><label>Time</label><input type="time" value={apptForm.time} onChange={e => setApptForm({...apptForm, time: e.target.value})} required /></div>
            </div>
            <div className="form-group"><label>Reason</label><input value={apptForm.reason} onChange={e => setApptForm({...apptForm, reason: e.target.value})} /></div>
            <button type="submit" className="btn-primary">Book Appointment</button>
          </form>
        </div>
      )}

      {tab === 'queue' && (
        <div className="card">
          <table className="table">
            <thead><tr><th>Token</th><th>Patient</th><th>UHID</th><th>Doctor</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {queue.map(q => (
                <tr key={q.appointment_id}>
                  <td>{q.token_no || '—'}</td><td>{q.patient_name}</td><td>{q.uhid}</td><td>{q.doctor_name}</td>
                  <td><span className={`badge ${q.status === 'Checked-In' ? 'badge-green' : 'badge-yellow'}`}>{q.status}</span></td>
                  <td>
                    {q.status !== 'Checked-In' && <button className="btn-success" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => checkIn(q.appointment_id)}>Check-In</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'admit' && (
        <div className="card" style={{ maxWidth: 500 }}>
          <form onSubmit={admitPatient}>
            <div className="form-group"><label>Patient ID</label><input value={admitForm.patientId} onChange={e => setAdmitForm({...admitForm, patientId: e.target.value})} required /></div>
            <div className="form-group"><label>Doctor</label>
              <select value={admitForm.doctorId} onChange={e => setAdmitForm({...admitForm, doctorId: e.target.value})} required>
                <option value="">Select</option>
                {doctors.map(d => <option key={d.doctor_id} value={d.doctor_id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Available Bed</label>
              <select value={admitForm.bedId} onChange={e => setAdmitForm({...admitForm, bedId: e.target.value})} required>
                <option value="">Select</option>
                {beds.map(b => <option key={b.bed_id} value={b.bed_id}>{b.ward_name} — {b.bed_number} (₹{b.charge_per_day}/day)</option>)}
              </select>
            </div>
            <div className="form-group"><label>Reason</label><input value={admitForm.reason} onChange={e => setAdmitForm({...admitForm, reason: e.target.value})} /></div>
            <button type="submit" className="btn-primary">Admit Patient</button>
          </form>
        </div>
      )}

      {tab === 'inpatients' && (
        <div className="card">
          <table className="table">
            <thead><tr><th>Patient</th><th>UHID</th><th>Ward/Bed</th><th>Doctor</th><th>Admitted</th><th>Action</th></tr></thead>
            <tbody>
              {admissions.map(a => (
                <tr key={a.admission_id}>
                  <td>{a.patient_name}</td><td>{a.uhid}</td>
                  <td>{a.ward_name} / {a.bed_number}</td><td>{a.doctor_name}</td>
                  <td>{new Date(a.admit_date).toLocaleDateString()}</td>
                  <td>
                    <button className="btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                      onClick={() => generateBill(a.patient_id, null, a.admission_id)}>Generate Bill</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
