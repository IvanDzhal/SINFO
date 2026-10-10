import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'

const base =
  'w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-accent'

export function Input({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input className={base} {...props} />
    </label>
  )
}

export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <select className={base} {...props}>
        {children}
      </select>
    </label>
  )
}