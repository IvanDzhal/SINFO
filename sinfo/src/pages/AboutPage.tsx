import {
  BadgeCheck,
  Camera,
  Gem,
  Globe,
  Handshake,
  Heart,
  History,
  Laptop,
  Music2,
  Refrigerator,
  ShieldCheck,
  Smartphone,
  Store,
  Target,
  Users,
  Wallet,
  GraduationCap,
  WashingMachine,
  type LucideIcon,
} from 'lucide-react'

const stats = [
  { value: '18', label: 'Років на ринку' },
  { value: '20', label: 'Магазинів (вкл. 4 партнерські)' },
  { value: '100%', label: 'Оригінальний сертифікований товар' },
]

const history = [
  {
    year: '2008',
    text: "Заснування компанії. Три невеликі магазини: комп'ютери, комплектуючі та фототехніка.",
  },
  { year: '~2012', text: 'В асортименті з’явились аксесуари до телефонів та самі телефони.' },
  {
    year: 'Сьогодні',
    text: 'Великий асортимент: від побутової техніки та ноутбуків до смартфонів та аксесуарів. Близько 20 магазинів.',
  },
]

const values: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Heart,
    title: 'Клієнтоорієнтованість',
    text: 'Клієнт на першому місці — його задоволеність є мірилом нашого успіху.',
  },
  {
    icon: Handshake,
    title: 'Індивідуальний підхід',
    text: 'Враховуємо потреби кожної людини, адже кожен унікальний.',
  },
  {
    icon: GraduationCap,
    title: 'Професіоналізм',
    text: 'Спеціалісти постійно проходять тренінги та семінари.',
  },
  {
    icon: Wallet,
    title: 'Доступність',
    text: 'Поруч із клієнтом, середньо-ринкові ціни для кожного.',
  },
  {
    icon: ShieldCheck,
    title: 'Чесність і якість',
    text: 'Тільки оригінальний сертифікований товар з гарантією.',
  },
  { icon: Users, title: 'Командність', text: 'Всі як один механізм для однієї мети.' },
]

const categories: { icon: LucideIcon; extra?: LucideIcon; title: string; text: string }[] = [
  {
    icon: Smartphone,
    title: 'Мобільні телефони',
    text: 'Широкий асортимент брендів',
  },
  {
    icon: Laptop,
    title: 'Ноутбуки та планшети',
    text: 'Для роботи та навчання',
  },
  {
    icon: Refrigerator,
    extra: WashingMachine,
    title: 'Велика та дрібна техніка',
    text: 'Офіційна гарантія',
  },
]

const socials: { icon: LucideIcon; label: string; href: string }[] = [
  { icon: Music2, label: 'TikTok', href: 'https://www.tiktok.com/@sluhavka' },
  { icon: Camera, label: 'Instagram', href: 'https://www.instagram.com/sluhavka_com/' },
  { icon: Globe, label: 'Сайт', href: 'https://www.sluhavka.com/' },
]

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <h3 className="mb-4 flex items-center gap-2.5 text-lg font-semibold">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon size={18} />
      </span>
      {children}
    </h3>
  )
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="text-2xl font-semibold">Про компанію</h2>
      <p className="mb-5 mt-1 text-sm text-muted">Історія, місія та цінності Слухавки</p>

      {/* Hero */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="relative flex h-44 items-center justify-center bg-gradient-to-br from-accent to-[#ff9a3d] sm:h-56">
          <span className="absolute -left-10 -top-10 h-40 w-40 rounded-full border-[18px] border-white/15" />
          <span className="absolute -bottom-16 -right-8 h-52 w-52 rounded-full border-[22px] border-white/15" />
          <div className="relative flex flex-col items-center gap-3 px-4">
            <span className="rounded-2xl bg-white px-6 py-3 text-center text-base font-bold uppercase tracking-widest text-accent shadow-lg sm:text-xl">
              Мережа магазинів — Слухавка
            </span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white">
              З 2008 року
            </span>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <h3 className="text-xl font-semibold">Ми — мережа магазинів розумної техніки «Слухавка»</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Працюємо на ринку вже <b className="text-ink">18 років</b>. Наша мета — допомогти клієнту
            зробити правильний вибір, адже ми забезпечуємо індивідуальний підхід із залученням
            найкращих фахівців, а також доступні ціни і сертифікований товар з офіційною гарантією.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-surface p-5 text-center">
            <p className="text-3xl font-bold text-accent">{s.value}</p>
            <p className="mt-1 text-sm text-muted">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Mission */}
      <section className="mb-6 rounded-2xl border border-border border-l-4 border-l-accent bg-surface p-5 sm:p-6">
        <SectionTitle icon={Target}>Місія</SectionTitle>
        <p className="text-sm leading-relaxed text-muted">
          Ми всі одна компанія і нас одна мета —{' '}
          <b className="text-accent">допомогти клієнту зробити правильний вибір!</b> З дня заснування
          ми позиціонуємо себе як «ЗРУЧНИЙ МАГАЗИН» — магазин, який поруч із клієнтом. Наші магазини
          розташовані у районних центрах, що дає змогу бути максимально близькими із клієнтами.
        </p>
      </section>

      {/* History */}
      <section className="mb-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <SectionTitle icon={History}>Історія</SectionTitle>
        <ol className="space-y-5 border-l-2 border-border pl-6">
          {history.map((h) => (
            <li key={h.year} className="relative">
              <span className="absolute -left-[33px] top-1 h-3 w-3 rounded-full border-2 border-surface bg-accent ring-2 ring-accent-soft" />
              <p className="font-semibold text-accent">{h.year}</p>
              <p className="mt-0.5 text-sm text-muted">{h.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Values */}
      <section className="mb-6">
        <SectionTitle icon={Gem}>Цінності</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {values.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-border bg-surface p-5">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon size={20} />
              </span>
              <h4 className="font-semibold">{title}</h4>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mb-6">
        <SectionTitle icon={Store}>Наш асортимент</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {categories.map(({ icon: Icon, extra: Extra, title, text }) => (
            <div
              key={title}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <div className="relative flex h-36 items-center justify-center gap-3 bg-gradient-to-br from-accent-soft to-surface-2 text-accent">
                <span className="absolute -right-6 -top-6 h-24 w-24 rounded-full border-[12px] border-accent/10" />
                <span className="absolute -bottom-8 -left-6 h-24 w-24 rounded-full border-[12px] border-accent/10" />
                <Icon size={56} strokeWidth={1.5} className="relative" />
                {Extra && <Extra size={44} strokeWidth={1.5} className="relative opacity-70" />}
              </div>
              <div className="flex items-start gap-2 p-4">
                <BadgeCheck size={18} className="mt-0.5 shrink-0 text-accent" />
                <div>
                  <h4 className="font-semibold">{title}</h4>
                  <p className="text-sm text-muted">{text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Socials */}
      <section className="mb-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h3 className="mb-3 font-semibold">Ми в соціальних мережах</h3>
        <div className="flex flex-wrap gap-3">
          {socials.map(({ icon: Icon, label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-2 text-sm font-medium transition-colors hover:bg-accent-soft hover:text-accent"
            >
              <Icon size={16} />
              {label}
            </a>
          ))}
        </div>
      </section>

      <p className="text-right text-xs text-muted/80">
        © Автор сторінки:{' '}
        <a
          href="https://www.instagram.com/snsk.sia/"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-accent"
        >
          Анастасія Сушинська
        </a>
      </p>
    </div>
  )
}
