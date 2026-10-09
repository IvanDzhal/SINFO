import DataTable, { StatusBadge } from '@/components/DataTable'
import { useFetch } from '@/hooks/useFetch'

interface City {
  id: string
  name: string
  status: string
  region: { name: string }
  _count: { stores: number }
}

export default function CitiesPage() {
  const { data, loading, error } = useFetch<City>('/core/cities')
  return (
    <DataTable
      title="Міста"
      rows={data}
      loading={loading}
      error={error}
      columns={[
        { header: 'Назва', render: (r) => r.name },
        { header: 'Область', render: (r) => r.region.name },
        { header: 'Магазинів', render: (r) => r._count.stores },
        { header: 'Статус', render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  )
}