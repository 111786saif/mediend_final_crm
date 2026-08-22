'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import { formatLeadAgeSex } from '@/lib/lead-display'
import type { Lead } from '@/hooks/use-leads'
import { format } from 'date-fns'
import { Building2, Stethoscope, UserRound, CalendarDays, ExternalLink } from 'lucide-react'
import Link from 'next/link'

// Kept local (rather than imported from the page) so this sheet has no
// dependency on the page's internal bucket typing — just needs a bucket key.
type Bucket =
  | 'KYP'
  | 'HOSPITALS_SUGGESTED'
  | 'PREAUTH_RAISED'
  | 'PREAUTH_COMPLETE'
  | 'IPD_POSSIBLE'
  | 'IPD_SCHEDULED'
  | 'IPD_DONE'
  | 'POSTPONED'
  | 'CANCELLED'

const BUCKET_BADGE: Record<Bucket, { label: string; className: string }> = {
  KYP: { label: 'KYP raised', className: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300' },
  HOSPITALS_SUGGESTED: { label: 'Hospitals suggested', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  PREAUTH_RAISED: { label: 'Pre-auth raised', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  PREAUTH_COMPLETE: { label: 'Pre-auth approved', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' },
  IPD_POSSIBLE: { label: 'IPD Possible', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  IPD_SCHEDULED: { label: 'IPD scheduled', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300' },
  IPD_DONE: { label: 'IPD done', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
  POSTPONED: { label: 'Postponed', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  CANCELLED: { label: 'Cancelled', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300' },
}

export interface CaseOverviewRow {
  lead: Lead
  bucket: Bucket
  hospital: string
  doctor: string
}

interface CaseOverviewSheetProps {
  row: CaseOverviewRow | null
  open: boolean
  onClose: () => void
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right min-w-0 truncate">{value ?? '—'}</span>
    </div>
  )
}

export function CaseOverviewSheet({ row, open, onClose }: CaseOverviewSheetProps) {
  const lead = row?.lead
  const badge = row ? BUCKET_BADGE[row.bucket] : null

  const entryDate = lead?.leadEntryDate || lead?.createdDate
  const surgeryDate =
    lead?.surgeryDate ?? (lead as { admissionRecord?: { surgeryDate?: string } } | undefined)?.admissionRecord?.surgeryDate

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 gap-0 flex flex-col">
        {row && lead && (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle className="text-lg font-bold truncate">{lead.patientName || 'Patient'}</SheetTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">{formatLeadAgeSex(lead)}</p>
                </div>
                {badge && (
                  <Badge variant="secondary" className={`${badge.className} shrink-0`}>
                    {badge.label}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm font-medium">{lead.leadRef}</span>
                {lead.leadRef && <CopyLeadRefButton leadRef={String(lead.leadRef)} />}
              </div>
            </SheetHeader>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
              {/* Dates */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Dates
                </p>
                <DetailRow label="Lead date" value={entryDate ? format(new Date(entryDate as string), 'MMM d, yyyy') : undefined} />
                <DetailRow label="Surgery date" value={surgeryDate ? format(new Date(surgeryDate as string), 'MMM d, yyyy') : undefined} />
                {lead.ipdPotentialDate && (
                  <DetailRow label="Expected IPD" value={format(new Date(lead.ipdPotentialDate as string), 'MMM d, yyyy')} />
                )}
              </div>

              <Separator />

              {/* Case */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Stethoscope className="h-3.5 w-3.5" /> Case
                </p>
                <DetailRow label="Treatment" value={lead.treatment} />
                <DetailRow label="Circle" value={typeof lead.circle === 'string' ? lead.circle : undefined} />
                <DetailRow label="City" value={typeof (lead as { city?: unknown }).city === 'string' ? (lead as { city?: string }).city : undefined} />
                <DetailRow label="Type" value={lead.flowType === 'CASH' ? 'Cash' : lead.flowType === 'INSURANCE' ? 'Insurance' : undefined} />
                <DetailRow label="Insurance" value={lead.insuranceName} />
                <DetailRow label="TPA" value={lead.tpa} />
              </div>

              <Separator />

              {/* Hospital & doctor */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Hospital &amp; doctor
                </p>
                <DetailRow label="Hospital" value={row.hospital || undefined} />
                <DetailRow label="Doctor" value={row.doctor || undefined} />
              </div>

              <Separator />

              {/* BD */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5" /> Assigned BD
                </p>
                <DetailRow label="BD" value={(lead.plRecord?.bdmName ?? lead.bd?.name ?? '').trim() || undefined} />
              </div>
            </div>

            <div className="px-6 py-4 border-t shrink-0">
              <Button asChild className="w-full">
                <Link href={`/patient/${lead.id}`} target="_blank" rel="noopener noreferrer">
                  Open full patient page
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}