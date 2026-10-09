import { create } from 'zustand'

type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  const saved = localStorage.getItem('sinfo_theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem('sinfo_theme', theme)
}

const initial = initialTheme()
apply(initial)

export const useThemeStore = create<{ theme: Theme; toggle: () => void }>((set, get) => ({
  theme: initial,
  toggle: () => {
    const next = get().theme === 'light' ? 'dark' : 'light'
    apply(next)
    set({ theme: next })
  },
}))