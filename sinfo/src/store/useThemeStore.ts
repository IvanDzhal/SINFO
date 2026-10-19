import { create } from 'zustand'

type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  const saved = localStorage.getItem('sinfo_theme')
  if (saved === 'light' || saved === 'dark') return saved
  // за замовчуванням світла; темна лише після ручного перемикання
  return 'light'
}

function apply(theme: Theme, persist = true) {
  document.documentElement.dataset.theme = theme
  if (persist) localStorage.setItem('sinfo_theme', theme)
}

const initial = initialTheme()
apply(initial, false)

export const useThemeStore = create<{ theme: Theme; toggle: () => void }>((set, get) => ({
  theme: initial,
  toggle: () => {
    const next = get().theme === 'light' ? 'dark' : 'light'
    apply(next)
    set({ theme: next })
  },
}))