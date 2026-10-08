import { useState, useEffect } from 'react'
import api from '../services/api'

export default function DoctorDashboard() {
  const [queue, setQueue] = useState([])
  const [selected, setSelected] = useState(null)
  const [consult, setConsult] = useState({ diagnosis: '', symptoms: '', treatment_plan: '', notes: '', bp: '', pulse_rate: '', temperature: '' })
  const [medicines, setMedicines] = useState([])
  const [rx, setRx] = useState([{ medicineId: '', dosage: '', duration: '' }])
  const [msg, setMsg] = useState('')
  const [history, setHistory] = useState([])

  useEffect(() => {
    api.get('/queue/today').then(r => setQueue(r.data.queue)).catch(() => {})
    api.get('/medicines').then(r => setMedicines(r.data.medicines)).catch(() => {})
  }, [])

  const openPatient = async (item) => {
    setSelected(item)
    setMsg('')
    try {
      const r = await api.get(`/consultations/patient/${item.patient_id}`)
      setHistory(r.data.history)
    } catch { setHistory([]) }
  }

  const saveConsultation = async () => {
    if (!consult.diagnosis) { setMsg('Diagnosis is required'); return }
    try {
      const { data } = await api.post('/consultations', {
        patientId: selected.patient_id,
        appointmentId: selected.appointment_id,
        ...consult
      })
      // Issue prescription if any
      const validRx = rx.filter(r => r.medicineId && r.dosage && r.duration)
      if (validRx.length) {
        await api.post('/prescriptions', { consultationId: data.consultationId, medicines: validRx })
      }
      setMsg('Consultation & prescription saved!')
      setConsult({ diagnosis: '', symptoms: '', treatment_plan: '', notes: '', bp: '', pulse_rate: '', temperature: '' })
      setRx([{ medicineId: '', dosage: '', duration: '' }])
      // Refresh queue
      const q = await api.get('/queue/today')
      setQueue(q.data.queue)
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to save')
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1rem' }}>Doctor Dashboard — Today's Queue</h2>
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.5fr' : '1fr', gap: '1.25rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '0.75rem' }}>OPD Queue</h3>
          {queue.length === 0 && <p style={{ color: '#64748b' }}>No patients in queue.</p>}
          {queue.map(q => (
            <div key={q.appointment_id} onClick={() => openPatient(q)}
              style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', background: selected?.appointment_id === q.appointment_id ? '#eff6ff' : 'transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>#{q.token_no || '—'} {q.patient_name}</strong>
                <span className={`badge ${q.status === 'Checked-In' ? 'badge-green' : 'badge-yellow'}`}>{q.status}</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{q.uhid} · {q.reason || 'General'}</div>
            </div>
          ))}
        </div>

        {selected && (
          <div>
            <div className="card">
              <h3>{selected.patient_name} ({selected.uhid})</h3>
              {msg && <div className={`alert ${msg.includes('saved') ? 'alert-success' : 'alert-error'}`}>{msg}</div>}
              <div className="grid-3" style={{ marginTop: '0.75rem' }}>
                <div className="form-group"><label>BP</label><input value={consult.bp} onChange={e => setConsult({...consult, bp: e.target.value})} placeholder="120/80" /></div>
                <div className="form-group"><label>Pulse</label><input type="number" value={consult.pulse_rate} onChange={e => setConsult({...consult, pulse_rate: e.target.value})} /></div>
                <div className="form-group"><label>Temp (°C)</label><input type="number" step="0.1" value={consult.temperature} onChange={e => setConsult({...consult, temperature: e.target.value})} /></div>
              </div>
              <div className="form-group"><label>Symptoms</label><textarea value={consult.symptoms} onChange={e => setConsult({...consult, symptoms: e.target.value})} rows={2} /></div>
              <div className="form-group"><label>Diagnosis *</label><textarea value={consult.diagnosis} onChange={e => setConsult({...consult, diagnosis: e.target.value})} rows={2} required /></div>
              <div className="form-group"><label>Treatment Plan</label><textarea value={consult.treatment_plan} onChange={e => setConsult({...consult, treatment_plan: e.target.value})} rows={2} /></div>
              <div className="form-group"><label>Notes</label><textarea value={consult.notes} onChange={e => setConsult({...consult, notes: e.target.value})} rows={2} /></div>

              <h4 style={{ margin: '1rem 0 0.5rem' }}>Prescription</h4>
              {rx.map((r, i) => (
                <div key={i} className="grid-3" style={{ marginBottom: '0.5rem' }}>
                  <select value={r.medicineId} onChange={e => { const n = [...rx]; n[i].medicineId = e.target.value; setRx(n) }}>
                    <option value="">Select medicine</option>
                    {medicines.map(m => <option key={m.medicine_id} value={m.medicine_id}>{m.medicine_name}</option>)}
                  </select>
                  <input placeholder="Dosage" value={r.dosage} onChange={e => { const n = [...rx]; n[i].dosage = e.target.value; setRx(n) }} />
                  <input placeholder="Duration" value={r.duration} onChange={e => { const n = [...rx]; n[i].duration = e.target.value; setRx(n) }} />
                </div>
              ))}
              <button className="btn-outline" style={{ marginBottom: '0.75rem' }} onClick={() => setRx([...rx, { medicineId: '', dosage: '', duration: '' }])}>+ Add Medicine</button>
              <br />
              <button className="btn-success" onClick={saveConsultation}>Save Consultation</button>
            </div>

            {history.length > 0 && (
              <div className="card">
                <h4>Previous History</h4>
                {history.map(h => (
                  <div key={h.consultation_id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                    <strong>{new Date(h.visit_date).toLocaleDateString()}</strong> — {h.diagnosis}
                    <div style={{ color: '#64748b' }}>{h.doctor_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
