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
import BrandsPage from '@/pages/admin/BrandsPage'
import RoleEditPage from '@/pages/admin/RoleEditPage'
import HomePage from '@/pages/HomePage'
import UserEditPage from '@/pages/admin/UserEditPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<HomePage />} />
          <Route element={<ProtectedRoute permission="admin.access" />}></Route>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="users/:id" element={<UserEditPage />} />
              <Route path="regions" element={<RegionsPage />} />
              <Route path="cities" element={<CitiesPage />} />
              <Route path="stores" element={<StoresPage />} />
              <Route path="roles" element={<RolesPage />} />
              <Route path="roles/:id" element={<RoleEditPage />} />
              <Route path="audit-log" element={<AuditLogPage />} />
              <Route path="brands" element={<BrandsPage />} />
            </Route>
          </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App