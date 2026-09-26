import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import HomePage from '@/pages/HomePage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
