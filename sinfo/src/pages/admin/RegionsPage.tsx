import { useState } from 'react'
import { Plus } from 'lucide-react'
import DataTable, { StatusBadge } from '@/components/DataTable'
import Button from '@/components/Button'
import CreateModal from '@/components/CreateModal'
import { useFetch } from '@/hooks/useFetch'

interface Region {
  id: string
  name: string
  status: string
  _count: { cities: number; stores: number }
}

export default function RegionsPage() {
  const { data, loading, error, reload } = useFetch<Region>('/core/regions')
  const [creating, setCreating] = useState(false)

  return (
    <>
      <DataTable
        title="Області"
        actionPerm="core.regions.create"
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
          { header: 'Міст', render: (r) => r._count.cities },
          { header: 'Магазинів', render: (r) => r._count.stores },
          { header: 'Статус', render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
      {creating && (
        <CreateModal
          title="Нова область"
          endpoint="/core/regions"
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