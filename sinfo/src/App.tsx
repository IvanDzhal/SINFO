import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminLayout from '@/layouts/AdminLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/admin/DashboardPage'
import UsersPage from '@/pages/admin/UsersPage'
import RegionsPage from '@/pages/admin/RegionsPage'
import CitiesPage from '@/pages/admin/CitiesPage'
import StoresPage from '@/pages/admin/StoresPage'
import RolesPage from '@/pages/admin/RolesPage'
import AuditLogPage from '@/pages/admin/AuditLogPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="regions" element={<RegionsPage />} />
            <Route path="cities" element={<CitiesPage />} />
            <Route path="stores" element={<StoresPage />} />
            <Route path="roles" element={<RolesPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App