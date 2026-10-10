import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  BookOpen,
  Briefcase,
  ClipboardCheck,
  GraduationCap,
  Home,
  Menu,
  Moon,
  Settings,
  Sun,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuthStore } from '@/store/useAuthStore'
import { useThemeStore } from '@/store/useThemeStore'
import { useCan } from '@/hooks/useCan'
import { useHeartbeat } from '@/hooks/useHeartbeat'
import SearchBox from '@/components/SearchBox'

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; perms?: string[] }

const nav: NavItem[] = [
  { to: '/', label: 'Головна', icon: Home, end: true },
  { to: '/instructions', label: 'Інструкції', icon: BookOpen, perms: ['knowledge.view'] },
  { to: '/materials', label: 'Робочі матеріали', icon: Briefcase, perms: ['knowledge.view'] },
  { to: '/training', label: 'Навчання', icon: GraduationCap },
  { to: '/testing', label: 'Тестування', icon: ClipboardCheck, perms: ['testing.view'] },
  {
    to: '/analytics',
    label: 'Аналітика',
    icon: TrendingUp,
    perms: ['analytics.sales.view', 'analytics.content.view'],
  },
  { to: '/extra-sales', label: 'Додаткові продажі', icon: Wallet },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm',
    isActive ? 'bg-accent-soft font-medium text-accent' : 'text-ink hover:bg-surface-2',
  )

export default function UserLayout() {
  const { user, logout } = useAuthStore()
  const { theme, toggle } = useThemeStore()
  const can = useCan()
  const [open, setOpen] = useState(false)
  useHeartbeat()

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`
  const items = nav.filter((i) => !i.perms || i.perms.some((p) => can(p)))

  return (
    <div className="min-h-screen bg-bg text-ink">
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto border-r border-border bg-surface transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-base font-semibold">
            <span className="text-accent">Слухавка</span> Info
          </span>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Закрити меню">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 pb-3">
          <p className="mb-1 px-3 text-xs font-medium uppercase text-muted">Навігація</p>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={linkClass}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {can('admin.access') && (
          <div className="border-t border-border p-3">
            <NavLink to="/admin" className={linkClass}>
              <Settings size={18} />
              Адмін-панель
            </NavLink>
          </div>
        )}
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-bg px-4 py-3 lg:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Відкрити меню">
            <Menu size={22} />
          </button>
          {can('knowledge.view') ? <SearchBox /> : <div />}
          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              aria-label="Змінити тему"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link
              to="/profile"
              className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-sm"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-medium text-accent">
                {initials}
              </span>
              <span className="hidden sm:inline">
                {user?.firstName} {user?.lastName}
              </span>
            </Link>
            <button onClick={logout} className="text-sm text-muted hover:text-ink">
              Вийти
            </button>
          </div>
        </header>
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}