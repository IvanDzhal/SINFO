import { useEffect, useState } from 'react'
import { api } from '@/services/api'
import Modal from './Modal'
import Button from './Button'
import { Input, Select } from './Field'
import type { FieldDef } from './CreateModal'
import { getErrorMessage } from '@/utils/errors'

interface Option {
  id: string
  name: string
}

interface Props {
  title: string
  endpoint: string
  fields: FieldDef[]
  initial: Record<string, string>
  onClose: () => void
  onSaved: () => void
}

export default function EditModal({ title, endpoint, fields, initial, onClose, onSaved }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? ''])),
    status: initial.status ?? 'active',
  }))
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
      if (f.kind !== 'select') return
      loadOptions(f, f.dependsOn ? initial[f.dependsOn.field] : undefined)
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
      const payload: Record<string, string> = { status: values.status }
      fields.forEach((f) => {
        const v = values[f.name] ?? ''
        if (f.kind === 'select') {
          if (v) payload[f.name] = v
        } else {
          payload[f.name] = v.trim()
        }
      })
      await api.patch(endpoint, payload)
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err, 'Не вдалося зберегти'))
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

        <Select
          label="Статус"
          value={values.status}
          onChange={(e) => change('status', e.target.value)}
        >
          <option value="active">Активний</option>
          <option value="inactive">Неактивний</option>
        </Select>

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Скасувати
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Збереження...' : 'Зберегти'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}