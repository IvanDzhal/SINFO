import { useEffect } from 'react'
import { APP_NAME } from '@/utils/pageTitle'

/** Підставляє в заголовок вкладки реальну назву сутності (стаття, тест, профіль...), коли вона завантажилась. */
export function usePageTitle(name?: string | null) {
  useEffect(() => {
    if (name) document.title = `${APP_NAME} - ${name}`
  }, [name])
}
