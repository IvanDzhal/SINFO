import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { titleFor } from '@/utils/pageTitle'

/** Виставляє document.title за поточним маршрутом. Рендериться всередині BrowserRouter. */
export default function RouteTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = titleFor(pathname)
  }, [pathname])
  return null
}
