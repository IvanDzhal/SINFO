import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { api } from '@/services/api'
import { useThemeStore } from '@/store/useThemeStore'
import { getErrorMessage } from '@/utils/errors'
import RichContent from '@/components/RichContent'
import Button from '@/components/Button'
import { usePageTitle } from '@/hooks/usePageTitle'

interface Lesson {
  id: string
  kind: 'text' | 'video' | 'pdf'
  title: string
  content: unknown
  videoUrl: string | null
  hasFile: boolean
  stage: { id: string; title: string }
  done: boolean
  nextLessonId: string | null
}

// Лише YouTube: приводимо посилання до адреси для вбудовування
export function youtubeEmbed(url: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    let id: string | null = null
    if (u.hostname === 'youtu.be') id = u.pathname.slice(1)
    else if (u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/'))
      id = u.pathname.split('/')[2]
    else id = u.searchParams.get('v')
    return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
  } catch {
    return null
  }
}

export default function TrainingLessonPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const theme = useThemeStore((s) => s.theme)
  const [lesson, setLesson] = useState<Lesson | null>(null)
  usePageTitle(lesson?.title)
  const [pdfUrl, setPdfUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setLesson(null)
    setPdfUrl('')
    setError('')
    api
      .get<Lesson>(`/training/lessons/${id}`)
      .then(async (r) => {
        setLesson(r.data)
        if (r.data.kind === 'pdf' && r.data.hasFile) {
          const f = await api.get<{ url: string }>(`/training/lessons/${id}/file`)
          setPdfUrl(`${api.defaults.baseURL ?? ''}${f.data.url}`)
        }
      })
      .catch((e) => setError(getErrorMessage(e, 'Не вдалося відкрити урок')))
  }, [id])

  async function complete() {
    if (!lesson) return
    setBusy(true)
    try {
      await api.post(`/training/lessons/${lesson.id}/complete`)
      navigate(lesson.nextLessonId ? `/training/lesson/${lesson.nextLessonId}` : '/training')
    } catch (e) {
      setError(getErrorMessage(e, 'Не вдалося зберегти прогрес'))
    } finally {
      setBusy(false)
    }
  }

  const embed = lesson?.kind === 'video' ? youtubeEmbed(lesson.videoUrl) : null

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/training" className="mb-4 inline-flex items-center gap-1 text-sm text-muted">
        <ArrowLeft size={16} /> До навчання
      </Link>

      {error && <p className="text-danger">{error}</p>}
      {!lesson && !error && <p className="text-muted">Завантаження…</p>}

      {lesson && (
        <article>
          <p className="text-sm text-muted">{lesson.stage.title}</p>
          <h1 className="mb-4 text-2xl font-semibold">{lesson.title}</h1>

          {lesson.kind === 'text' && (
            <RichContent key={lesson.id} content={lesson.content} theme={theme} />
          )}

          {lesson.kind === 'video' &&
            (embed ? (
              <div className="aspect-video overflow-hidden rounded-2xl bg-black">
                <iframe
                  src={embed}
                  title={lesson.title}
                  className="h-full w-full"
                  allow="accelerometer; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <p className="text-danger">Некоректне посилання на відео</p>
            ))}

          {lesson.kind === 'pdf' &&
            (pdfUrl ? (
              <iframe
                src={pdfUrl}
                title={lesson.title}
                className="h-[75vh] w-full rounded-2xl border border-border bg-surface"
              />
            ) : (
              <p className="text-muted">Завантаження документа…</p>
            ))}

          <div className="mt-6 flex items-center gap-3">
            {lesson.done ? (
              <>
                <span className="inline-flex items-center gap-2 text-sm text-accent">
                  <CheckCircle2 size={18} /> Опрацьовано
                </span>
                <Link
                  to={lesson.nextLessonId ? `/training/lesson/${lesson.nextLessonId}` : '/training'}
                  className="text-sm text-accent underline"
                >
                  Далі
                </Link>
              </>
            ) : (
              <Button onClick={complete} disabled={busy}>
                Опрацьовано, далі
              </Button>
            )}
          </div>
        </article>
      )}
    </div>
  )
}
