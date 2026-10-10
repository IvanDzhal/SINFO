import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Briefcase,
  Building2,
  ClipboardCheck,
  GraduationCap,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/services/api'
import { useAuthStore } from '@/store/useAuthStore'
import { useCan } from '@/hooks/useCan'

interface HomeCard {
  to: string
  title: string
  text: string
  icon: LucideIcon
  perm?: string
  soon?: boolean
}

const cards: HomeCard[] = [
  { to: '/about', title: 'Про компанію', text: 'Історія, місія та цінності', icon: Building2 },
  {
    to: '/training',
    title: 'Навчання',
    text: 'Навчальні матеріали для стажерів',
    icon: GraduationCap,
    soon: true,
  },
  {
    to: '/instructions',
    title: 'Інструкції',
    text: 'Стандарти та інструкції',
    icon: BookOpen,
    perm: 'knowledge.view',
  },
  {
    to: '/materials',
    title: 'Робочі матеріали',
    text: 'Умови роботи та документи',
    icon: Briefcase,
    perm: 'knowledge.view',
  },
  {
    to: '/testing',
    title: 'Тестування',
    text: 'Перевір свої знання',
    icon: ClipboardCheck,
    perm: 'testing.view',
  },
  { to: '/profile', title: 'Профіль', text: 'Твої результати та досягнення', icon: UserRound },
]

function Card({ to, title, text, icon: Icon, soon }: HomeCard) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface p-5">
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon size={20} />
      </span>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mb-4 mt-1 text-sm text-muted">{text}</p>
      <div className="mt-auto">
        {soon ? (
          <span className="inline-block rounded-xl bg-surface-2 px-4 py-2 text-sm text-muted">
            В розробці
          </span>
        ) : (
          <Link
            to={to}
            className="inline-block rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Перейти
          </Link>
        )}
      </div>
    </div>
  )
}

interface OnlineUser {
  id: string
  firstName: string
  lastName: string
  store: string | null
  region: string | null
}

function OnlineCard() {
  const [users, setUsers] = useState<OnlineUser[]>([])
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const load = () =>
      api
        .get('/presence/online')
        .then((r) => setUsers(r.data))
        .catch(() => setHidden(true))
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  if (hidden) return null

  return (
    <aside className="h-fit rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="font-medium">Зараз онлайн</h3>
        <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
          {users.length}
        </span>
      </div>
      {users.length === 0 && (
        <p className="border-t border-border px-4 py-6 text-center text-sm text-muted">
          Нікого немає
        </p>
      )}
      {users.map((u) => (
        <div key={u.id} className="flex items-center gap-3 border-t border-border px-4 py-2.5">
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-medium text-accent">
            {u.firstName[0]}
            {u.lastName[0]}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-success" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm">
              {u.firstName} {u.lastName}
            </p>
            <p className="truncate text-xs text-muted">{u.store ?? u.region ?? '—'}</p>
          </div>
        </div>
      ))}
    </aside>
  )
}

export default function HomePage() {
  const user = useAuthStore((s) => s.user)
  const can = useCan()
  const showOnline = can('analytics.online_status.view')
  const visible = cards.filter((c) => !c.perm || can(c.perm))

  return (
    <div
      className={clsx(
        'grid gap-6',
        showOnline && 'xl:grid-cols-[minmax(0,1fr)_300px]',
      )}
    >
      <div>
        <h2 className="mb-5 text-2xl font-semibold">Ласкаво просимо, {user?.firstName}! 👋</h2>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {visible.map((c) => (
            <Card key={c.to} {...c} />
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-surface">
          <div className="px-4 py-3">
            <h3 className="font-medium">Останні оновлення</h3>
          </div>
          <p className="border-t border-border px-4 py-8 text-center text-sm text-muted">
            Тут з'являтимуться нові інструкції, матеріали та новини.
          </p>
        </div>
      </div>

      {showOnline && <OnlineCard />}
    </div>
  )
}