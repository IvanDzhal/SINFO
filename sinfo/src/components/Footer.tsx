import { Link } from 'react-router-dom'

// Сюди додаємо кнопки підвалу: { label: 'Назва', to: '/адреса' }
// Для зовнішніх посилань використовуємо тег <a>, для внутрішніх — <Link>
const footerLinks: { label: string; to: string; external?: boolean }[] = [
  { label: 'Сайт Слухавки', to: 'https://sluhavka.com', external: true },
  { label: 'Розробник', to: 'https://uadd.me/ivan_dzhal', external: true },
  { label: 'Повідомити про помилку', to: 'https://forms.clickup.com/90122054837/f/2kxv2v5n-1092/FJGOTVKAG26SAC90Z2', external: true },
]

export default function Footer() {
  return (
    <footer className="border-t border-border px-4 py-4 text-sm text-muted lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Ліва частина: навігація */}
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {footerLinks.map((l) => {
            if (l.external) {
              return (
                <a
                  key={l.to}
                  href={l.to}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ink transition-colors"
                >
                  {l.label}
                </a>
              )
            }
            return (
              <Link key={l.to} to={l.to} className="hover:text-ink transition-colors">
                {l.label}
              </Link>
            )
          })}
        </nav>

        {/* Права частина: копірайт */}
        <span className="ml-auto text-xs sm:text-sm text-muted/80">
          © 2026 Слухавка. Всі права захищені.
        </span>
      </div>
    </footer>
  )
}