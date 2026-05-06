import { useEffect, useRef } from 'react'
import { Editor } from '@toast-ui/react-editor'
import '@toast-ui/editor/dist/toastui-editor.css'

interface MarkdownEditorProps {
  value: string
  onChange: (md: string) => void
  /** Async-uppladdning. Får en File/Blob, returnerar URL till uppladdad bild. */
  onUploadImage?: (file: File) => Promise<string>
  height?: string
  placeholder?: string
}

/**
 * Toast UI Editor — WYSIWYG markdown-editor med toolbar, bildhantering och
 * image-resize via drag i hörnet. Två lägen som man togglar via knapp:
 *   - WYSIWYG (default) — ser ut som färdig artikel
 *   - Markdown — ren textläge för den som vill skriva markdown direkt
 *
 * Telemetri (usageStatistics) är avstängd — vi vill inte att admin-vyn pingar
 * Toast UI:s servrar med användningsdata.
 */
export function MarkdownEditor({ value, onChange, onUploadImage, height = '500px', placeholder }: MarkdownEditorProps) {
  const ref = useRef<Editor>(null)

  // Synka extern värde-prop med editorns interna state om de gått isär
  // (t.ex. när "Spara" returnerar normaliserat värde från servern).
  useEffect(() => {
    const editor = ref.current?.getInstance()
    if (!editor) return
    const current = editor.getMarkdown()
    if (current !== value) {
      editor.setMarkdown(value || '', false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className="markdown-editor-wrap">
      <Editor
        ref={ref}
        initialValue={value || ''}
        height={height}
        initialEditType="wysiwyg"
        previewStyle="vertical"
        useCommandShortcut
        usageStatistics={false}
        placeholder={placeholder}
        toolbarItems={[
          ['heading', 'bold', 'italic', 'strike'],
          ['hr', 'quote'],
          ['ul', 'ol', 'task'],
          ['table', 'image', 'link'],
          ['code', 'codeblock'],
        ]}
        onChange={() => {
          const editor = ref.current?.getInstance()
          if (editor) onChange(editor.getMarkdown())
        }}
        hooks={onUploadImage ? {
          // När användaren drar in en bild eller klickar bild-knappen.
          // Vi laddar upp den till vår server och callbackar URL:en.
          addImageBlobHook: async (blob: Blob, callback: (url: string, alt?: string) => void) => {
            try {
              const file = blob instanceof File ? blob : new File([blob], 'bild.png', { type: blob.type })
              const url = await onUploadImage(file)
              callback(url, file.name)
            } catch (e) {
              callback('', '')
            }
          },
        } : undefined}
      />
    </div>
  )
}
