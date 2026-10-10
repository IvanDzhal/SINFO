import { useEffect, useState } from 'react'
import axios from 'axios'
import { api } from '@/services/api'
import Modal from './Modal'
import Button from './Button'
import { Input, Select } from './Field'

export interface FieldDef {
  name: string
  label: string
  kind?: 'text' | 'select'
  required?: boolean
  optionsUrl?: string
  dependsOn?: { field: string; param: string }
}

interface Option {
  id: string
  name: string
}

interface Props {
  title: string
  endpoint: string
  fields: FieldDef[]
  onClose: () => void
  onCreated: () => void
}

export default function CreateModal({ title, endpoint, fields, onClose, onCreated }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, ''])),
  )
  const [options, setOptions] = useState<Record<string, Option[]>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function loadOptions(f: FieldDef, parentValue?: string) {
    if (!f.optionsUrl) return
    if (f.dependsOn && !parentValue) {
      setOptions((o) => ({ ...o, [f.name]: [] }))
      return
    }
    api
      .get(f.optionsUrl, {
        params: f.dependsOn ? { [f.dependsOn.param]: parentValue } : undefined,
      })
      .then((r) => setOptions((o) => ({ ...o, [f.name]: r.data })))
  }

  useEffect(() => {
    fields.forEach((f) => {
      if (f.kind === 'select' && !f.dependsOn) loadOptions(f)
    })
  }, [])

  function change(name: string, value: string) {
    setValues((v) => {
      const next = { ...v, [name]: value }
      fields.forEach((f) => {
        if (f.dependsOn?.field === name) next[f.name] = ''
      })
      return next
    })
    fields.forEach((f) => {
      if (f.dependsOn?.field === name) loadOptions(f, value)
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ''))
      await api.post(endpoint, payload)
      onCreated()
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : null
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Не вдалося створити'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        {fields.map((f) =>
          f.kind === 'select' ? (
            <Select
              key={f.name}
              label={f.label}
              value={values[f.name]}
              required={f.required}
              disabled={!!f.dependsOn && !values[f.dependsOn.field]}
              onChange={(e) => change(f.name, e.target.value)}
            >
              <option value="">— оберіть —</option>
              {(options[f.name] ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              key={f.name}
              label={f.label}
              value={values[f.name]}
              required={f.required}
              onChange={(e) => change(f.name, e.target.value)}
            />
          ),
        )}

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