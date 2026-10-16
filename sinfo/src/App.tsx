import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '@/components/ProtectedRoute'
import RouteTitle from '@/components/RouteTitle'
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
import DataSyncPage from '@/pages/admin/DataSyncPage'
import DataSourcePage from '@/pages/admin/DataSourcePage'
import KnowledgeListPage from '@/pages/KnowledgeListPage'
import KnowledgeArticlePage from '@/pages/KnowledgeArticlePage'
import KnowledgeEditPage from '@/pages/KnowledgeEditPage'
import TestingPage from '@/pages/TestingPage'
import TestDetailPage from '@/pages/TestDetailPage'
import TestAttemptPage from '@/pages/TestAttemptPage'
import TestAnalyticsPage from '@/pages/TestAnalyticsPage'
import AnalyticsPage from '@/pages/AnalyticsPage'
import TrainingPage from '@/pages/TrainingPage'
import TrainingLessonPage from '@/pages/TrainingLessonPage'
import TrainingManagePage from '@/pages/TrainingManagePage'
import AboutPage from '@/pages/AboutPage'
import ProfilePage from '@/pages/ProfilePage'
import ProfileSettingsPage from '@/pages/ProfileSettingsPage'

const stubs: { path: string; title: string }[] = []

function App() {
  return (
    <BrowserRouter>
      <RouteTitle />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<UserLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="instructions" element={<KnowledgeListPage key="instruction" type="instruction" />} />
            <Route path="testing" element={<TestingPage />} />
            <Route path="testing/:id" element={<TestDetailPage />} />
            <Route path="testing/attempt/:attemptId" element={<TestAttemptPage />} />
            <Route path="testing/analytics" element={<TestAnalyticsPage />} />
            <Route path="training" element={<TrainingPage />} />
            <Route path="training/lesson/:id" element={<TrainingLessonPage />} />
            <Route path="training/manage" element={<TrainingManagePage />} />
            <Route path="news" element={<KnowledgeListPage key="news" type="news" />} />
            <Route path="materials" element={<KnowledgeListPage key="material" type="material" />} />
            <Route path="knowledge/:id" element={<KnowledgeArticlePage />} />
            <Route path="knowledge/new" element={<KnowledgeEditPage />} />
            <Route path="knowledge/:id/edit" element={<KnowledgeEditPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="profile/settings" element={<ProfileSettingsPage />} />
            <Route path="profile/:id" element={<ProfilePage />} />
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
              <Route path="data-sync" element={<DataSyncPage />} />
              <Route path="data-sync/:id" element={<DataSourcePage />} />
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