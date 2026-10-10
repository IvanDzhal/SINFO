import DataTable from '@/components/DataTable'
import { useFetch } from '@/hooks/useFetch'
import { actionLabel } from '@/utils/auditLabels'

interface AuditRow {
  id: string
  action: string
  entityType: string
  createdAt: string
  actor: { login: string; firstName: string; lastName: string } | null
}

export default function AuditLogPage() {
  const { data, loading, error } = useFetch<AuditRow>('/admin/audit-log')
  return (
    <DataTable
      title="Журнал дій"
      rows={data}
      loading={loading}
      error={error}
      columns={[
        { header: 'Час', render: (r) => new Date(r.createdAt).toLocaleString('uk-UA') },
        {
          header: 'Хто',
          render: (r) => (r.actor ? `${r.actor.firstName} ${r.actor.lastName}` : 'Система'),
        },
        { header: 'Дія', render: (r) => actionLabel(r.action) },
        { header: 'Об\'єкт', render: (r) => r.entityType },
      ]}
    />
  )
}