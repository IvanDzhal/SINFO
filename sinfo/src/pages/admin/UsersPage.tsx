import { useEffect, useState } from 'react'
import { api } from '@/services/api'

interface UserRow {
  id: string
  login: string
  firstName: string
  lastName: string
  status: string
  roles: { role: { name: string } }[]
  region?: { name: string } | null
  store?: { name: string } | null
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/core/users')
      .then((res) => setUsers(res.data))
      .catch(() => setError('Не вдалося завантажити користувачів'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Завантаження...</p>
  if (error) return <p className="text-red-600">{error}</p>

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Користувачі</h2>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Ім'я</th>
              <th className="px-4 py-2 font-medium">Логін</th>
              <th className="px-4 py-2 font-medium">Ролі</th>
              <th className="px-4 py-2 font-medium">Область</th>
              <th className="px-4 py-2 font-medium">Магазин</th>
              <th className="px-4 py-2 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-neutral-100">
                <td className="px-4 py-2">{u.firstName} {u.lastName}</td>
                <td className="px-4 py-2 text-neutral-500">{u.login}</td>
                <td className="px-4 py-2">{u.roles.map((r) => r.role.name).join(', ')}</td>
                <td className="px-4 py-2">{u.region?.name ?? '—'}</td>
                <td className="px-4 py-2">{u.store?.name ?? '—'}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      u.status === 'active' ? 'text-green-600' : 'text-neutral-400'
                    }
                  >
                    {u.status === 'active' ? '🟢 Активний' : '⚪ Неактивний'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}