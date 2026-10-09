import DataTable, { StatusBadge } from '@/components/DataTable'
import { useFetch } from '@/hooks/useFetch'

interface Region {
  id: string
  name: string
  status: string
  _count: { cities: number; stores: number }
}

export default function RegionsPage() {
  const { data, loading, error } = useFetch<Region>('/core/regions')
  return (
    <DataTable
      title="Області"
      rows={data}
      loading={loading}
      error={error}
      columns={[
        { header: 'Назва', render: (r) => r.name },
        { header: 'Міст', render: (r) => r._count.cities },
        { header: 'Магазинів', render: (r) => r._count.stores },
        { header: 'Статус', render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  )
}