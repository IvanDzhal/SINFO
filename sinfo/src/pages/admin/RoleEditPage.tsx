import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/services/api'
import Button from '@/components/Button'
import { useCan } from '@/hooks/useCan'
import { getErrorMessage } from '@/utils/errors'
import { usePageTitle } from '@/hooks/usePageTitle'

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

// Єдина мапа підписів: код права -> назва українською.
// Групи й права показуються у порядку запису тут.
const GROUPS: { key: string; label: string; items: [string, string][] }[] = [
  {
    key: 'knowledge',
    label: 'База знань',
    items: [
      ['knowledge.view', 'Перегляд інструкцій і матеріалів'],
      ['knowledge.view_news', 'Перегляд новин'],
      ['knowledge.view_updates', 'Перегляд «Останніх оновлень»'],
      ['knowledge.create', 'Створення матеріалів'],
      ['knowledge.edit', 'Редагування матеріалів'],
      ['knowledge.publish', 'Публікація матеріалів'],
      ['knowledge.archive', 'Архівація матеріалів'],
      ['knowledge.delete', 'Видалення матеріалів'],
      ['knowledge.view_versions', 'Перегляд версій'],
      ['knowledge.view_read_status', 'Статус прочитання'],
      ['knowledge.manage_visibility', 'Керування видимістю'],
      ['knowledge.manage_categories', 'Керування категоріями'],
      ['knowledge.manage_files', 'Керування файлами'],
      ['knowledge.create_embed', 'Вставка HTML-блоків'],
    ],
  },
  {
    key: 'testing',
    label: 'Тестування',
    items: [
      ['testing.view', 'Перегляд тестів'],
      ['testing.start', 'Проходження тестів'],
      ['testing.create', 'Створення тестів'],
      ['testing.edit', 'Редагування тестів'],
      ['testing.publish', 'Публікація тестів'],
      ['testing.archive', 'Архівація тестів'],
      ['testing.delete', 'Видалення тестів'],
      ['testing.manage_questions', 'Керування питаннями'],
      ['testing.manage_required', "Обов'язкові тести"],
      ['testing.manage_deadlines', 'Керування термінами'],
      ['testing.view_results', 'Перегляд результатів'],
      ['testing.view_answers', 'Перегляд відповідей'],
      ['testing.edit_results', 'Редагування й видалення результатів'],
      ['testing.view_attempts', 'Перегляд спроб'],
      ['testing.view_analytics', 'Аналітика тестування'],
    ],
  },
  {
    key: 'training',
    label: 'Навчання',
    items: [
      ['training.view', 'Проходження навчання'],
      ['training.manage', 'Керування програмою навчання'],
      ['training.view_analytics', 'Прогрес співробітників'],
    ],
  },
  {
    key: 'analytics.sales',
    label: 'Аналітика продажів',
    items: [
      ['analytics.sales.view', 'Перегляд по компанії'],
      ['analytics.sales.view_region', 'Перегляд по області'],
      ['analytics.sales.view_store', 'Перегляд по магазину'],
      ['analytics.sales.view_employee', 'Перегляд по співробітнику'],
      ['analytics.sales.export', 'Експорт'],
    ],
  },
  {
    key: 'analytics.content',
    label: 'Аналітика контенту',
    items: [
      ['analytics.content.view', 'Перегляд по компанії'],
      ['analytics.content.view_region', 'Перегляд по області'],
      ['analytics.content.view_store', 'Перегляд по магазину'],
      ['analytics.content.view_employee', 'Перегляд по співробітнику'],
      ['analytics.content.export', 'Експорт'],
    ],
  },
  {
    key: 'analytics.online_status',
    label: 'Онлайн-статус',
    items: [
      ['analytics.online_status.view', 'Перегляд онлайн-статусу'],
    ],
  },
  {
    key: 'datasync',
    label: 'Синхронізація даних',
    items: [
      ['datasync.view', 'Перегляд джерел і запусків'],
      ['datasync.manage', 'Керування джерелами'],
      ['datasync.run', 'Запуск синхронізації'],
    ],
  },
  {
    key: 'core.users',
    label: 'Користувачі',
    items: [
      ['core.users.view', 'Перегляд'],
      ['core.users.create', 'Створення'],
      ['core.users.edit', 'Редагування'],
      ['core.users.deactivate', 'Деактивація'],
      ['core.users.reset_password', 'Скидання пароля'],
      ['core.users.change_login', 'Зміна логіну'],
      ['core.users.manage_roles', 'Керування ролями користувача'],
      ['core.users.delete', 'Видалення'],
    ],
  },
  {
    key: 'core.roles',
    label: 'Ролі',
    items: [
      ['core.roles.view', 'Перегляд'],
      ['core.roles.create', 'Створення'],
      ['core.roles.edit', 'Редагування'],
      ['core.roles.archive', 'Архівація'],
    ],
  },
  {
    key: 'core.regions',
    label: 'Області',
    items: [
      ['core.regions.view', 'Перегляд'],
      ['core.regions.create', 'Створення'],
      ['core.regions.edit', 'Редагування'],
    ],
  },
  {
    key: 'core.cities',
    label: 'Міста',
    items: [
      ['core.cities.view', 'Перегляд'],
      ['core.cities.create', 'Створення'],
      ['core.cities.edit', 'Редагування'],
    ],
  },
  {
    key: 'core.stores',
    label: 'Магазини',
    items: [
      ['core.stores.view', 'Перегляд'],
      ['core.stores.create', 'Створення'],
      ['core.stores.edit', 'Редагування'],
    ],
  },
  {
    key: 'core.brands',
    label: 'Бренди',
    items: [
      ['core.brands.view', 'Перегляд'],
      ['core.brands.create', 'Створення'],
      ['core.brands.edit', 'Редагування'],
    ],
  },
  {
    key: 'admin',
    label: 'Адмін-панель',
    items: [
      ['admin.access', 'Доступ до адмін-панелі'],
      ['admin.audit.view', 'Перегляд журналу дій'],
    ],
  },
]

const CODE_LABEL: Record<string, string> = Object.fromEntries(
  GROUPS.flatMap((g) => g.items),
)

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
  usePageTitle(role && `Адмінка: роль ${role.name}`)
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
    const byCode = new Map(permissions.map((p) => [p.code, p]))
    const used = new Set<string>()
    const out: { key: string; label: string; items: Permission[] }[] = []
    for (const g of GROUPS) {
      const items = g.items.flatMap(([code]) => {
        const p = byCode.get(code)
        if (!p) return []
        used.add(code)
        return [p]
      })
      if (items.length) out.push({ key: g.key, label: g.label, items })
    }
    const rest = permissions.filter((p) => !used.has(p.code))
    if (rest.length) out.push({ key: 'other', label: 'Інше', items: rest })
    return out
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
        {groups.map(({ key, label, items }) => (
          <div key={key} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex items-center justify-between gap-3 bg-surface-2 px-4 py-2.5">
              <h3 className="font-medium">{label}</h3>
              <label className="flex items-center gap-2 text-sm text-muted">
                Всім:
                <ScopeSelect value="" disabled={readOnly} onChange={(v) => setGroup(items, v)} />
              </label>
            </div>
            {items.map((p) => {
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 border-t border-border px-4 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm" title={p.code}>
                      {CODE_LABEL[p.code] ?? 'Невідоме право'}
                    </p>
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