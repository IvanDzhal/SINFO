import { useEffect, useState } from 'react'
import axios from 'axios'
import { api } from '@/services/api'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import { Input, Select } from '@/components/Field'

interface Item {
  id: string
  name: string
}

interface Props {
  onClose: () => void
  onCreated: () => void
}

export default function CreateUserModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    login: '',
    password: '',
    regionId: '',
    cityId: '',
    storeId: '',
  })
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [roles, setRoles] = useState<Item[]>([])
  const [regions, setRegions] = useState<Item[]>([])
  const [cities, setCities] = useState<Item[]>([])
  const [stores, setStores] = useState<Item[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/core/roles').then((r) => setRoles(r.data))
    api.get('/core/regions').then((r) => setRegions(r.data))
  }, [])

  useEffect(() => {
    setCities([])
    if (form.regionId)
      api
        .get('/core/cities', { params: { regionId: form.regionId } })
        .then((r) => setCities(r.data))
  }, [form.regionId])

  useEffect(() => {
    setStores([])
    if (form.cityId)
      api
        .get('/core/stores', { params: { cityId: form.cityId } })
        .then((r) => setStores(r.data))
  }, [form.cityId])

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  function toggleRole(id: string) {
    setRoleIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (roleIds.length === 0) {
      setError('Оберіть хоча б одну роль')
      return
    }
    setSaving(true)
    try {
      await api.post('/core/users', {
        ...form,
        roleIds,
        regionId: form.regionId || undefined,
        cityId: form.cityId || undefined,
        storeId: form.storeId || undefined,
      })
      onCreated()
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : null
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Не вдалося створити користувача'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Новий користувач" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <Input
            label="Ім'я"
            value={form.firstName}
            onChange={(e) => set({ firstName: e.target.value })}
            required
          />
          <Input
            label="Прізвище"
            value={form.lastName}
            onChange={(e) => set({ lastName: e.target.value })}
            required
          />
          <Input
            label="Логін"
            value={form.login}
            onChange={(e) => set({ login: e.target.value })}
            required
          />
          <Input
            label="Пароль"
            type="password"
            value={form.password}
            onChange={(e) => set({ password: e.target.value })}
            required
          />
        </div>

        <p className="mb-1 text-sm font-medium">Ролі</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {roles.map((r) => (
            <label
              key={r.id}
              className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${
                roleIds.includes(r.id)
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border bg-surface-2'
              }`}
            >
              <input
                type="checkbox"
                className="hidden"
                checked={roleIds.includes(r.id)}
                onChange={() => toggleRole(r.id)}
              />
              {r.name}
            </label>
          ))}
        </div>

        <Select
          label="Область"
          value={form.regionId}
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
          disabled={!form.regionId}
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
          disabled={!form.cityId}
          onChange={(e) => set({ storeId: e.target.value })}
        >
          <option value="">— не вказано —</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Скасувати
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Збереження...' : 'Створити'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}