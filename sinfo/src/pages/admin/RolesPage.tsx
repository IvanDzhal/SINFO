import DataTable from '@/components/DataTable'
import { useFetch } from '@/hooks/useFetch'

interface Role {
  id: string
  name: string
  isSystem: boolean
  _count: { users: number }
}

export default function RolesPage() {
  const { data, loading, error } = useFetch<Role>('/core/roles')
  return (
    <DataTable
      title="Ролі"
      rows={data}
      loading={loading}
      error={error}
      columns={[
        { header: 'Назва', render: (r) => r.name },
        { header: 'Користувачів', render: (r) => r._count.users },
        { header: 'Тип', render: (r) => (r.isSystem ? 'Системна' : 'Власна') },
      ]}
    />
  )
}