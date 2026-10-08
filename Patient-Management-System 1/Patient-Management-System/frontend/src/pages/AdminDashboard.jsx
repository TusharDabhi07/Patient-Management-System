import { useState, useEffect } from 'react'
import api from '../services/api'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [tab, setTab] = useState('stats')
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'Receptionist', contact_no: '' })
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.get('/reports/summary').then(r => setStats(r.data)).catch(() => {})
    api.get('/users').then(r => setUsers(r.data.users)).catch(() => {})
  }, [])

  const loadLogs = () => {
    api.get('/audit-logs?limit=50').then(r => setLogs(r.data.logs)).catch(() => {})
  }

  const createUser = async (e) => {
    e.preventDefault()
    try {
      await api.post('/users', newUser)
      setMsg('User created successfully')
      setNewUser({ name: '', email: '', password: '', role: 'Receptionist', contact_no: '' })
      const r = await api.get('/users')
      setUsers(r.data.users)
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed')
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: '1rem' }}>Admin Dashboard</h2>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {['stats', 'users', 'create', 'audit'].map(t => (
          <button key={t} className={tab === t ? 'btn-primary' : 'btn-outline'} onClick={() => { setTab(t); if (t === 'audit') loadLogs() }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'stats' && stats && (
        <div className="grid-3">
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#2563eb' }}>{stats.todayAppointments}</div>
            <div style={{ color: '#64748b' }}>Today's Appointments</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#059669' }}>{stats.newRegistrations}</div>
            <div style={{ color: '#64748b' }}>New Registrations</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#d97706' }}>
              {stats.bedOccupancy?.occupied}/{stats.bedOccupancy?.total}
            </div>
            <div style={{ color: '#64748b' }}>Beds Occupied</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#7c3aed' }}>₹{stats.todayCollections}</div>
            <div style={{ color: '#64748b' }}>Today's Collections</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#dc2626' }}>{stats.pendingBills}</div>
            <div style={{ color: '#64748b' }}>Pending Bills</div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="card">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id}>
                  <td>{u.name}</td><td>{u.email}</td>
                  <td><span className="badge badge-blue">{u.role}</span></td>
                  <td>{u.is_active ? <span className="badge badge-green">Active</span> : <span className="badge badge-red">Inactive</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'create' && (
        <div className="card" style={{ maxWidth: 500 }}>
          <h3 style={{ marginBottom: '1rem' }}>Create User</h3>
          {msg && <div className="alert alert-success">{msg}</div>}
          <form onSubmit={createUser}>
            <div className="form-group"><label>Name</label><input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} required /></div>
            <div className="form-group"><label>Email</label><input type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required /></div>
            <div className="form-group"><label>Password</label><input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required minLength={8} /></div>
            <div className="form-group"><label>Role</label>
              <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                <option>Receptionist</option><option>Doctor</option><option>Admin</option>
              </select>
            </div>
            <button type="submit" className="btn-primary">Create User</button>
          </form>
        </div>
      )}

      {tab === 'audit' && (
        <div className="card">
          <table className="table">
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.log_id}>
                  <td style={{ fontSize: '0.85rem' }}>{new Date(l.log_time).toLocaleString()}</td>
                  <td>{l.name}</td><td>{l.action}</td><td>{l.entity}</td><td style={{ fontSize: '0.85rem' }}>{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
