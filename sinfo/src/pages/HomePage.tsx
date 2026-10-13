import Avatar from '@/components/Avatar'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Briefcase,
  Building2,
  ClipboardCheck,
  GraduationCap,
  Megaphone,
  Plus,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { api } from '@/services/api'
import { useAuthStore } from '@/store/useAuthStore'
import { useCan } from '@/hooks/useCan'
import { useFetch } from '@/hooks/useFetch'

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

interface Latest {
  id: string
  slug: string | null
  type: 'instruction' | 'material' | 'news'
  title: string
  isRequired: boolean
  publishedAt: string | null
  author: { firstName: string; lastName: string }
}

const TYPE_LABEL: Record<Latest['type'], string> = {
  instruction: 'Інструкція',
  material: 'Матеріал',
  news: 'Новина',
}

const TYPE_ICON: Record<Latest['type'], LucideIcon> = {
  instruction: BookOpen,
  material: Briefcase,
  news: Megaphone,
}

function LatestFeed() {
  const can = useCan()
  const { data, loading } = useFetch<Latest>('/knowledge/items/latest?limit=6')
  if (!can('knowledge.view')) return null

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="px-4 py-3">
        <h3 className="font-medium">Останні оновлення</h3>
      </div>
      {!loading && data.length === 0 && (
        <p className="border-t border-border px-4 py-8 text-center text-sm text-muted">
          Поки нових матеріалів немає.
        </p>
      )}
      {data.map((i) => {
        const Icon = TYPE_ICON[i.type]
        return (
          <Link
            key={i.id}
            to={`/knowledge/${i.slug ?? i.id}`}
            className="flex items-center gap-3 border-t border-border px-4 py-3 hover:bg-surface-2"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{i.title}</p>
              <p className="text-xs text-muted">
                {TYPE_LABEL[i.type]}
                {i.publishedAt && ` · ${new Date(i.publishedAt).toLocaleDateString('uk-UA')}`}
                {` · ${i.author.firstName} ${i.author.lastName}`}
              </p>
            </div>
            {i.isRequired && (
              <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                Обов'язково
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

interface NewsItem {
  id: string
  slug: string | null
  title: string
  description: string
  isRequired: boolean
  isRead: boolean
  publishedAt: string | null
  author: { firstName: string; lastName: string }
}

function NewsCard({ items, loading }: { items: NewsItem[]; loading: boolean }) {
  const can = useCan()
  if (!can('knowledge.view')) return null

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h3 className="font-medium">Новини</h3>
        {can('knowledge.create') && (
          <Link
            to="/knowledge/new?type=news"
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
          >
            <Plus size={14} /> Новина
          </Link>
        )}
      </div>
      {!loading && items.length === 0 && (
        <p className="border-t border-border px-4 py-6 text-center text-sm text-muted">
          Поки новин немає
        </p>
      )}
      {items.map((n) => (
        <Link
          key={n.id}
          to={`/knowledge/${n.slug ?? n.id}`}
          className="block border-t border-border px-4 py-3 hover:bg-surface-2"
        >
          <div className="flex items-start gap-2">
            {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{n.title}</p>
              {n.description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.description}</p>
              )}
              <p className="mt-1 text-xs text-muted">
                {n.publishedAt && `${new Date(n.publishedAt).toLocaleDateString('uk-UA')} · `}
                {n.author.firstName} {n.author.lastName}
              </p>
            </div>
            {n.isRequired && (
              <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                Обов'язково
              </span>
            )}
          </div>
        </Link>
      ))}
      <Link
        to="/news"
        className="block border-t border-border px-4 py-2.5 text-center text-sm text-accent hover:bg-surface-2"
      >
        Всі новини
      </Link>
    </div>
  )
}

interface OnlineUser {
  id: string
  login: string
  canOpen: boolean
  firstName: string
  lastName: string
  avatarUrl: string | null
  store: string | null
  region: string | null
}

function OnlineRow({
  user: u,
  meId,
  children,
}: {
  user: OnlineUser
  meId?: string
  children: React.ReactNode
}) {
  const cls = 'flex items-center gap-3 border-t border-border px-4 py-2.5'
  if (!u.canOpen) return <div className={cls}>{children}</div>
  const to = u.id === meId ? '/profile' : `/profile/${encodeURIComponent(u.login)}`
  return (
    <Link to={to} className={`${cls} hover:bg-surface-2`}>
      {children}
    </Link>
  )
}

function OnlineCard() {
  const user = useAuthStore((s) => s.user)
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
    <div className="h-fit rounded-2xl border border-border bg-surface">
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
        <OnlineRow key={u.id} user={u} meId={user?.id}>
          <span className="relative shrink-0">
            <Avatar firstName={u.firstName} lastName={u.lastName} url={u.avatarUrl} />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-success" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm">
              {u.firstName} {u.lastName}
            </p>
            <p className="truncate text-xs text-muted">{u.store ?? u.region ?? '—'}</p>
          </div>
        </OnlineRow>
      ))}
    </div>
  )
}

export default function HomePage() {
  const user = useAuthStore((s) => s.user)
  const can = useCan()
  const news = useFetch<NewsItem>('/knowledge/items/latest?type=news&limit=5')
  const visible = cards.filter((c) => !c.perm || can(c.perm))

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <h2 className="mb-5 text-2xl font-semibold">Ласкаво просимо, {user?.firstName}! 👋</h2>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {visible.map((c) => (
            <Card key={c.to} {...c} />
          ))}
        </div>

        <div className="mb-8 xl:hidden">
          <NewsCard items={news.data} loading={news.loading} />
        </div>

        <LatestFeed />
      </div>

      <aside className="space-y-6">
        <div className="hidden xl:block">
          <NewsCard items={news.data} loading={news.loading} />
        </div>
        <OnlineCard />
      </aside>
    </div>
  )
}