import { Navigate } from 'react-router-dom'
import { getCurrentUser } from '../services/api'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const user = getCurrentUser()
  const token = localStorage.getItem('authToken')

  if (!user || !token) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
