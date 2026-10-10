import { useEffect, useState } from 'react'
import axios from 'axios'
import { Navigate, Outlet } from 'react-router-dom'
import { api } from '@/services/api'
import { useAuthStore } from '@/store/useAuthStore'

export default function ProtectedRoute({ permission }: { permission?: string }) {
  const { user, refreshToken, setSession, logout } = useAuthStore()
  const [checking, setChecking] = useState(!user && !!refreshToken)

  useEffect(() => {
    if (user || !refreshToken) return
    const base = api.defaults.baseURL
    axios
      .post(`${base}/auth/refresh`, { refreshToken })
      .then(async (r) => {
        const me = await axios.get(`${base}/auth/me`, {
          headers: { Authorization: `Bearer ${r.data.accessToken}` },
        })
        setSession(me.data, r.data.accessToken, r.data.refreshToken)
      })
      .catch(() => logout())
      .finally(() => setChecking(false))
  }, [])

  if (checking) return <p className="p-6 text-muted">Завантаження...</p>
  if (!user) return <Navigate to="/login" replace />
  if (permission && !user.permissions.includes(permission)) return <Navigate to="/" replace />
  return <Outlet />
}