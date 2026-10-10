import { useState } from 'react'
import { Plus } from 'lucide-react'
import DataTable, { StatusBadge } from '@/components/DataTable'
import Button from '@/components/Button'
import CreateModal from '@/components/CreateModal'
import { useFetch } from '@/hooks/useFetch'

interface City {
  id: string
  name: string
  status: string
  region: { name: string }
  _count: { stores: number }
}

export default function CitiesPage() {
  const { data, loading, error, reload } = useFetch<City>('/core/cities')
  const [creating, setCreating] = useState(false)

  return (
    <>
      <DataTable
        title="Міста"
        actionPerm="core.cities.create"
        rows={data}
        loading={loading}
        error={error}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Створити
          </Button>
        }
        columns={[
          { header: 'Назва', render: (r) => r.name },
          { header: 'Область', render: (r) => r.region.name },
          { header: 'Магазинів', render: (r) => r._count.stores },
          { header: 'Статус', render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
      {creating && (
        <CreateModal
          title="Нове місто"
          endpoint="/core/cities"
          fields={[
            { name: 'name', label: 'Назва', required: true },
            {
              name: 'regionId',
              label: 'Область',
              kind: 'select',
              required: true,
              optionsUrl: '/core/regions',
            },
          ]}
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