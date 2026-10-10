import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/services/api'
import Button from '@/components/Button'
import { Input, Select } from '@/components/Field'
import { StatusBadge } from '@/components/DataTable'
import { useCan } from '@/hooks/useCan'
import { getErrorMessage } from '@/utils/errors'

interface Item {
  id: string
  name: string
}

interface UserDetail {
  id: string
  login: string
  firstName: string
  lastName: string
  position: string | null
  status: string
  regionId: string | null
  cityId: string | null
  storeId: string | null
  roles: { roleId: string }[]
  managedRegions: { regionId: string }[]
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-border bg-surface p-4">
      <h3 className="font-medium">{title}</h3>
      {hint && <p className="mb-3 text-sm text-muted">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </section>
  )
}

function Pills({
  items,
  selected,
  onToggle,
  disabled,
}: {
  items: Item[]
  selected: string[]
  onToggle: (id: string) => void
  disabled?: boolean
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {items.map((i) => (
        <button
          type="button"
          key={i.id}
          disabled={disabled}
          onClick={() => onToggle(i.id)}
          className={`rounded-full border px-3 py-1 text-sm disabled:opacity-60 ${
            selected.includes(i.id)
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-border bg-surface-2'
          }`}
        >
          {i.name}
        </button>
      ))}
    </div>
  )
}

export default function UserEditPage() {
  const { id } = useParams()
  const can = useCan()

  const [user, setUser] = useState<UserDetail | null>(null)
  const [loadError, setLoadError] = useState('')
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const [allRoles, setAllRoles] = useState<Item[]>([])
  const [regions, setRegions] = useState<Item[]>([])
  const [cities, setCities] = useState<Item[]>([])
  const [stores, setStores] = useState<Item[]>([])

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    position: '',
    regionId: '',
    cityId: '',
    storeId: '',
  })
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [managed, setManaged] = useState<string[]>([])
  const [newLogin, setNewLogin] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  async function load() {
    try {
      const { data } = await api.get<UserDetail>(`/core/users/${id}`)
      setUser(data)
      setForm({
        firstName: data.firstName,
        lastName: data.lastName,
        position: data.position ?? '',
        regionId: data.regionId ?? '',
        cityId: data.cityId ?? '',
        storeId: data.storeId ?? '',
      })
      setRoleIds(data.roles.map((r) => r.roleId))
      setManaged(data.managedRegions.map((m) => m.regionId))
    } catch {
      setLoadError('Не вдалося завантажити користувача')
    }
  }

  useEffect(() => {
    load()
    api.get<Item[]>('/core/roles').then((r) => setAllRoles(r.data)).catch(() => {})
    api.get<Item[]>('/core/regions').then((r) => setRegions(r.data)).catch(() => {})
  }, [id])

  useEffect(() => {
    if (!form.regionId) {
      setCities([])
      return
    }
    api
      .get<Item[]>('/core/cities', { params: { regionId: form.regionId } })
      .then((r) => setCities(r.data))
      .catch(() => {})
  }, [form.regionId])

  useEffect(() => {
    if (!form.cityId) {
      setStores([])
      return
    }
    api
      .get<Item[]>('/core/stores', { params: { cityId: form.cityId } })
      .then((r) => setStores(r.data))
      .catch(() => {})
  }, [form.cityId])

  async function run(action: () => Promise<unknown>, okText: string) {
    setNotice(null)
    let ok = true
    try {
      await action()
      setNotice({ ok: true, text: okText })
      await load()
    } catch (err) {
      ok = false
      setNotice({ ok: false, text: getErrorMessage(err, 'Не вдалося виконати дію') })
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return ok
  }

  if (loadError) return <p className="text-danger">{loadError}</p>
  if (!user) return <p className="text-muted">Завантаження...</p>

  const canEdit = can('core.users.edit')
  const canRoles = can('core.users.manage_roles')

  const saveProfile = () =>
    run(
      () =>
        api.patch(`/core/users/${id}`, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          position: form.position.trim(),
          regionId: form.regionId || null,
          cityId: form.cityId || null,
          storeId: form.storeId || null,
        }),
      'Дані збережено',
    )

  const saveRoles = () => {
    if (roleIds.length === 0) {
      setNotice({ ok: false, text: 'Оберіть хоча б одну роль' })
      return
    }
    run(() => api.patch(`/core/users/${id}/roles`, { roleIds }), 'Ролі збережено')
  }

  const saveManaged = () =>
    run(
      () => api.patch(`/core/users/${id}/managed-regions`, { regionIds: managed }),
      'Області збережено',
    )

  const toggleStatus = () => {
    const deactivate = user.status === 'active'
    if (deactivate && !window.confirm('Деактивувати користувача? Він одразу втратить доступ.')) return
    run(
      () => api.patch(`/core/users/${id}/${deactivate ? 'deactivate' : 'activate'}`),
      deactivate ? 'Користувача деактивовано' : 'Користувача активовано',
    )
  }

  const changeLogin = async () => {
    if (newLogin.trim().length < 3) {
      setNotice({ ok: false, text: 'Логін має бути мінімум 3 символи' })
      return
    }
    const ok = await run(
      () => api.patch(`/core/users/${id}/login`, { newLogin: newLogin.trim() }),
      'Логін змінено',
    )
    if (ok) setNewLogin('')
  }

  const resetPassword = async () => {
    if (newPassword.length < 6) {
      setNotice({ ok: false, text: 'Пароль має бути мінімум 6 символів' })
      return
    }
    const ok = await run(
      () => api.patch(`/core/users/${id}/reset-password`, { newPassword }),
      'Пароль змінено',
    )
    if (ok) setNewPassword('')
  }

  return (
    <div className="max-w-3xl">
      <Link
        to="/admin/users"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft size={16} /> Користувачі
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">
          {user.firstName} {user.lastName}
        </h2>
        <StatusBadge status={user.status} />
        <span className="text-sm text-muted">{user.login}</span>
      </div>

      {notice && (
        <p
          className={`mb-4 rounded-xl px-3 py-2 text-sm ${
            notice.ok ? 'bg-success-soft text-success' : 'bg-surface-2 text-danger'
          }`}
        >
          {notice.text}
        </p>
      )}

      <Card title="Основні дані">
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <Input
            label="Ім'я"
            value={form.firstName}
            disabled={!canEdit}
            onChange={(e) => set({ firstName: e.target.value })}
          />
          <Input
            label="Прізвище"
            value={form.lastName}
            disabled={!canEdit}
            onChange={(e) => set({ lastName: e.target.value })}
          />
          <Input
            label="Посада"
            value={form.position}
            disabled={!canEdit}
            onChange={(e) => set({ position: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <Select
            label="Область"
            value={form.regionId}
            disabled={!canEdit}
            onChange={(e) => set({ regionId: e.target.value, cityId: '', storeId: '' })}
          >
            <option value="">— не вказано —</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Select
            label="Місто"
            value={form.cityId}
            disabled={!canEdit || !form.regionId}
            onChange={(e) => set({ cityId: e.target.value, storeId: '' })}
          >
            <option value="">— не вказано —</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            label="Магазин"
            value={form.storeId}
            disabled={!canEdit || !form.cityId}
            onChange={(e) => set({ storeId: e.target.value })}
          >
            <option value="">— не вказано —</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        {canEdit && <Button onClick={saveProfile}>Зберегти</Button>}
      </Card>

      <Card title="Ролі" hint="Можна обрати кілька. Права користувача складаються з усіх його ролей.">
        <Pills
          items={allRoles}
          selected={roleIds}
          disabled={!canRoles}
          onToggle={(rid) => setRoleIds((l) => toggle(l, rid))}
        />
        {canRoles && <Button onClick={saveRoles}>Зберегти ролі</Button>}
      </Card>

      <Card
        title="Області відповідальності"
        hint="Для регіонального менеджера: області, за які він відповідає. Для решти ролей нічого обирати не треба."
      >
        <Pills
          items={regions}
          selected={managed}
          disabled={!canRoles}
          onToggle={(rid) => setManaged((l) => toggle(l, rid))}
        />
        {canRoles && <Button onClick={saveManaged}>Зберегти області</Button>}
      </Card>

      <Card title="Доступ">
        {can('core.users.deactivate') && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {user.status === 'active'
                ? 'Користувач активний і може входити в систему.'
                : 'Користувач неактивний, вхід заборонений. Історія зберігається.'}
            </p>
            <Button variant="ghost" onClick={toggleStatus}>
              {user.status === 'active' ? 'Деактивувати' : 'Активувати'}
            </Button>
          </div>
        )}

        {can('core.users.change_login') && (
          <div className="mb-5">
            <Input
              label="Новий логін"
              value={newLogin}
              onChange={(e) => setNewLogin(e.target.value)}
            />
            <Button variant="ghost" onClick={changeLogin}>
              Змінити логін
            </Button>
          </div>
        )}

        {can('core.users.reset_password') && (
          <div>
            <Input
              label="Новий пароль"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button variant="ghost" onClick={resetPassword}>
              Змінити пароль
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}