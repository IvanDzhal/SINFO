import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminLayout from '@/layouts/AdminLayout'
import UserLayout from '@/layouts/UserLayout'
import LoginPage from '@/pages/LoginPage'
import HomePage from '@/pages/HomePage'
import PlaceholderPage from '@/pages/PlaceholderPage'
import DashboardPage from '@/pages/admin/DashboardPage'
import UsersPage from '@/pages/admin/UsersPage'
import UserEditPage from '@/pages/admin/UserEditPage'
import RegionsPage from '@/pages/admin/RegionsPage'
import CitiesPage from '@/pages/admin/CitiesPage'
import StoresPage from '@/pages/admin/StoresPage'
import BrandsPage from '@/pages/admin/BrandsPage'
import RolesPage from '@/pages/admin/RolesPage'
import RoleEditPage from '@/pages/admin/RoleEditPage'
import AuditLogPage from '@/pages/admin/AuditLogPage'
import CategoriesPage from '@/pages/admin/CategoriesPage'
import KnowledgeListPage from '@/pages/KnowledgeListPage'
import KnowledgeArticlePage from '@/pages/KnowledgeArticlePage'

const stubs = [
  { path: 'about', title: 'Про компанію' },
  { path: 'training', title: 'Навчання' },
  { path: 'testing', title: 'Тестування' },
  { path: 'analytics', title: 'Аналітика' },
  { path: 'extra-sales', title: 'Додаткові продажі' },
  { path: 'profile', title: 'Профіль' },
]

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<UserLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="instructions" element={<KnowledgeListPage key="instruction" type="instruction" />} />
            <Route path="materials" element={<KnowledgeListPage key="material" type="material" />} />
            <Route path="knowledge/:id" element={<KnowledgeArticlePage />} />
            {stubs.map((s) => (
              <Route key={s.path} path={s.path} element={<PlaceholderPage title={s.title} />} />
            ))}
          </Route>

          <Route element={<ProtectedRoute permission="admin.access" />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="users/:id" element={<UserEditPage />} />
              <Route path="regions" element={<RegionsPage />} />
              <Route path="cities" element={<CitiesPage />} />
              <Route path="stores" element={<StoresPage />} />
              <Route path="brands" element={<BrandsPage />} />
              <Route path="roles" element={<RolesPage />} />
              <Route path="roles/:id" element={<RoleEditPage />} />
              <Route path="audit-log" element={<AuditLogPage />} />
              <Route path="knowledge/categories" element={<CategoriesPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App