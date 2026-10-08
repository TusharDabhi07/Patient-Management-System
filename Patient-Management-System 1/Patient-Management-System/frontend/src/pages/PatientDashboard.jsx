import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function PatientDashboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState('appointments')
  const [appointments, setAppointments] = useState([])
  const [history, setHistory] = useState([])
  const [bills, setBills] = useState([])
  const [doctors, setDoctors] = useState([])
  const [msg, setMsg] = useState('')
  const [apptForm, setApptForm] = useState({ doctorId: '', date: '', time: '', reason: '' })

  useEffect(() => {
    api.get('/appointments/my').then(r => setAppointments(r.data.appointments)).catch(() => {})
    api.get('/bills/my').then(r => setBills(r.data.bills)).catch(() => {})
    api.get('/doctors').then(r => setDoctors(r.data.doctors)).catch(() => {})
    if (user?.patientId) {
      api.get(`/consultations/patient/${user.patientId}`).then(r => setHistory(r.data.history)).catch(() => {})
    }
  }, [user])

  const bookAppt = async (e) => {
    e.preventDefault()
    setMsg('')
    try {
      await api.post('/appointments', {
        patientId: user.patientId,
        doctorId: Number(apptForm.doctorId),
        appointmentDate: `${apptForm.date}T${apptForm.time}:00`,
        reason: apptForm.reason
      })
      setMsg('Appointment booked!')
      const r = await api.get('/appointments/my')
      setAppointments(r.data.appointments)
    } catch (err) {
      setMsg(err.response?.data?.message || 'Booking failed')
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem' }}>Welcome, {user?.name}</h2>
      <p style={{ color: '#64748b', marginBottom: '1.25rem' }}>UHID: {user?.uhid || '—'}</p>

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {['appointments', 'book', 'history', 'bills'].map(t => (
          <button key={t} className={tab === t ? 'btn-primary' : 'btn-outline'} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {msg && <div className={`alert ${msg.includes('failed') ? 'alert-error' : 'alert-success'}`}>{msg}</div>}

      {tab === 'appointments' && (
        <div className="card">
          <table className="table">
            <thead><tr><th>Date</th><th>Doctor</th><th>Status</th><th>Token</th><th>Reason</th></tr></thead>
            <tbody>
              {appointments.map(a => (
                <tr key={a.appointment_id}>
                  <td>{new Date(a.appointment_date).toLocaleString()}</td>
                  <td>{a.doctor_name}</td>
                  <td><span className={`badge badge-blue`}>{a.status}</span></td>
                  <td>{a.token_no || '—'}</td>
                  <td>{a.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {appointments.length === 0 && <p style={{ color: '#64748b' }}>No appointments yet.</p>}
        </div>
      )}

      {tab === 'book' && (
        <div className="card" style={{ maxWidth: 450 }}>
          <form onSubmit={bookAppt}>
            <div className="form-group"><label>Doctor</label>
              <select value={apptForm.doctorId} onChange={e => setApptForm({...apptForm, doctorId: e.target.value})} required>
                <option value="">Select</option>
                {doctors.map(d => <option key={d.doctor_id} value={d.doctor_id}>{d.name} — {d.specialization}</option>)}
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

      {tab === 'history' && (
        <div className="card">
          {history.length === 0 && <p style={{ color: '#64748b' }}>No consultation history.</p>}
          {history.map(h => (
            <div key={h.consultation_id} style={{ padding: '1rem 0', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{new Date(h.visit_date).toLocaleDateString()}</strong>
                <span style={{ color: '#64748b' }}>{h.doctor_name}</span>
              </div>
              <div><strong>Diagnosis:</strong> {h.diagnosis}</div>
              {h.symptoms && <div><strong>Symptoms:</strong> {h.symptoms}</div>}
              {h.treatment_plan && <div><strong>Treatment:</strong> {h.treatment_plan}</div>}
              {h.prescriptions?.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <strong>Prescriptions:</strong>
                  <ul style={{ marginLeft: '1.25rem' }}>
                    {h.prescriptions.map(p => (
                      <li key={p.prescription_id}>{p.medicine_name} — {p.dosage} for {p.duration}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'bills' && (
        <div className="card">
          {bills.length === 0 && <p style={{ color: '#64748b' }}>No bills.</p>}
          {bills.map(b => (
            <div key={b.bill_id} style={{ padding: '1rem 0', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>Bill #{b.bill_id}</strong>
                <span className={`badge ${b.payment_status === 'Paid' ? 'badge-green' : b.payment_status === 'Partial' ? 'badge-yellow' : 'badge-red'}`}>
                  {b.payment_status}
                </span>
              </div>
              <div>Total: ₹{b.total_amount} · Paid: ₹{b.paid_amount}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{new Date(b.bill_date).toLocaleString()}</div>
              {b.items?.map(i => (
                <div key={i.item_id} style={{ fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                  • {i.description}: {i.quantity} × ₹{i.unit_price} = ₹{i.amount}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
