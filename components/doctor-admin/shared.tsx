'use client'

import { Badge } from '@/components/ui/badge'

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-GB')
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function StatusBadge({
  status,
}: {
  status: string
}) {
  const normalized = status.trim().toLowerCase().replace(/[\s-]+/g, '_')
  const className =
    normalized === 'active' || normalized === 'approved' || normalized === 'done' || normalized === 'completed'
      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
      : normalized === 'pending' || normalized === 'scheduled' || normalized === 'discharge_queue'
        ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
        : normalized === 'cancelled' || normalized === 'rejected' || normalized === 'lost' || normalized === 'no_show'
          ? 'bg-rose-100 text-rose-700 hover:bg-rose-100'
          : normalized === 'converted' || normalized === 'admitted'
            ? 'bg-blue-100 text-blue-700 hover:bg-blue-100'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-100'

  return (
    <Badge variant='secondary' className={className}>
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}
