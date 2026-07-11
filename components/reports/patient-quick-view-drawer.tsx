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
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { ActivityTimeline } from '@/components/case/activity-timeline'
import { StageProgress } from '@/components/case/stage-progress'
import { CashStageProgress } from '@/components/case/cash-stage-progress'
import { CaseStage, FlowType } from '@/generated/prisma/enums'
import { cn } from '@/lib/utils'
import {
  Loader2,
  ExternalLink,
  Phone,
  Building2,
  Stethoscope,
  User,
  Users,
  Waypoints,
  Clock,
  History,
} from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

interface LeadDetail {
  id: string
  leadRef?: string
  patientName?: string
  phoneNumber?: string | null
  hospitalName?: string
  treatment?: string | null
  caseStage: CaseStage
  pipelineStage?: string
  flowType?: FlowType | null
  bd?: { name?: string } | null
  insuranceInitiateForm?: { id?: string } | null
  admissionRecord?: { ipdStatus?: string | null } | null
}

interface StageHistoryEntry {
  id: string
  fromStage: CaseStage | null
  toStage: CaseStage
  changedAt: string
  note: string | null
  changedBy: { id: string; name: string; email: string; role: string } | null
}

function humanizeStage(stage: string | undefined | null): string {
  if (!stage) return '—'
  return stage
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ')
}

function pipelineBadgeClass(pipelineStage: string | undefined): string {
  const s = (pipelineStage || '').toUpperCase()
  if (s === 'LOST' || s === 'DROPPED')
    return 'border-red-300 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300'
  if (s === 'PL' || s === 'IPD')
    return 'border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-800/60 dark:bg-teal-950/40 dark:text-teal-300'
  return 'border-border bg-muted text-muted-foreground'
}

function daysBadgeClass(days: number): string {
  if (days >= 90) return 'border-red-300 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300'
  if (days >= 60) return 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800/60 dark:bg-orange-950/40 dark:text-orange-300'
  if (days >= 30) return 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300'
  return 'border-border bg-muted text-muted-foreground'
}

function Field({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value || '—'}</p>
      </div>
    </div>
  )
}

interface PatientQuickViewDrawerProps {
  leadId: string | null
  teamLeadName?: string | null
  daysSinceUpload?: number | null
  uploadDate?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PatientQuickViewDrawer({
  leadId,
  teamLeadName,
  daysSinceUpload,
  uploadDate,
  open,
  onOpenChange,
}: PatientQuickViewDrawerProps) {
  const { data: lead, isLoading: leadLoading } = useQuery<LeadDetail>({
    queryKey: ['quick-view-lead', leadId],
    queryFn: () => apiGet<LeadDetail>(`/api/leads/${leadId}`),
    enabled: !!leadId && open,
  })

  const { data: stageHistory, isLoading: historyLoading } = useQuery<StageHistoryEntry[]>({
    queryKey: ['quick-view-stage-history', leadId],
    queryFn: () => apiGet<StageHistoryEntry[]>(`/api/leads/${leadId}/stage-history`),
    enabled: !!leadId && open,
  })

  const isLoading = leadLoading || historyLoading

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="space-y-3 border-b pb-4">
          <SheetTitle className="flex items-center justify-between gap-2 pr-6">
            <span className="truncate text-lg">{lead?.patientName ?? 'Patient details'}</span>
            {lead?.leadRef && (
              <Badge variant="secondary" className="font-mono shrink-0">
                {lead.leadRef}
              </Badge>
            )}
          </SheetTitle>
          {lead && (
            <div className="flex flex-wrap items-center gap-1.5 pr-6">
              <Badge variant="outline" className={cn('font-normal', pipelineBadgeClass(lead.pipelineStage))}>
                {humanizeStage(lead.pipelineStage)}
              </Badge>
              <Badge variant="outline" className="font-normal">
                {humanizeStage(lead.caseStage)}
              </Badge>
              {typeof daysSinceUpload === 'number' && (
                <Badge variant="outline" className={cn('gap-1 font-normal', daysBadgeClass(daysSinceUpload))}>
                  <Clock className="h-3 w-3" />
                  {daysSinceUpload}d since upload
                </Badge>
              )}
            </div>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading patient details…
          </div>
        ) : !lead ? (
          <div className="py-16 text-center text-muted-foreground">Unable to load patient.</div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field icon={<Phone className="h-4 w-4" />} label="Phone" value={lead.phoneNumber} />
              <Field icon={<Building2 className="h-4 w-4" />} label="Hospital" value={lead.hospitalName} />
              <Field icon={<Stethoscope className="h-4 w-4" />} label="Treatment" value={lead.treatment} />
              <Field icon={<User className="h-4 w-4" />} label="BDM" value={lead.bd?.name} />
              <Field icon={<Users className="h-4 w-4" />} label="Team Lead" value={teamLeadName} />
              <Field
                icon={<Waypoints className="h-4 w-4" />}
                label="Uploaded"
                value={uploadDate ? uploadDate.slice(0, 10) : undefined}
              />
            </div>

            <Separator />

            <div>
              <div className="mb-3 flex items-center gap-2">
                <Waypoints className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <p className="text-sm font-semibold text-foreground">
                  {lead.flowType === FlowType.CASH ? 'Cash Flow Progress' : 'Case Progress'}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                {lead.flowType === FlowType.CASH ? (
                  <CashStageProgress currentStage={lead.caseStage} />
                ) : (
                  <StageProgress
                    currentStage={lead.caseStage}
                    hasInitiateForm={!!lead.insuranceInitiateForm?.id}
                    hasIpdMark={!!lead.admissionRecord?.ipdStatus}
                    compact
                  />
                )}
              </div>
            </div>

            <Separator />

            <div>
              <div className="mb-3 flex items-center gap-2">
                <History className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <p className="text-sm font-semibold text-foreground">Stage History</p>
              </div>
              {stageHistory && stageHistory.length > 0 ? (
                <ActivityTimeline history={stageHistory} />
              ) : (
                <div className="rounded-lg border border-dashed border-border/60 py-6 text-center text-sm text-muted-foreground">
                  No stage history yet.
                </div>
              )}
            </div>

            <Button asChild variant="outline" className="w-full gap-2">
              <Link href={`/leads/${lead.id}`} target="_blank" rel="noopener noreferrer">
                Open full lead page
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}