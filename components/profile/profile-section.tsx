'use client'

import { cn } from '@/lib/utils'
import type { AddressDetails } from '@/lib/employee-profile'

export function ProfileSection({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-2xl border bg-card p-4 sm:p-5', className)}>
      <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function ProfileFieldRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ElementType
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  const display = value?.trim() || 'Not set'
  const empty = !value?.trim()
  return (
    <div className="flex min-h-[44px] items-center gap-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/80">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            'truncate text-sm font-medium',
            empty && 'italic text-muted-foreground',
            mono && 'font-mono text-[13px]'
          )}
        >
          {display}
        </p>
      </div>
    </div>
  )
}

export function ProfileAddressBlock({ address, title }: { address: AddressDetails; title: string }) {
  const fields = [
    { label: 'Address line', value: address.line },
    { label: 'City', value: address.city },
    { label: 'State', value: address.state },
    { label: 'PIN code', value: address.pinCode },
    { label: 'Country', value: address.country },
  ]

  const hasAny = fields.some((f) => f.value?.trim())

  return (
    <ProfileSection title={title}>
      {!hasAny ? (
        <p className="py-4 text-center text-sm italic text-muted-foreground">Not set</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className={field.label === 'Address line' ? 'sm:col-span-2' : ''}>
              <p className="text-xs text-muted-foreground">{field.label}</p>
              <p
                className={cn(
                  'mt-0.5 text-sm font-medium',
                  !field.value?.trim() && 'italic text-muted-foreground'
                )}
              >
                {field.value?.trim() || 'Not set'}
              </p>
            </div>
          ))}
        </div>
      )}
    </ProfileSection>
  )
}
