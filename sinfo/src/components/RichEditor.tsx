import { SuggestionMenuController, useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import * as locales from '@blocknote/core/locales'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { getSlashItems, richSchema } from './richSchema'
import { resolveFileUrl, uploadFile } from '@/utils/fileUrl'

export default function RichEditor({
  initialContent,
  theme,
  editable = true,
  allowUpload = false,
  onChange,
}: {
  initialContent: unknown
  theme: 'light' | 'dark'
  editable?: boolean
  allowUpload?: boolean
  onChange: (blocks: unknown) => void
}) {
  const editor = useCreateBlockNote({
    schema: richSchema,
    initialContent:
      Array.isArray(initialContent) && initialContent.length > 0
        ? (initialContent as never)
        : undefined,
    dictionary: locales.uk,
    resolveFileUrl,
    uploadFile: allowUpload ? uploadFile : undefined,
  })
  return (
    <BlockNoteView
      editor={editor}
      theme={theme}
      editable={editable}
      slashMenu={false}
      onChange={() => onChange(editor.document)}
    >
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) => getSlashItems(editor, query)}
      />
    </BlockNoteView>
  )
}