import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import clsx from 'clsx'
import { api } from '@/services/api'
import { useFetch } from '@/hooks/useFetch'
import { useCan } from '@/hooks/useCan'
import { Card, Chip, Table, Tabs, qs, type Col } from '@/components/analytics/ui'
import SalesSection from '@/components/analytics/SalesSection'

type Tab = 'regions' | 'stores' | 'sellers' | 'materials'

interface Stats {
  total: number
  viewed: number
  unviewedCount: number
  percent: number | null
  requiredTotal: number
  requiredViewed: number
  requiredPercent: number | null
}
interface Overview extends Stats {
  sellers: number
  completed: number
  withoutMaterials: number
}
interface GroupRow extends Stats {
  id: string | null
  name: string
  sellers: number
  city?: string | null
  region?: string | null
}
interface SellerRow extends Stats {
  id: string
  name: string
  login: string
  store: string | null
  region: string | null
  lastActivityAt: string | null
}
interface MaterialRow {
  id: string
  slug: string | null
  title: string
  isRequired: boolean
  audience: number
  viewed: number
  notViewed: number
  percent: number | null
}
interface Unviewed {
  seller: SellerRow
  unviewed: { id: string; slug: string | null; title: string; isRequired: boolean }[]
}

const WARN_BELOW = 50

const pct = (v: number | null) => (v === null ? '—' : `${v}%`)
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

function Progress({ viewed, total, percent }: { viewed: number; total: number; percent: number | null }) {
  if (percent === null) return <span className="text-muted">Немає матеріалів</span>
  return (
    <div className="min-w-[140px]">
      <div className="mb-1 flex justify-between text-xs">
        <span className={clsx(percent < WARN_BELOW && 'text-danger')}>{percent}%</span>
        <span className="text-muted">
          {viewed} / {total}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={clsx('h-full rounded-full', percent < WARN_BELOW ? 'bg-danger' : 'bg-accent')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function OverviewCards({ query }: { query: string }) {
  const [o, setO] = useState<Overview | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setO(null)
    setFailed(false)
    api
      .get<Overview>(`/analytics/content/overview${query}`)
      .then((r) => setO(r.data))
      .catch(() => setFailed(true))
  }, [query])

  if (failed) return <p className="mb-6 text-danger">Не вдалося завантажити дані</p>
  if (!o) return <p className="mb-6 text-muted">Завантаження...</p>

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Прогрес" value={pct(o.percent)} hint={`${o.viewed} з ${o.total} переглядів`} />
        <Card
          label="Обов’язкові"
          value={pct(o.requiredPercent)}
          hint={`${o.requiredViewed} з ${o.requiredTotal}`}
        />
        <Card label="Продавців" value={String(o.sellers)} hint={`опрацювали все: ${o.completed}`} />
        <Card label="Не переглянуто" value={String(o.unviewedCount)} />
      </div>
      {o.withoutMaterials > 0 && (
        <p className="mt-2 text-xs text-muted">
          Без жодного релевантного матеріалу: {o.withoutMaterials} (у прогрес не впливають)
        </p>
      )}
    </div>
  )
}

function UnviewedPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [data, setData] = useState<Unviewed | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setData(null)
    setFailed(false)
    api
      .get<Unviewed>(`/analytics/content/sellers/${userId}/unviewed`)
      .then((r) => setData(r.data))
      .catch(() => setFailed(true))
  }, [userId])

  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{data?.seller.name ?? 'Завантаження...'}</p>
          {data && (
            <p className="text-xs text-muted">
              {[data.seller.store, data.seller.region].filter(Boolean).join(' · ')} · Не переглянуто:{' '}
              {data.unviewed.length}
            </p>
          )}
        </div>
        <button onClick={onClose} aria-label="Закрити" className="text-muted hover:text-ink">
          <X size={18} />
        </button>
      </div>
      {failed && <p className="text-danger">Не вдалося завантажити дані</p>}
      {data && data.unviewed.length === 0 && (
        <p className="text-sm text-muted">Усі матеріали переглянуто.</p>
      )}
      {data && data.unviewed.length > 0 && (
        <ul className="space-y-1 text-sm">
          {data.unviewed.map((m) => (
            <li key={m.id}>
              <Link to={`/knowledge/${m.slug ?? m.id}`} className="text-accent hover:underline">
                {m.title}
              </Link>
              {m.isRequired && <span className="ml-2 text-xs text-danger">обов’язкова</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SellersTab({ regionId, storeId }: { regionId?: string; storeId?: string }) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const sellers = useFetch<SellerRow>(
    `/analytics/content/sellers${qs({ regionId, storeId, search: debounced })}`,
  )

  return (
    <>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Пошук за ім’ям або логіном"
        className="mb-3 w-full max-w-sm rounded-xl border border-border bg-surface px-3 py-2 text-sm"
      />
      {userId && <UnviewedPanel userId={userId} onClose={() => setUserId(null)} />}
      <Table
        rows={sellers.data}
        loading={sellers.loading}
        error={sellers.error}
        rowKey={(r) => r.id}
        onRow={(r) => setUserId(r.id)}
        columns={[
          {
            header: 'Продавець',
            cell: (r) => (
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted">{r.login}</p>
              </div>
            ),
          },
          {
            header: 'Магазин',
            cell: (r) => (
              <div>
                <p>{r.store ?? '—'}</p>
                <p className="text-xs text-muted">{r.region ?? ''}</p>
              </div>
            ),
          },
          {
            header: 'Прогрес',
            cell: (r) => <Progress viewed={r.viewed} total={r.total} percent={r.percent} />,
          },
          { header: 'Не переглянуто', cell: (r) => r.unviewedCount },
          { header: 'Остання активність', cell: (r) => fmtDate(r.lastActivityAt) },
        ]}
      />
    </>
  )
}

function ContentSection() {
  const can = useCan()
  const canSellers = can('analytics.content.view_employee')

  const [tab, setTab] = useState<Tab>('regions')
  const [region, setRegion] = useState<{ id: string; name: string } | null>(null)
  const [store, setStore] = useState<{ id: string; name: string } | null>(null)
  const base = qs({ regionId: region?.id, storeId: store?.id })
  const regions = useFetch<GroupRow>(`/analytics/content/regions${qs({ regionId: region?.id })}`)
  const stores = useFetch<GroupRow>(
    `/analytics/content/stores${qs({ regionId: region?.id, storeId: store?.id })}`,
  )
  const materials = useFetch<MaterialRow>(`/analytics/content/materials${base}`)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'regions', label: 'Області' },
    { key: 'stores', label: 'Магазини' },
    ...(canSellers ? [{ key: 'sellers' as Tab, label: 'Продавці' }] : []),
    { key: 'materials', label: 'Матеріали' },
  ]

  const groupCols = (withPlace: boolean): Col<GroupRow>[] => [
    {
      header: withPlace ? 'Магазин' : 'Область',
      cell: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          {withPlace && (
            <p className="text-xs text-muted">{[r.city, r.region].filter(Boolean).join(' · ')}</p>
          )}
        </div>
      ),
    },
    { header: 'Продавців', cell: (r) => r.sellers },
    {
      header: 'Прогрес',
      cell: (r) => <Progress viewed={r.viewed} total={r.total} percent={r.percent} />,
    },
    {
      header: 'Обов’язкові',
      cell: (r) =>
        r.requiredPercent === null ? '—' : `${r.requiredPercent}% (${r.requiredViewed}/${r.requiredTotal})`,
    },
    { header: 'Не переглянуто', cell: (r) => r.unviewedCount },
  ]

  return (
    <div>
      <p className="mb-4 text-sm text-muted">
        Перегляд інструкцій продавцями у межах вашого доступу. Матеріал вважається переглянутим після
        10 секунд на сторінці.
      </p>

      {(region || store) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {region && <Chip label={`Область: ${region.name}`} onClear={() => setRegion(null)} />}
          {store && <Chip label={`Магазин: ${store.name}`} onClear={() => setStore(null)} />}
        </div>
      )}

      <OverviewCards query={base} />

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'regions' && (
        <Table
          rows={regions.data}
          loading={regions.loading}
          error={regions.error}
          rowKey={(r) => r.id ?? r.name}
          onRow={(r) => {
            if (!r.id) return
            setRegion({ id: r.id, name: r.name })
            setStore(null)
            setTab('stores')
          }}
          columns={groupCols(false)}
        />
      )}

      {tab === 'stores' && (
        <Table
          rows={stores.data}
          loading={stores.loading}
          error={stores.error}
          rowKey={(r) => r.id ?? r.name}
          onRow={(r) => {
            if (!r.id) return
            setStore({ id: r.id, name: r.name })
            setTab(canSellers ? 'sellers' : 'materials')
          }}
          columns={groupCols(true)}
        />
      )}

      {tab === 'sellers' && canSellers && <SellersTab regionId={region?.id} storeId={store?.id} />}

      {tab === 'materials' && (
        <Table
          rows={materials.data}
          loading={materials.loading}
          error={materials.error}
          rowKey={(r) => r.id}
          columns={[
            {
              header: 'Матеріал',
              cell: (r) => (
                <div>
                  <Link to={`/knowledge/${r.slug ?? r.id}`} className="font-medium text-accent hover:underline">
                    {r.title}
                  </Link>
                  {r.isRequired && <span className="ml-2 text-xs text-danger">обов’язкова</span>}
                </div>
              ),
            },
            { header: 'Аудиторія', cell: (r) => r.audience },
            {
              header: 'Переглянули',
              cell: (r) => <Progress viewed={r.viewed} total={r.audience} percent={r.percent} />,
            },
            { header: 'Не переглянули', cell: (r) => r.notViewed },
          ]}
        />
      )}
    </div>
  )
}

type Section = 'sales' | 'content'

export default function AnalyticsPage() {
  const can = useCan()
  const canSales = can('analytics.sales.view')
  const canContent = can('analytics.content.view')
  const [section, setSection] = useState<Section>(canSales ? 'sales' : 'content')

  if (!canSales && !canContent) {
    return (
      <div>
        <h2 className="mb-2 text-xl font-semibold">Аналітика</h2>
        <p className="text-muted">
          Немає доступу до аналітики.{' '}
          {can('testing.view_analytics') && (
            <Link to="/testing/analytics" className="text-accent hover:underline">
              Аналітика тестів
            </Link>
          )}
        </p>
      </div>
    )
  }

  const sections: { key: Section; label: string }[] = [
    ...(canSales ? [{ key: 'sales' as Section, label: 'Продажі' }] : []),
    ...(canContent ? [{ key: 'content' as Section, label: 'Контент' }] : []),
  ]

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Аналітика</h2>
        {can('testing.view_analytics') && (
          <Link to="/testing/analytics" className="text-sm text-accent hover:underline">
            Аналітика тестів →
          </Link>
        )}
      </div>
      {sections.length > 1 && <Tabs tabs={sections} value={section} onChange={setSection} />}
      {section === 'sales' && canSales && <SalesSection />}
      {section === 'content' && canContent && <ContentSection />}
    </div>
  )
}
