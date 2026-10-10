import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import DataTable, { StatusBadge } from '@/components/DataTable'
import Button from '@/components/Button'
import { useFetch } from '@/hooks/useFetch'
import CreateUserModal from './CreateUserModal'

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

interface Item {
  id: string
  name: string
}

const filterClass =
  'rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent'

export default function UsersPage() {
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState('active')
  const [roleId, setRoleId] = useState('')
  const [regionId, setRegionId] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const params = new URLSearchParams()
  if (debounced) params.set('search', debounced)
  if (status && status !== 'all') params.set('status', status)
  if (roleId) params.set('roleId', roleId)
  if (regionId) params.set('regionId', regionId)
  const query = params.toString()

  const { data, loading, error, reload } = useFetch<UserRow>(
    `/core/users${query ? `?${query}` : ''}`,
  )
  const roles = useFetch<Item>('/core/roles').data
  const regions = useFetch<Item>('/core/regions').data

  const hasFilters = !!(search || status !== 'active' || roleId || regionId)

  function reset() {
    setSearch('')
    setStatus('active')
    setRoleId('')
    setRegionId('')
  }

  return (
    <>
      <DataTable
        title="Користувачі"
        actionPerm="core.users.create"
        rows={data}
        loading={loading}
        error={error}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Створити
          </Button>
        }
        toolbar={
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                className={`${filterClass} w-full pl-9`}
                placeholder="Пошук за ім'ям або логіном"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className={filterClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Активні</option>
                <option value="inactive">Неактивні</option>
                <option value="all">Усі</option>
            </select>
            <select className={filterClass} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">Усі ролі</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <select
              className={filterClass}
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
            >
              <option value="">Усі області</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button className="px-2 text-sm text-muted hover:text-ink" onClick={reset}>
                Скинути
              </button>
            )}
          </div>
        }
        columns={[
          {
            header: "Ім'я",
            render: (u) => (
              <Link to={`/admin/users/${u.id}`} className="font-medium text-accent hover:underline">
                {u.firstName} {u.lastName}
              </Link>
            ),
          },
          { header: 'Логін', render: (u) => <span className="text-muted">{u.login}</span> },
          { header: 'Ролі', render: (u) => u.roles.map((r) => r.role.name).join(', ') },
          { header: 'Область', render: (u) => u.region?.name ?? '—' },
          { header: 'Магазин', render: (u) => u.store?.name ?? '—' },
          { header: 'Статус', render: (u) => <StatusBadge status={u.status} /> },
        ]}
      />
      {creating && (
        <CreateUserModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            reload()
          }}
        />
      )}
    </>
  )
}