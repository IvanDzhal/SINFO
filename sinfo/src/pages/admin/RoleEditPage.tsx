import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/services/api'
import Button from '@/components/Button'
import { useCan } from '@/hooks/useCan'
import { getErrorMessage } from '@/utils/errors'

type Scope = 'SELF' | 'STORE' | 'REGION' | 'GLOBAL'

interface Permission {
  id: string
  code: string
}

interface RoleDetail {
  id: string
  name: string
  isSystem: boolean
  permissions: { permissionId: string; scope: Scope }[]
}

const SCOPE_ORDER: Scope[] = ['SELF', 'STORE', 'REGION', 'GLOBAL']

const SCOPE_LABEL: Record<Scope, string> = {
  SELF: 'Свої дані',
  STORE: 'Магазин',
  REGION: 'Область',
  GLOBAL: 'Вся компанія',
}

const GROUP_LABEL: Record<string, string> = {
  admin: 'Адмін-панель',
  'admin.audit': 'Журнал дій',
  knowledge: 'База знань',
  testing: 'Тестування',
  'analytics.sales': 'Аналітика продажів',
  'analytics.content': 'Аналітика контенту',
  'analytics.online_status': 'Онлайн-статус',
  'core.users': 'Користувачі',
  'core.roles': 'Ролі',
  'core.regions': 'Області',
  'core.cities': 'Міста',
  'core.stores': 'Магазини',
  'core.brands': 'Бренди',
}

const ACTION_LABEL: Record<string, string> = {
  access: 'Доступ',
  view: 'Перегляд',
  create: 'Створення',
  edit: 'Редагування',
  delete: 'Видалення',
  publish: 'Публікація',
  view_results: 'Перегляд результатів',
  view_region: 'Перегляд по області',
  view_store: 'Перегляд по магазину',
  view_employee: 'Перегляд по співробітнику',
  export: 'Експорт',
  deactivate: 'Деактивація',
  reset_password: 'Скидання пароля',
  change_login: 'Зміна логіну',
  manage_roles: 'Керування ролями',
  archive: 'Архівація',
  manage_categories: 'Керування категоріями',
  manage_files: 'Керування файлами',
  view_versions: 'Перегляд версій',
  view_read_status: 'Статус прочитання',
  manage_visibility: 'Керування видимістю',
  create_embed: 'HTML-вставки',
}

const selectClass =
  'rounded-xl border border-border bg-surface-2 px-2 py-1.5 text-sm text-ink outline-none focus:border-accent disabled:opacity-60'

function ScopeSelect({
  value,
  onChange,
  disabled,
}: {
  value: Scope | ''
  onChange: (v: Scope | '') => void
  disabled?: boolean
}) {
  return (
    <select
      className={selectClass}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as Scope | '')}
    >
      <option value="">Немає доступу</option>
      {SCOPE_ORDER.map((s) => (
        <option key={s} value={s}>
          {SCOPE_LABEL[s]}
        </option>
      ))}
    </select>
  )
}

export default function RoleEditPage() {
  const { id } = useParams()
  const can = useCan()
  const [role, setRole] = useState<RoleDetail | null>(null)
  const [name, setName] = useState('')
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [scopes, setScopes] = useState<Record<string, Scope | ''>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([api.get(`/core/roles/${id}`), api.get('/core/permissions')])
      .then(([r, p]) => {
        const loaded: RoleDetail = r.data
        setRole(loaded)
        setName(loaded.name)
        setPermissions(p.data)
        const map: Record<string, Scope | ''> = {}
        for (const rp of loaded.permissions) {
          const current = map[rp.permissionId]
          if (!current || SCOPE_ORDER.indexOf(rp.scope) > SCOPE_ORDER.indexOf(current)) {
            map[rp.permissionId] = rp.scope
          }
        }
        setScopes(map)
      })
      .catch(() => setError('Не вдалося завантажити роль'))
      .finally(() => setLoading(false))
  }, [id])

  const groups = useMemo(() => {
    const g: Record<string, Permission[]> = {}
    for (const p of permissions) {
      const key = p.code.split('.').slice(0, -1).join('.')
      ;(g[key] ??= []).push(p)
    }
    return Object.entries(g)
  }, [permissions])

  function setOne(permissionId: string, value: Scope | '') {
    setScopes((s) => ({ ...s, [permissionId]: value }))
  }

  function setGroup(items: Permission[], value: Scope | '') {
    setScopes((s) => {
      const next = { ...s }
      items.forEach((p) => (next[p.id] = value))
      return next
    })
  }

  async function save() {
    if (!role) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const trimmed = name.trim()
      if (!role.isSystem && trimmed && trimmed !== role.name) {
        await api.patch(`/core/roles/${role.id}`, { name: trimmed })
        setRole({ ...role, name: trimmed })
      }
      const payload = permissions
        .filter((p) => scopes[p.id])
        .map((p) => ({ permissionId: p.id, scope: scopes[p.id] }))
      await api.patch(`/core/roles/${role.id}/permissions`, { permissions: payload })
      setMessage('Збережено')
    } catch (err) {
      setError(getErrorMessage(err, 'Не вдалося зберегти'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-muted">Завантаження...</p>
  if (!role) return <p className="text-danger">{error || 'Роль не знайдено'}</p>

  const locked = role.isSystem && role.name === 'Адмін'
  const readOnly = locked || !can('core.roles.edit')

  return (
    <div>
      <Link
        to="/admin/roles"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft size={16} /> Ролі
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-xl font-semibold outline-none focus:border-accent disabled:opacity-70"
          value={name}
          disabled={role.isSystem || readOnly}
          onChange={(e) => setName(e.target.value)}
        />
        {role.isSystem && (
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted">
            Системна роль
          </span>
        )}
      </div>

      {locked && (
        <p className="mb-4 text-sm text-muted">Права ролі «Адмін» захищені від змін.</p>
      )}

      {role.isSystem && !locked && (
        <p className="mb-4 text-sm text-muted">
          Зміна прав системної ролі вплине на всіх користувачів, яким вона призначена.
        </p>
      )}

      <div className="space-y-4">
        {groups.map(([key, items]) => (
          <div key={key} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex items-center justify-between gap-3 bg-surface-2 px-4 py-2.5">
              <h3 className="font-medium">{GROUP_LABEL[key] ?? key}</h3>
              <label className="flex items-center gap-2 text-sm text-muted">
                Всім:
                <ScopeSelect value="" disabled={readOnly} onChange={(v) => setGroup(items, v)} />
              </label>
            </div>
            {items.map((p) => {
              const action = p.code.split('.').pop() ?? p.code
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 border-t border-border px-4 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm">{ACTION_LABEL[action] ?? action}</p>
                    <p className="truncate text-xs text-muted">{p.code}</p>
                  </div>
                  <ScopeSelect
                    value={scopes[p.id] ?? ''}
                    disabled={readOnly}
                    onChange={(v) => setOne(p.id, v)}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="sticky bottom-0 mt-4 flex items-center justify-end gap-3 border-t border-border bg-bg py-3">
          {message && <span className="text-sm text-success">{message}</span>}
          {error && <span className="text-sm text-danger">{error}</span>}
          <Button onClick={save} disabled={saving}>
            {saving ? 'Збереження...' : 'Зберегти'}
          </Button>
        </div>
      )}
    </div>
  )
}