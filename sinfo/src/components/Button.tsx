import clsx from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }

export default function Button({ variant = 'primary', className, ...rest }: Props) {
  return (
    <button
      className={clsx(
        'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50',
        variant === 'primary'
          ? 'bg-accent text-white hover:opacity-90'
          : 'border border-border bg-surface hover:bg-surface-2',
        className,
      )}
      {...rest}
    />
  )
}