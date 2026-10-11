import { Link } from 'react-router-dom'

// Сюди додаємо кнопки підвалу: { label: 'Назва', to: '/адреса' }
const footerLinks: { label: string; to: string }[] = []

export default function Footer() {
  return (
    <footer className="border-t border-border px-4 py-4 text-sm text-muted lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>© {new Date().getFullYear()} Слухавка Інфо</span>
        {footerLinks.length > 0 && (
          <nav className="flex flex-wrap gap-4">
            {footerLinks.map((l) => (
              <Link key={l.to} to={l.to} className="hover:text-ink">
                {l.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </footer>
  )
}