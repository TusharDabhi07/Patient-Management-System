import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
        color: 'white',
        padding: '0.85rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🏥</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.15rem' }}>Patient Management System</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>{user?.role} Dashboard</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.9rem' }}>👤 {user?.name}</span>
          <button onClick={handleLogout} className="btn-outline" style={{ color: '#1e40af', fontWeight: 600 }}>
            Logout
          </button>
        </div>
      </header>
      <main style={{ flex: 1, padding: '1.5rem', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {children}
      </main>
      <footer style={{ textAlign: 'center', padding: '0.75rem', color: '#64748b', fontSize: '0.8rem' }}>
        PMS © 2026 — LDRP Institute of Technology and Research
      </footer>
    </div>
  )
}
