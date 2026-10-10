import { create } from 'zustand'

export interface AuthUser {
  id: string
  login: string
  firstName: string
  lastName: string
  status: string
  permissions: string[]
  roles: { role: { id: string; name: string } }[]
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  setSession: (user: AuthUser, accessToken: string, refreshToken: string) => void
  setAccessToken: (token: string) => void
  logout: () => void
}

const stored = localStorage.getItem('sinfo_refresh')

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: stored,
  setSession: (user, accessToken, refreshToken) => {
    localStorage.setItem('sinfo_refresh', refreshToken)
    set({ user, accessToken, refreshToken })
  },
  setAccessToken: (accessToken) => set({ accessToken }),
  logout: () => {
    localStorage.removeItem('sinfo_refresh')
    set({ user: null, accessToken: null, refreshToken: null })
  },
}))