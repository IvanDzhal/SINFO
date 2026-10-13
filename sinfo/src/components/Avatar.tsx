import clsx from 'clsx'
import { api } from '@/services/api'

const SIZES = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-20 w-20 text-2xl',
} as const

interface Props {
  firstName: string
  lastName: string
  // відносне посилання з бекенда (/profile/avatar/...), без нього — ініціали
  url?: string | null
  size?: keyof typeof SIZES
  className?: string
}

export default function Avatar({ firstName, lastName, url, size = 'md', className }: Props) {
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase()
  const base = clsx(
    'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-medium text-accent',
    SIZES[size],
    className,
  )
  if (url) {
    return (
      <img
        src={`${api.defaults.baseURL ?? ''}${url}`}
        alt={`${firstName} ${lastName}`}
        className={clsx(base, 'object-cover')}
      />
    )
  }
  return <span className={base}>{initials}</span>
}
