import { NavLink, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import clsx from 'clsx'

type NavItem = { to: string; label: string; end?: boolean }
type NavGroup = { group: string; items: NavItem[] }

const nav: NavGroup[] = [
  {
    group: 'Загальне',
    items: [{ to: '/admin', label: 'Головна', end: true }],
  },
  {
    group: 'Організація',
    items: [
      { to: '/admin/regions', label: 'Області' },
      { to: '/admin/cities', label: 'Міста' },
      { to: '/admin/stores', label: 'Магазини' },
    ],
  },
  {
    group: 'Доступ',
    items: [
      { to: '/admin/users', label: 'Користувачі' },
      { to: '/admin/roles', label: 'Ролі' },
    ],
  },
  {
    group: 'Система',
    items: [{ to: '/admin/audit-log', label: 'Журнал дій' }],
  },
]

export default function AdminLayout() {
  const { user, logout } = useAuthStore()

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="w-64 shrink-0 border-r border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-5 py-4">
          <span className="text-base font-semibold">Слухавка Info</span>
        </div>
        <nav className="p-3">
          {nav.map((group) => (
            <div key={group.group} className="mb-4">
              <p className="mb-1 px-2 text-xs font-medium uppercase text-neutral-400">
                {group.group}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    clsx(
                      'block rounded-lg px-2 py-1.5 text-sm',
                      isActive
                        ? 'bg-[#FF6B00]/10 font-medium text-[#FF6B00]'
                        : 'text-neutral-700 hover:bg-neutral-100',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
          <div />
          <div className="flex items-center gap-3 text-sm">
            <span>{user?.firstName} {user?.lastName}</span>
            <button onClick={logout} className="text-neutral-500 hover:text-neutral-900">
              Вийти
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}