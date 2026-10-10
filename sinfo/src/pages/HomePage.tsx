import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'

export default function HomePage() {
  const { user, logout } = useAuthStore()
  return (
    <div className="p-6">
      <h1 className="mb-2 text-xl font-semibold">Вітаю, {user?.firstName}</h1>
      <p className="mb-4 text-muted">Користувацька частина порталу в розробці.</p>
      <div className="flex gap-4 text-sm">
        {user?.permissions.includes('admin.access') && (
          <Link to="/admin" className="text-accent hover:underline">Адмін-панель</Link>
        )}
        <button onClick={logout} className="text-muted hover:text-ink">Вийти</button>
      </div>
    </div>
  )
}