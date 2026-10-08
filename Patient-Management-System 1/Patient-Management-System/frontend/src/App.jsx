import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Layout from './components/Layout'
import AdminDashboard from './pages/AdminDashboard'
import DoctorDashboard from './pages/DoctorDashboard'
import ReceptionistDashboard from './pages/ReceptionistDashboard'
import PatientDashboard from './pages/PatientDashboard'

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function HomeRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  const map = {
    Admin: '/admin',
    Doctor: '/doctor',
    Receptionist: '/receptionist',
    Patient: '/patient'
  }
  return <Navigate to={map[user.role] || '/login'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<HomeRedirect />} />

      <Route path="/admin" element={
        <PrivateRoute roles={['Admin']}>
          <Layout><AdminDashboard /></Layout>
        </PrivateRoute>
      } />
      <Route path="/doctor" element={
        <PrivateRoute roles={['Doctor']}>
          <Layout><DoctorDashboard /></Layout>
        </PrivateRoute>
      } />
      <Route path="/receptionist" element={
        <PrivateRoute roles={['Receptionist']}>
          <Layout><ReceptionistDashboard /></Layout>
        </PrivateRoute>
      } />
      <Route path="/patient" element={
        <PrivateRoute roles={['Patient']}>
          <Layout><PatientDashboard /></Layout>
        </PrivateRoute>
      } />
    </Routes>
  )
}
