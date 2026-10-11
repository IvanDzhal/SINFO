import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { resolveFileUrl } from '@/utils/fileUrl'

export default function RichContent({
  content,
  theme,
}: {
  content: unknown
  theme: 'light' | 'dark'
}) {
  const editor = useCreateBlockNote({
    initialContent:
      Array.isArray(content) && content.length > 0 ? (content as never) : undefined,
    resolveFileUrl,
  })
  return <BlockNoteView editor={editor} editable={false} theme={theme} />
}