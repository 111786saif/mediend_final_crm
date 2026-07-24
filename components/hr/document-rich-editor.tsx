'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  Heading2,
  Heading3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TEMPLATE_PLACEHOLDERS } from '@/lib/hrms/document-merge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type DocumentRichEditorProps = {
  content: string
  onChange: (html: string) => void
  editable?: boolean
  className?: string
  /** Show placeholder insert dropdown for template editing */
  showPlaceholders?: boolean
  minHeight?: string
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  children,
  title,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
  title: string
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn('h-8 w-8 p-0', active && 'bg-muted')}
    >
      {children}
    </Button>
  )
}

export function DocumentRichEditor({
  content,
  onChange,
  editable = true,
  className,
  showPlaceholders = false,
  minHeight = '420px',
}: DocumentRichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({
        placeholder: 'Start editing the document…',
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: content || '',
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'document-rich-editor-prose focus:outline-none',
        style: `min-height: ${minHeight};`,
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (content !== current && content !== undefined) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [content, editor])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
  }, [editable, editor])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('document-rich-editor-styles')) return
    const style = document.createElement('style')
    style.id = 'document-rich-editor-styles'
    style.textContent = `
      .document-rich-editor-prose {
        font-family: 'Times New Roman', Times, serif;
        font-size: 15px;
        line-height: 1.6;
        color: #333;
      }
      .document-rich-editor-prose p { margin: 0.75em 0; }
      .document-rich-editor-prose h2,
      .document-rich-editor-prose h3,
      .document-rich-editor-prose h4 {
        font-weight: 700;
        margin: 1em 0 0.5em;
      }
      .document-rich-editor-prose ul,
      .document-rich-editor-prose ol {
        padding-left: 1.5em;
        margin: 0.75em 0;
      }
      .document-rich-editor-prose table {
        width: 100%;
        border-collapse: collapse;
        margin: 1em 0;
      }
      .document-rich-editor-prose td,
      .document-rich-editor-prose th {
        border: 1px solid #ddd;
        padding: 8px 12px;
      }
      .document-rich-editor-prose img { max-width: 100%; height: auto; }
      .document-rich-editor-prose .subject {
        font-weight: bold;
        text-align: center;
        text-decoration: underline;
        margin: 1em 0;
      }
      .document-rich-editor-prose .date { text-align: right; }
      .document-rich-editor-prose p.is-editor-empty:first-child::before {
        color: #94a3b8;
        content: attr(data-placeholder);
        float: left;
        height: 0;
        pointer-events: none;
      }
    `
    document.head.appendChild(style)
  }, [])

  if (!editor) {
    return (
      <div className={cn('rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground', className)}>
        Loading editor…
      </div>
    )
  }

  const insertPlaceholder = (key: string) => {
    editor.chain().focus().insertContent(`{{${key}}}`).run()
  }

  return (
    <div className={cn('rounded-md border bg-background', className)}>
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-2 py-1.5">
          <ToolbarButton
            title="Bold"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Italic"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Underline"
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            title="Heading 2"
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Heading 3"
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            title="Bullet list"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Ordered list"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            title="Align left"
            active={editor.isActive({ textAlign: 'left' })}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
          >
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Align center"
            active={editor.isActive({ textAlign: 'center' })}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
          >
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Align right"
            active={editor.isActive({ textAlign: 'right' })}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
          >
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 className="h-4 w-4" />
          </ToolbarButton>
          {showPlaceholders && (
            <>
              <div className="mx-1 h-5 w-px bg-border" />
              <Select onValueChange={insertPlaceholder}>
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder="Insert field…" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_PLACEHOLDERS.map((p) => (
                    <SelectItem key={p.key} value={p.key} className="text-xs">
                      {p.label} <span className="text-muted-foreground">{`{{${p.key}}}`}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      )}
      <div className="overflow-auto p-4" style={{ maxHeight: '70vh' }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
