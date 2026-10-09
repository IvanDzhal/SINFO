import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'

export default function ProtectedRoute() {
  const { user, refreshToken } = useAuthStore()
  if (!user && !refreshToken) return <Navigate to="/login" replace />
  return <Outlet />
}