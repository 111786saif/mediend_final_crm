import { Label } from '@/components/ui/label'

/** A single labeled value. Renders nothing if there's no value — callers
 * decide whether an all-empty section should be hidden entirely. */
export function Field({
  label,
  value,
  className,
  truncate = false,
}: {
  label: string
  value: React.ReactNode
  className?: string
  /** Truncate long values (e.g. huge numbers, long URLs) with a title tooltip instead of overflowing/wrapping the box. */
  truncate?: boolean
}) {
  if (value == null || value === '' || value === '-') return null
  return (
    <div className={className}>
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</Label>
      <p
        className={`text-sm font-semibold mt-0.5 ${truncate ? 'truncate' : ''}`}
        title={truncate && typeof value === 'string' ? value : undefined}
      >
        {value}
      </p>
    </div>
  )
}

/** A section panel — tinted background, icon header, and its own field grid
 * sized to however many fields it actually has. Renders nothing if every
 * child Field was empty (checked via hasContent). */
export function Section({
  icon: Icon,
  iconClassName,
  title,
  badge,
  meta,
  hasContent,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconClassName: string
  title: string
  /** Optional badge shown next to the title (e.g. status chip) */
  badge?: React.ReactNode
  /** Optional right-aligned meta text (e.g. "Processed by X on date") */
  meta?: React.ReactNode
  hasContent: boolean
  children: React.ReactNode
}) {
  if (!hasContent) return null
  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Icon className={`w-4 h-4 ${iconClassName}`} />
          {title}
          {badge}
        </h3>
        {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-3">
        {children}
      </div>
    </div>
  )
}