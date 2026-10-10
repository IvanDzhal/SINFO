import { useState } from 'react'
import { Plus } from 'lucide-react'
import DataTable, { StatusBadge } from '@/components/DataTable'
import Button from '@/components/Button'
import CreateModal from '@/components/CreateModal'
import { useFetch } from '@/hooks/useFetch'

interface Brand {
  id: string
  name: string
  status: string
}

export default function BrandsPage() {
  const { data, loading, error, reload } = useFetch<Brand>('/core/brands')
  const [creating, setCreating] = useState(false)

  return (
    <>
      <DataTable
        title="Бренди та формати"
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
          { header: 'Статус', render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
      {creating && (
        <CreateModal
          title="Новий бренд / формат"
          endpoint="/core/brands"
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