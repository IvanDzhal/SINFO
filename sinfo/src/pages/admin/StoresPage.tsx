import DataTable, { StatusBadge } from '@/components/DataTable'
import { useFetch } from '@/hooks/useFetch'

interface Store {
  id: string
  name: string
  address: string | null
  status: string
  region: { name: string }
  city: { name: string }
  brandFormat: { name: string }
}

export default function StoresPage() {
  const { data, loading, error } = useFetch<Store>('/core/stores')
  return (
    <DataTable
      title="Магазини"
      rows={data}
      loading={loading}
      error={error}
      columns={[
        { header: 'Назва', render: (r) => r.name },
        { header: 'Бренд', render: (r) => r.brandFormat.name },
        { header: 'Область', render: (r) => r.region.name },
        { header: 'Місто', render: (r) => r.city.name },
        { header: 'Адреса', render: (r) => r.address ?? '—' },
        { header: 'Статус', render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  )
}