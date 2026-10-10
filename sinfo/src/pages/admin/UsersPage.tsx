import { useState } from 'react'
import { Plus } from 'lucide-react'
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

export default function UsersPage() {
  const { data, loading, error, reload } = useFetch<UserRow>('/core/users')
  const [creating, setCreating] = useState(false)

  return (
    <>
      <DataTable
        title="Користувачі"
        rows={data}
        loading={loading}
        error={error}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Створити
          </Button>
        }
        columns={[
          { header: "Ім'я", render: (u) => `${u.firstName} ${u.lastName}` },
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