import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  Building2,
  LayoutDashboard,
  MapPin,
  Menu,
  Moon,
  ScrollText,
  ShieldCheck,
  Store,
  Tag,
  Sun,
  Users,
  X,
  FolderTree,
  ArrowLeft,
  DatabaseZap,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuthStore } from '@/store/useAuthStore'
import { useThemeStore } from '@/store/useThemeStore'
import { useCan } from '@/hooks/useCan'
import { useHeartbeat } from '@/hooks/useHeartbeat'
import { useMyAvatar } from '@/hooks/useMyAvatar'
import Avatar from '@/components/Avatar'
import MaintenanceBanner from '@/components/MaintenanceBanner'
import logo from '../assets/SINFO_LOGO.png';

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean }
type NavGroup = { group: string; items: NavItem[] }

const nav: NavGroup[] = [
  {
    group: 'Загальне',
    items: [{ to: '/admin', label: 'Головна', icon: LayoutDashboard, end: true }],
  },
  {
    group: 'Організація',
    items: [
      { to: '/admin/regions', label: 'Області', icon: MapPin },
      { to: '/admin/cities', label: 'Міста', icon: Building2 },
      { to: '/admin/stores', label: 'Магазини', icon: Store },
      { to: '/admin/brands', label: 'Бренди', icon: Tag },
    ],
  },
  {
    group: 'Доступ',
    items: [
      { to: '/admin/users', label: 'Користувачі', icon: Users },
      { to: '/admin/roles', label: 'Ролі', icon: ShieldCheck },
    ],
  },
  {
    group: 'База знань',
    items: [{ to: '/admin/knowledge/categories', label: 'Категорії', icon: FolderTree }],
  },
  {
    group: 'Система',
    items: [
      { to: '/admin/data-sync', label: 'Синхронізація даних', icon: DatabaseZap },
      { to: '/admin/maintenance', label: 'Технічні роботи', icon: Wrench },
      { to: '/admin/audit-log', label: 'Журнал дій', icon: ScrollText },
    ],
  },

  
]

const PERM: Record<string, string> = {
  '/admin': 'admin.access',
  '/admin/regions': 'core.regions.view',
  '/admin/cities': 'core.cities.view',
  '/admin/stores': 'core.stores.view',
  '/admin/brands': 'core.brands.view',
  '/admin/users': 'core.users.view',
  '/admin/roles': 'core.roles.view',
  '/admin/audit-log': 'admin.audit.view',
  '/admin/maintenance': 'admin.maintenance.manage',
  '/admin/data-sync': 'datasync.view',
  '/admin/knowledge/categories': 'knowledge.manage_categories',
}

export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  useHeartbeat()
  const { theme, toggle } = useThemeStore()
  const [open, setOpen] = useState(false)
  const avatar = useMyAvatar()

const can = useCan()
  const visibleNav = nav
    .map((g) => ({ ...g, items: g.items.filter((i) => can(PERM[i.to])) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="min-h-screen bg-bg text-ink">
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r border-border bg-surface transition-transform lg:translate-x-0',
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
        <div className="px-3 pb-2">
          <Link
            to="/"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink"
          >
            <ArrowLeft size={16} /> До порталу
          </Link>
        </div>
        <nav className="px-3 pb-3">
          {visibleNav.map((group) =>(
            <div key={group.group} className="mb-4">
              <p className="mb-1 px-3 text-xs font-medium uppercase text-muted">
                {group.group}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm',
                      isActive
                        ? 'bg-accent-soft font-medium text-accent'
                        : 'text-ink hover:bg-surface-2',
                    )
                  }
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <MaintenanceBanner />
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-bg px-4 py-3 lg:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Відкрити меню">
            <Menu size={22} />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
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
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}