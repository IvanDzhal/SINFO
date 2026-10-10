import { useAuthStore } from '@/store/useAuthStore'

export function useCan() {
  const permissions = useAuthStore((s) => s.user?.permissions)
  return (code: string) => !!permissions?.includes(code)
}