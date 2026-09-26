import { Outlet } from 'react-router-dom'

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 px-6 py-4">
        <h1 className="text-lg font-semibold">SINFO 2.0</h1>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
