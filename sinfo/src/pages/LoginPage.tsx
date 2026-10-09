import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/services/api'
import { useAuthStore } from '@/store/useAuthStore'

export default function LoginPage() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setSession = useAuthStore((s) => s.setSession)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { login, password })
      const me = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      })
      setSession(me.data, data.accessToken, data.refreshToken)
      navigate('/admin')
    } catch {
      setError('Невірний логін або пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm"
      >
        <h1 className="mb-1 text-xl font-semibold">SINFO 2.0</h1>
        <p className="mb-6 text-sm text-neutral-500">Увійдіть у свій акаунт</p>

        <label className="mb-1 block text-sm font-medium">Логін</label>
        <input
          className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#FF6B00]"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          autoFocus
        />

        <label className="mb-1 block text-sm font-medium">Пароль</label>
        <input
          type="password"
          className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#FF6B00]"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#FF6B00] py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Вхід...' : 'Увійти'}
        </button>
      </form>
    </div>
  )
}