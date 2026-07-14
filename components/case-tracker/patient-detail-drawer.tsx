'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import {
  ExternalLink,
  Phone,
  MapPin,
  Stethoscope,
  User,
  Building2,
  Shield,
  FileText,
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/use-auth'
import { canViewPhoneNumber } from '@/lib/case-permissions'
import { resolveLeadCity } from '@/lib/lead-display'
import { getPhoneDisplay } from '@/lib/phone-utils'
import type { DecoratedCaseRow } from '@/lib/case-tracker-table'
import { getCaseRowCellValue } from '@/lib/case-tracker-table'

interface PatientDetailDrawerProps {
  row: DecoratedCaseRow | null
  open: boolean
  onClose: () => void
  stageBadgeClassName?: string
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  if (!value || value === '—') return null
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-lg border bg-muted/40 p-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  )
}

export function PatientDetailDrawer({
  row,
  open,
  onClose,
  stageBadgeClassName,
}: PatientDetailDrawerProps) {
  const { user } = useAuth()
  const canViewPhone = canViewPhoneNumber(user)

  if (!row) {
    return (
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md" />
      </Sheet>
    )
  }

  const { lead, hospital, doctor, stageLabel } = row
  const city = resolveLeadCity(lead) ?? '—'
  const insurance = getCaseRowCellValue(row, 'insurance', canViewPhone)
  const tpa = getCaseRowCellValue(row, 'tpa', canViewPhone)
  const type = getCaseRowCellValue(row, 'type', canViewPhone)
  const bdName = getCaseRowCellValue(row, 'bd', canViewPhone)
  const kyp = lead.kypSubmission as { status?: string; submittedAt?: string | Date } | null | undefined

  const surgeryRaw =
    lead.surgeryDate ??
    (lead as { admissionRecord?: { surgeryDate?: string | Date } }).admissionRecord?.surgeryDate
  const surgeryFormatted = surgeryRaw
    ? format(new Date(surgeryRaw as string), 'MMM d, yyyy')
    : null

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0">
        <ScrollArea className="h-full">
          <div className="space-y-5 p-6">
            <SheetHeader className="space-y-3 text-left">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle className="text-xl">{lead.patientName}</SheetTitle>
                  <p className="text-sm text-muted-foreground mt-1">{lead.leadRef ?? '—'}</p>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href={`/patient/${lead.id}`}>
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    Full details
                  </Link>
                </Button>
              </div>
              <Badge variant="secondary" className={stageBadgeClassName}>
                {stageLabel}
              </Badge>
            </SheetHeader>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Patient details
              </h3>
              <DetailRow icon={User} label="Age / Sex" value={[
                lead.age != null ? String(lead.age) : '',
                typeof lead.sex === 'string' ? lead.sex : '',
              ].filter(Boolean).join(' / ') || '—'} />
              <DetailRow icon={Stethoscope} label="Treatment" value={String(lead.treatment ?? '—')} />
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contact information
              </h3>
              <DetailRow icon={Phone} label="Phone" value={getPhoneDisplay(lead.phoneNumber, canViewPhone)} />
              <DetailRow icon={MapPin} label="City" value={city} />
              <DetailRow icon={MapPin} label="Circle" value={typeof lead.circle === 'string' ? lead.circle : '—'} />
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Case information
              </h3>
              <DetailRow icon={Building2} label="Hospital" value={hospital || '—'} />
              <DetailRow icon={User} label="Doctor" value={doctor || '—'} />
              {surgeryFormatted && (
                <DetailRow icon={FileText} label="Surgery date" value={surgeryFormatted} />
              )}
              <DetailRow
                icon={FileText}
                label="Case stage"
                value={String(lead.caseStage ?? '').replace(/_/g, ' ') || '—'}
              />
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Business developer
              </h3>
              <DetailRow icon={User} label="BDM" value={bdName || '—'} />
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Insurance information
              </h3>
              <DetailRow icon={Shield} label="Insurance" value={insurance || '—'} />
              <DetailRow icon={Shield} label="Type" value={type || '—'} />
              <DetailRow icon={Shield} label="TPA" value={tpa || '—'} />
            </section>

            {(kyp?.status || kyp?.submittedAt) && (
              <>
                <Separator />
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Timeline
                  </h3>
                  {kyp.status && (
                    <DetailRow icon={FileText} label="KYP status" value={kyp.status.replace(/_/g, ' ')} />
                  )}
                  {kyp.submittedAt && (
                    <DetailRow
                      icon={FileText}
                      label="KYP submitted"
                      value={format(new Date(kyp.submittedAt as string), 'MMM d, yyyy')}
                    />
                  )}
                </section>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
