import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import logo from '../assets/SINFO_LOGO.png';
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
  X,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuthStore } from '@/store/useAuthStore'
import { useThemeStore } from '@/store/useThemeStore'
import { useCan } from '@/hooks/useCan'
import { useHeartbeat } from '@/hooks/useHeartbeat'
import { useMyAvatar } from '@/hooks/useMyAvatar'
import Avatar from '@/components/Avatar'
import SearchBox from '@/components/SearchBox'
import NotificationsBell from '@/components/NotificationsBell'
import MaintenanceBanner from '@/components/MaintenanceBanner'
import SidebarCategories from '@/components/SidebarCategories'
import Footer from '@/components/Footer'

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; perms?: string[] }

const nav: NavItem[] = [
  { to: '/', label: 'Головна', icon: Home, end: true },
  { to: '/instructions', label: 'Інструкції', icon: BookOpen, perms: ['knowledge.view'] },
  { to: '/materials', label: 'Робочі матеріали', icon: Briefcase, perms: ['knowledge.view'] },
  { to: '/training', label: 'Навчання', icon: GraduationCap, perms: ['training.view', 'training.manage'] },
  { to: '/testing', label: 'Тестування', icon: ClipboardCheck, perms: ['testing.view'] },
  {
    to: '/analytics',
    label: 'Аналітика',
    icon: TrendingUp,
    perms: ['analytics.sales.view', 'analytics.content.view'],
  },
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
  const avatar = useMyAvatar()

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
          <Link
            to="/"
            className="flex items-center gap-2 text-base font-semibold"
            title="2.10.26"
          >
          <img src={logo} alt="Слухавка Інфо" className="h-8 w-auto" />
          </Link>
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
          {can('knowledge.view') && <SidebarCategories onNavigate={() => setOpen(false)} />}
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

      <div className="flex min-h-screen flex-col lg:pl-64">
        <MaintenanceBanner />
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-bg px-4 py-3 lg:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Відкрити меню">
            <Menu size={22} />
          </button>
          {can('knowledge.view') ? <SearchBox /> : <div />}
          <div className="flex items-center gap-3">
            <NotificationsBell />
            <button
              onClick={toggle}
              aria-label="Змінити тему"
              title={theme === 'dark' ? 'Світла тема' : 'Темна тема'}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link
              to="/profile"
              title="Мій профіль"
              className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-1 text-sm transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent sm:pr-3"
            >
              <Avatar firstName={user?.firstName ?? ''} lastName={user?.lastName ?? ''} url={avatar} size="sm" />
              <span className="hidden sm:inline">
                {user?.firstName} {user?.lastName}
              </span>
            </Link>
            <button
              onClick={logout}
              className="rounded-lg px-2 py-1 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              Вийти
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}