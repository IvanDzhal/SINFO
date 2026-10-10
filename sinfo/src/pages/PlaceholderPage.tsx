export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h2 className="mb-2 text-xl font-semibold">{title}</h2>
      <p className="text-muted">Розділ у розробці.</p>
    </div>
  )
}