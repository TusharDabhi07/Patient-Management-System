import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      const routes = { Admin: '/admin', Doctor: '/doctor', Receptionist: '/receptionist', Patient: '/patient' }
      navigate(routes[user.role] || '/')
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%)' }}>
      <div className="card" style={{ width: 400, maxWidth: '95%' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem' }}>🏥</div>
          <h1 style={{ fontSize: '1.4rem', marginTop: '0.5rem' }}>Patient Management System</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Sign in to continue</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.7rem', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.9rem' }}>
          New patient? <Link to="/register">Register here</Link>
        </p>
        <div style={{ marginTop: '1.5rem', padding: '0.75rem', background: '#f8fafc', borderRadius: 6, fontSize: '0.8rem', color: '#64748b' }}>
          <strong>Demo accounts:</strong><br/>
          admin@pms.com / Admin@123<br/>
          doctor@pms.com / Doctor@123<br/>
          receptionist@pms.com / Recep@123<br/>
          patient@pms.com / Patient@123
        </div>
      </div>
    </div>
  )
}
