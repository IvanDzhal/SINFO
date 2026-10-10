import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  MapPin,
  ShieldCheck,
  Store,
  Tag,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { api } from '@/services/api'
import { actionLabel } from '@/utils/auditLabels'

interface Dashboard {
  activeUsers: number
  inactiveUsers: number
  stores: number
  regions: number
  cities: number
  brands: number
  roles: number
  recent: {
    id: string
    action: string
    entityType: string
    createdAt: string
    actor: { firstName: string; lastName: string } | null
  }[]
}

function StatCard({
  to,
  icon: Icon,
  label,
  value,
  hint,
}: {
  to: string
  icon: LucideIcon
  label: string
  value: number
  hint?: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 hover:border-accent"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-tight">{value}</p>
        <p className="truncate text-sm text-muted">{label}</p>
        {hint && <p className="truncate text-xs text-muted">{hint}</p>}
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/admin/dashboard')
      .then((r) => setData(r.data))
      .catch(() => setError('Не вдалося завантажити дані'))
  }, [])

  if (error) return <p className="text-danger">{error}</p>
  if (!data) return <p className="text-muted">Завантаження...</p>

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Головна</h2>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          to="/admin/users"
          icon={Users}
          label="Активних користувачів"
          value={data.activeUsers}
          hint={data.inactiveUsers ? `Неактивних: ${data.inactiveUsers}` : undefined}
        />
        <StatCard to="/admin/stores" icon={Store} label="Магазинів" value={data.stores} />
        <StatCard to="/admin/regions" icon={MapPin} label="Областей" value={data.regions} />
        <StatCard to="/admin/cities" icon={Building2} label="Міст" value={data.cities} />
        <StatCard to="/admin/brands" icon={Tag} label="Брендів і форматів" value={data.brands} />
        <StatCard to="/admin/roles" icon={ShieldCheck} label="Ролей" value={data.roles} />
      </div>

      <div className="rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="font-medium">Останні дії</h3>
          <Link to="/admin/audit-log" className="text-sm text-accent hover:underline">
            Весь журнал
          </Link>
        </div>
        {data.recent.length === 0 && (
          <p className="border-t border-border px-4 py-6 text-center text-muted">
            Поки нічого немає
          </p>
        )}
        {data.recent.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-sm"
          >
            <div>
              <p>{actionLabel(r.action)}</p>
              <p className="text-xs text-muted">
                {r.actor ? `${r.actor.firstName} ${r.actor.lastName}` : 'Система'}
              </p>
            </div>
            <span className="text-xs text-muted">
              {new Date(r.createdAt).toLocaleString('uk-UA')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}