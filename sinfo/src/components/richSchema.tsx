import { useState } from 'react'
import { BlockNoteSchema, defaultBlockSpecs, filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core'
import { createReactBlockSpec, getDefaultReactSlashMenuItems } from '@blocknote/react'

const CALLOUT_COLORS: Record<string, { label: string; bg: string; border: string }> = {
  gray: { label: 'Сірий', bg: 'rgba(128,128,128,0.14)', border: 'rgba(128,128,128,0.35)' },
  blue: { label: 'Синій', bg: 'rgba(59,130,246,0.14)', border: 'rgba(59,130,246,0.4)' },
  green: { label: 'Зелений', bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.4)' },
  yellow: { label: 'Жовтий', bg: 'rgba(234,179,8,0.16)', border: 'rgba(234,179,8,0.45)' },
  orange: { label: 'Помаранчевий', bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.4)' },
  red: { label: 'Червоний', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.4)' },
  purple: { label: 'Фіолетовий', bg: 'rgba(168,85,247,0.14)', border: 'rgba(168,85,247,0.4)' },
}

const EMOJIS = [
  '💡', '⚠️', '❗', '❓', 'ℹ️', '✅', '❌', '📌', '📝', '🔥', '⭐', '🚀',
  '📞', '🔒', '🛠️', '📎', '👉', '💬', '🎯', '📢', '⏰', '🚫', '👍', '🧠',
]

const callout = createReactBlockSpec(
  {
    type: 'callout',
    propSchema: {
      emoji: { default: '💡' },
      color: { default: 'gray' },
    },
    content: 'inline',
  },
  {
    render: ({ block, editor, contentRef }) => {
      const [open, setOpen] = useState(false)
      const c = CALLOUT_COLORS[block.props.color] ?? CALLOUT_COLORS.gray
      const editable = editor.isEditable
      return (
        <div
          style={{
            display: 'flex',
            gap: 10,
            width: '100%',
            padding: '12px 14px',
            borderRadius: 8,
            background: c.bg,
            border: `1px solid ${c.border}`,
            position: 'relative',
          }}
        >
          <button
            type="button"
            contentEditable={false}
            disabled={!editable}
            onClick={() => setOpen((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 22,
              lineHeight: '28px',
              cursor: editable ? 'pointer' : 'default',
              padding: 0,
              height: 28,
              flexShrink: 0,
            }}
            title={editable ? 'Змінити емодзі та колір' : undefined}
          >
            {block.props.emoji}
          </button>
          <div ref={contentRef} style={{ flex: 1, minWidth: 0 }} />
          {open && editable && (
            <div
              contentEditable={false}
              style={{
                position: 'absolute',
                top: 44,
                left: 10,
                zIndex: 20,
                background: 'var(--bn-colors-menu-background, #fff)',
                color: 'var(--bn-colors-menu-text, #222)',
                border: '1px solid var(--bn-colors-border, #ccc)',
                borderRadius: 8,
                padding: 8,
                boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
                width: 240,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2 }}>
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      editor.updateBlock(block, { props: { emoji: e } })
                      setOpen(false)
                    }}
                    style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: 3 }}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <input
                placeholder="Свій емодзі…"
                maxLength={8}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' && ev.currentTarget.value.trim()) {
                    editor.updateBlock(block, { props: { emoji: ev.currentTarget.value.trim() } })
                    setOpen(false)
                  }
                }}
                style={{
                  width: '100%',
                  margin: '8px 0',
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--bn-colors-border, #ccc)',
                  background: 'transparent',
                  color: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(CALLOUT_COLORS).map(([key, v]) => (
                  <button
                    key={key}
                    type="button"
                    title={v.label}
                    onClick={() => editor.updateBlock(block, { props: { color: key } })}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: v.bg,
                      border: `2px solid ${block.props.color === key ? 'currentColor' : v.border}`,
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )
    },
  },
)

export const richSchema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, callout: callout() },
})

export function getSlashItems(editor: typeof richSchema.BlockNoteEditor, query: string) {
  const items = [
    ...getDefaultReactSlashMenuItems(editor),
    {
      title: 'Виноска',
      subtext: 'Виділений блок з емодзі',
      aliases: ['callout', 'виноска', 'note', 'увага'],
      group: 'Базові блоки',
      icon: <span>💡</span>,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: 'callout' }),
    },
  ]
  return filterSuggestionItems(items, query)
}
