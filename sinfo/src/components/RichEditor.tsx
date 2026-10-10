import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import * as locales from '@blocknote/core/locales'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'

export default function RichEditor({
  initialContent,
  theme,
  editable = true,
  onChange,
}: {
  initialContent: unknown
  theme: 'light' | 'dark'
  editable?: boolean
  onChange: (blocks: unknown) => void
}) {
  const editor = useCreateBlockNote({
    initialContent:
      Array.isArray(initialContent) && initialContent.length > 0
        ? (initialContent as never)
        : undefined,
    dictionary: locales.uk,
  })
  return (
    <BlockNoteView
      editor={editor}
      theme={theme}
      editable={editable}
      onChange={() => onChange(editor.document)}
    />
  )
}