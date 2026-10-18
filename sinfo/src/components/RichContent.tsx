import { useCallback, useEffect, useRef, useState } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { resolveFileUrl } from '@/utils/fileUrl'
import { richSchema } from './richSchema'

function Lightbox({
  images,
  start,
  onClose,
}: {
  images: string[]
  start: number
  onClose: () => void
}) {
  const [i, setI] = useState(start)
  const touchX = useRef<number | null>(null)
  const n = images.length
  const prev = useCallback(() => setI((v) => (v - 1 + n) % n), [n])
  const next = useCallback(() => setI((v) => (v + 1) % n), [n])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose, prev, next])

  const btn: React.CSSProperties = {
    position: 'absolute',
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: 44,
    height: 44,
    fontSize: 24,
    cursor: 'pointer',
  }

  return (
    <div
      onClick={onClose}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null || n < 2) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) > 50) dx > 0 ? prev() : next()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src={images[i]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', touchAction: 'pinch-zoom' }}
      />
      <button type="button" aria-label="Закрити" onClick={onClose} style={{ ...btn, top: 12, right: 12 }}>
        ×
      </button>
      {n > 1 && (
        <>
          <button
            type="button"
            aria-label="Попереднє"
            onClick={(e) => { e.stopPropagation(); prev() }}
            style={{ ...btn, left: 12, top: '50%', transform: 'translateY(-50%)' }}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Наступне"
            onClick={(e) => { e.stopPropagation(); next() }}
            style={{ ...btn, right: 12, top: '50%', transform: 'translateY(-50%)' }}
          >
            ›
          </button>
          <div style={{ position: 'absolute', bottom: 16, color: '#fff', fontSize: 14 }}>
            {i + 1} / {n}
          </div>
        </>
      )}
    </div>
  )
}

export default function RichContent({
  content,
  theme,
}: {
  content: unknown
  theme: 'light' | 'dark'
}) {
  const editor = useCreateBlockNote({
    schema: richSchema,
    initialContent:
      Array.isArray(content) && content.length > 0 ? (content as never) : undefined,
    resolveFileUrl,
  })
  const ref = useRef<HTMLDivElement>(null)
  const [gallery, setGallery] = useState<{ images: string[]; start: number } | null>(null)

  const onClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName !== 'IMG' || !ref.current) return
    const imgs = Array.from(
      ref.current.querySelectorAll<HTMLImageElement>('.bn-visual-media-wrapper img, .bn-visual-media'),
    ).filter((el, idx, arr) => el.tagName === 'IMG' && arr.indexOf(el) === idx)
    const start = imgs.indexOf(target as HTMLImageElement)
    if (start < 0) return
    setGallery({ images: imgs.map((el) => el.src), start })
  }

  return (
    <div ref={ref} onClick={onClick} className="rich-content">
      <style>{`.rich-content .bn-visual-media{cursor:zoom-in}`}</style>
      <BlockNoteView editor={editor} editable={false} theme={theme} />
      {gallery && (
        <Lightbox images={gallery.images} start={gallery.start} onClose={() => setGallery(null)} />
      )}
    </div>
  )
}
