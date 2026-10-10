import { useState } from 'react'
import { useCan } from '@/hooks/useCan'
import EditModal from './EditModal'
import type { FieldDef } from './CreateModal'

interface Props {
  title: string
  endpoint: string
  perm: string
  fields: FieldDef[]
  initial: Record<string, string>
  onSaved: () => void
}

export default function EditButton({ title, endpoint, perm, fields, initial, onSaved }: Props) {
  const can = useCan()
  const [open, setOpen] = useState(false)
  if (!can(perm)) return null

  return (
    <>
      <button className="text-sm text-accent hover:underline" onClick={() => setOpen(true)}>
        Редагувати
      </button>
      {open && (
        <EditModal
          title={title}
          endpoint={endpoint}
          fields={fields}
          initial={initial}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false)
            onSaved()
          }}
        />
      )}
    </>
  )
}