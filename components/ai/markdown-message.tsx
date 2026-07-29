'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

export function MarkdownMessage({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none break-words',
        'prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5',
        'prose-headings:mt-3 prose-headings:mb-1 prose-table:text-xs',
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
