import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BookOpen, ClipboardCheck, Settings, Trophy, Users } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/services/api'
import { useCan } from '@/hooks/useCan'
import Avatar from '@/components/Avatar'
import UserResultsDrawer from '@/components/UserResultsDrawer'
import { getErrorMessage } from '@/utils/errors'

interface Profile {
  user: {
    id: string
    firstName: string
    lastName: string
    login: string
    status: 'active' | 'inactive'
    roles: string[]
    region: string | null
    city: string | null
    store: string | null
    brand: string | null
    avatarUrl: string | null
    lastActivityAt?: string | null
  }
  isSelf: boolean
  hasTeam: boolean
  kpi: {
    instructionsRead: number | null
    testsPassed: number | null
    averagePercent: number | null
    activeDays: number
    activeDaysWindow: number
  }
  knowledge: {
    read: number
    total: number
    percent: number
    last: { id: string; title: string; readAt: string } | null
  } | null
  tests:
    | {
        testId: string
        title: string
        percent: number
        passed: boolean
        passingScorePercent: number
        attempts: number
        lastAt: string | null
      }[]
    | null
  activity:
    | { type: 'knowledge_read' | 'test_completed'; title: string; targetId: string; at: string }[]
    | null
}

interface Ranking {
  period: string
  top: {
    rank: number
    userId: string
    login: string
    name: string
    store: string | null
    percent: number
    avatarUrl: string | null
    isMe: boolean
    canOpen: boolean
  }[]
  me: { rank: number; name: string; percent: number } | null
}

interface TeamMember {
  id: string
  login: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  region: string | null
  store: string | null
  city: string | null
  tests: number
  percent: number | null
  online: boolean
}

const ONLINE_MS = 90_000

function ago(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'щойно'
  if (min < 60) return `${min} хв тому`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} год тому`
  return `${Math.floor(h / 24)} дн тому`
}

function when(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 24 * 3_600_000) return ago(iso)
  return d.toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function TeamCard() {
  const [members, setMembers] = useState<TeamMember[] | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('')

  useEffect(() => {
    api
      .get<TeamMember[]>('/profile/team')
      .then((r) => setMembers(r.data))
      .catch(() => setError('Не вдалося завантажити список продавців'))
  }, [])

  const regions = [...new Set((members ?? []).map((m) => m.region).filter((x): x is string => !!x))].sort()
  const q = search.trim().toLowerCase()
  const shown = (members ?? []).filter(
    (m) =>
      (!region || m.region === region) &&
      (!q || `${m.firstName} ${m.lastName} ${m.store ?? ''} ${m.city ?? ''}`.toLowerCase().includes(q)),
  )

  return (
    <Card title={`Продавці${members ? ` · ${members.length}` : ''}`} icon={<Users size={16} className="text-accent" />}>
      {error && <p className="text-sm text-danger">{error}</p>}
      {!members && !error && <Empty text="Завантаження..." />}
      {members && (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук за іменем, магазином, містом"
              className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            />
            {regions.length > 1 && (
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              >
                <option value="">Усі області</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            )}
          </div>
          {shown.length === 0 ? (
            <Empty text={members.length === 0 ? 'У вашій зоні поки немає продавців' : 'Нічого не знайдено'} />
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {shown.map((m) => (
                <li key={m.id}>
                  <Link to={`/profile/${encodeURIComponent(m.login)}`} className="flex items-center gap-3 py-2 hover:bg-surface-2">
                    <span className="relative shrink-0">
                      <Avatar firstName={m.firstName} lastName={m.lastName} url={m.avatarUrl} />
                      {m.online && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-success" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {m.firstName} {m.lastName}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {[m.store, m.city, region ? null : m.region].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                    <span
                      className={clsx(
                        'shrink-0 text-sm font-semibold',
                        m.percent === null ? 'text-muted' : m.percent >= 80 ? 'text-success' : 'text-danger',
                      )}
                    >
                      {m.percent === null ? '—' : `${m.percent}%`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  )
}

// Рядок-посилання, якщо профіль доступний; інакше звичайний блок
function RowLink({ to, className, children }: { to: string | null; className?: string; children: React.ReactNode }) {
  if (!to) return <div className={className}>{children}</div>
  return (
    <Link to={to} className={clsx(className, 'hover:bg-surface-2')}>
      {children}
    </Link>
  )
}

const Empty = ({ text }: { text: string }) => <p className="text-sm text-muted">{text}</p>

export default function ProfilePage() {
  const { id } = useParams()
  const can = useCan()
  const [data, setData] = useState<Profile | null>(null)
  const [ranking, setRanking] = useState<Ranking | null>(null)
  const [error, setError] = useState('')
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    setData(null)
    setError('')
    api
      .get<Profile>(id ? `/profile/${id}` : '/profile')
      .then((r) => setData(r.data))
      .catch((e) => setError(getErrorMessage(e, 'Не вдалося завантажити профіль')))
  }, [id])

  useEffect(() => {
    api
      .get<Ranking>('/profile/ranking')
      .then((r) => setRanking(r.data))
      .catch(() => {})
  }, [])

  if (error) return <p className="text-danger">{error}</p>
  if (!data) return <p className="text-muted">Завантаження...</p>

  const u = data.user
  const online = u.lastActivityAt && Date.now() - new Date(u.lastActivityAt).getTime() < ONLINE_MS
  const place = [u.region, u.city, u.store].filter(Boolean)
  const month = ranking
    ? new Date(`${ranking.period}-01`).toLocaleString('uk-UA', { month: 'long', year: 'numeric' })
    : ''

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
        <Avatar firstName={u.firstName} lastName={u.lastName} url={u.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">
            {u.firstName} {u.lastName}
          </h2>
          <p className="text-sm text-muted">
            @{u.login.toUpperCase()}
            {u.roles.length > 0 && ` · ${u.roles.join(', ')}`}
          </p>
          <p className="mt-1 text-sm text-muted">
            {place.length > 0 ? place.join(' · ') : 'Головний офіс'}
            {u.brand && ` · ${u.brand}`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <span className={u.status === 'active' ? 'text-success' : 'text-muted'}>
              {u.status === 'active' ? '🟢 Активний' : '⚪ Неактивний'}
            </span>
            {u.lastActivityAt !== undefined && (
              <span className="text-muted">
                {online ? '🟢 Онлайн' : u.lastActivityAt ? `Був(ла) ${ago(u.lastActivityAt)}` : 'Ще не заходив(ла)'}
              </span>
            )}
          </div>
        </div>
        {data.isSelf && (
          <Link
            to="/profile/settings"
            aria-label="Налаштування"
            title="Налаштування"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border p-2 text-sm hover:bg-surface-2 sm:px-3"
          >
            <Settings size={16} />
            <span className="hidden sm:inline">Налаштування</span>
          </Link>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Прочитано інструкцій" value={data.kpi.instructionsRead?.toString() ?? '—'} />
        <Kpi label="Тестів пройдено" value={data.kpi.testsPassed?.toString() ?? '—'} />
        <Kpi
          label="Середній результат"
          value={data.kpi.averagePercent !== null ? `${Math.round(data.kpi.averagePercent)}%` : '—'}
        />
        <Kpi label={`Днів активності за ${data.kpi.activeDaysWindow} дн.`} value={String(data.kpi.activeDays)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {data.tests && (
          <Card title="Останні тести" icon={<ClipboardCheck size={16} className="text-accent" />}>
            {data.tests.length === 0 ? (
              <Empty text="Тестів ще не пройдено" />
            ) : (
              <ul className="space-y-2">
                {data.tests.map((t) => (
                  <li key={t.testId} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      {data.isSelf ? (
                        <Link to={`/testing/${t.testId}`} className="hover:text-accent">
                          {t.title}
                        </Link>
                      ) : (
                        <span>{t.title}</span>
                      )}
                      <p className="text-xs text-muted">
                        {t.lastAt && `${when(t.lastAt)} · `}спроб: {t.attempts}
                      </p>
                    </div>
                    <span className={clsx('shrink-0 font-semibold', t.passed ? 'text-success' : 'text-danger')}>
                      {t.percent}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {!data.isSelf && can('testing.view_analytics') && (
              <button onClick={() => setDrawer(true)} className="mt-3 text-sm text-accent hover:underline">
                Детальні результати
              </button>
            )}
          </Card>
        )}

        {data.activity && (
          <Card title="Остання активність">
            {data.activity.length === 0 ? (
              <Empty text="Поки немає активності" />
            ) : (
              <ul className="space-y-2">
                {data.activity.map((a, i) => (
                  <li key={i} className="text-sm">
                    {a.type === 'knowledge_read' ? 'Прочитав(ла) ' : 'Пройшов(ла) тест '}«{a.title}»
                    <p className="text-xs text-muted">{when(a.at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card title={`TOP-10 продавців${month ? ` · ${month}` : ''}`} icon={<Trophy size={16} className="text-accent" />}>
          {!ranking ? (
            <Empty text="Завантаження..." />
          ) : ranking.top.length === 0 ? (
            <Empty text="У цьому місяці ще немає результатів обов'язкових тестів" />
          ) : (
            <ol className="space-y-2">
              {ranking.top.map((r) => (
                <li key={r.userId}>
                  <RowLink
                    to={r.canOpen ? (r.isMe ? '/profile' : `/profile/${encodeURIComponent(r.login)}`) : null}
                    className={clsx('flex items-center gap-2 rounded-lg px-2 py-1 text-sm', r.isMe && 'bg-accent-soft')}
                  >
                  <span className="w-6 text-center text-muted">{['🥇', '🥈', '🥉'][r.rank - 1] ?? r.rank}</span>
                  <Avatar
                    firstName={r.name.split(' ')[0]}
                    lastName={r.name.split(' ')[1] ?? ''}
                    url={r.avatarUrl}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {r.name}
                    {r.store && <span className="text-xs text-muted"> · {r.store}</span>}
                  </span>
                  <span className="font-semibold">{r.percent}%</span>
                  </RowLink>
                </li>
              ))}
            </ol>
          )}
          {ranking?.me && (
            <p className="mt-3 border-t border-border pt-2 text-sm text-muted">
              Ваше місце: {ranking.me.rank} · {ranking.me.percent}%
            </p>
          )}
        </Card>
      </div>

      {data.hasTeam && <TeamCard />}

      {data.knowledge && (
        <Card title="База знань" icon={<BookOpen size={16} className="text-accent" />}>
          {data.knowledge.total === 0 ? (
            <Empty text="Для цього користувача немає доступних інструкцій" />
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span>
                  {data.knowledge.read} / {data.knowledge.total} інструкцій прочитано
                </span>
                <span className="font-semibold">{data.knowledge.percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${data.knowledge.percent}%` }} />
              </div>
            </>
          )}
          {data.knowledge.last && (
            <p className="mt-3 text-sm text-muted">
              Остання:{' '}
              <Link to={`/knowledge/${data.knowledge.last.id}`} className="text-ink hover:text-accent">
                «{data.knowledge.last.title}»
              </Link>
            </p>
          )}
        </Card>
      )}

      {drawer && <UserResultsDrawer userId={u.id} onClose={() => setDrawer(false)} />}
    </div>
  )
}
