import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import DataTable from '@/components/DataTable'
import Button from '@/components/Button'
import CreateModal from '@/components/CreateModal'
import { useFetch } from '@/hooks/useFetch'
import { api } from '@/services/api'
import { getErrorMessage } from '@/utils/errors'
import { useCan } from '@/hooks/useCan'

interface Role {
  id: string
  name: string
  isSystem: boolean
  _count: { users: number }
}

export default function RolesPage() {
  const { data, loading, error, reload } = useFetch<Role>('/core/roles')
  const [creating, setCreating] = useState(false)
  const can = useCan()

  async function copyRole(role: Role) {
    const name = window.prompt('Назва нової ролі', `${role.name} (копія)`)
    if (!name?.trim()) return
    try {
      await api.post(`/core/roles/${role.id}/copy`, { name: name.trim() })
      reload()
    } catch (err) {
      window.alert(getErrorMessage(err, 'Не вдалося скопіювати роль'))
    }
  }

  async function archiveRole(role: Role) {
    const warn =
      role._count.users > 0
        ? ` У неї ${role._count.users} користувачів, вони втратять права цієї ролі.`
        : ''
    if (!window.confirm(`Архівувати роль «${role.name}»?${warn}`)) return
    try {
      await api.delete(`/core/roles/${role.id}`)
      reload()
    } catch (err) {
      window.alert(getErrorMessage(err, 'Не вдалося архівувати роль'))
    }
  }

  return (
    <>
      <DataTable
        title="Ролі"
        actionPerm="core.roles.create"
        rows={data}
        loading={loading}
        error={error}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Створити
          </Button>
        }
        columns={[
          {
            header: 'Назва',
            render: (r) => (
              <Link to={`/admin/roles/${r.id}`} className="font-medium text-accent hover:underline">
                {r.name}
              </Link>
            ),
          },
          { header: 'Користувачів', render: (r) => r._count.users },
          { header: 'Тип', render: (r) => (r.isSystem ? 'Системна' : 'Власна') },
          {
            header: 'Дії',
            render: (r) => (
              <div className="flex gap-4 text-sm">
                {can('core.roles.create') && (
                  <button className="text-accent hover:underline" onClick={() => copyRole(r)}>
                    Копіювати
                  </button>
                )}
                {!r.isSystem && can('core.roles.archive') && (
                  <button className="text-danger hover:underline" onClick={() => archiveRole(r)}>
                    Архівувати
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />
      {creating && (
        <CreateModal
          title="Нова роль"
          endpoint="/core/roles"
          fields={[{ name: 'name', label: 'Назва', required: true }]}
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