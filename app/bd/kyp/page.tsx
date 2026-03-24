'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { KYPBasicForm } from '@/components/kyp/kyp-basic-form'
import { useAuth } from '@/hooks/use-auth'
import { useLeads, type Lead } from '@/hooks/use-leads'
import { getCaseStageBadgeConfig } from '@/lib/case-stage-labels'
import { formatLeadAgeSex } from '@/lib/lead-display'
import { CaseStage } from '@/generated/prisma/enums'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

type StageFilterKey =
  | 'all'
  | 'IPD_DONE'
  | 'KYP_RAISED'
  | 'HOSPITALS_SUGGESTED'
  | 'PREAUTH_RAISED'
  | 'PREAUTH_COMPLETE'
  | 'INITIATED'
  | 'ADMITTED'
  | 'DISCHARGED'

const KYP_RAISED_STAGES: CaseStage[] = [
  CaseStage.KYP_BASIC_COMPLETE,
  CaseStage.KYP_COMPLETE,
  CaseStage.KYP_PENDING,
  CaseStage.KYP_BASIC_PENDING,
]

const CARD_DEFS: { key: Exclude<StageFilterKey, 'all' | 'KYP_RAISED'>; label: string; stage: CaseStage }[] = [
  { key: 'IPD_DONE', label: 'IPD done', stage: CaseStage.IPD_DONE },
  { key: 'HOSPITALS_SUGGESTED', label: 'Hospitals suggested', stage: CaseStage.HOSPITALS_SUGGESTED },
  { key: 'PREAUTH_RAISED', label: 'Pre-auth raised', stage: CaseStage.PREAUTH_RAISED },
  { key: 'PREAUTH_COMPLETE', label: 'Pre-auth complete', stage: CaseStage.PREAUTH_COMPLETE },
  { key: 'INITIATED', label: 'Initiated', stage: CaseStage.INITIATED },
  { key: 'ADMITTED', label: 'Admitted', stage: CaseStage.ADMITTED },
  { key: 'DISCHARGED', label: 'Discharged', stage: CaseStage.DISCHARGED },
]

function isActivePipelineLead(lead: Lead): boolean {
  const kyp = lead.kypSubmission as { id?: string } | undefined
  if (kyp?.id) return true
  return lead.caseStage !== CaseStage.NEW_LEAD
}

export default function CaseTrackerPage() {
  const { user } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [stageFilter, setStageFilter] = useState<StageFilterKey>('all')
  const [search, setSearch] = useState('')

  const leadFilters = useMemo(() => {
    if (user?.role === 'BD' && user.id) return { bdId: user.id }
    return {}
  }, [user?.role, user?.id])

  const { leads, isLoading } = useLeads(leadFilters)

  const activeLeads = useMemo(() => leads.filter(isActivePipelineLead), [leads])

  const counts = useMemo(() => {
    const base = {
      IPD_DONE: 0,
      KYP_RAISED: 0,
      HOSPITALS_SUGGESTED: 0,
      PREAUTH_RAISED: 0,
      PREAUTH_COMPLETE: 0,
      INITIATED: 0,
      ADMITTED: 0,
      DISCHARGED: 0,
    }
    for (const l of activeLeads) {
      const cs = l.caseStage as CaseStage | undefined
      if (!cs) continue
      if (cs === CaseStage.IPD_DONE) base.IPD_DONE++
      if (KYP_RAISED_STAGES.includes(cs)) base.KYP_RAISED++
      if (cs === CaseStage.HOSPITALS_SUGGESTED) base.HOSPITALS_SUGGESTED++
      if (cs === CaseStage.PREAUTH_RAISED) base.PREAUTH_RAISED++
      if (cs === CaseStage.PREAUTH_COMPLETE) base.PREAUTH_COMPLETE++
      if (cs === CaseStage.INITIATED) base.INITIATED++
      if (cs === CaseStage.ADMITTED) base.ADMITTED++
      if (cs === CaseStage.DISCHARGED) base.DISCHARGED++
    }
    return base
  }, [activeLeads])

  const filteredRows = useMemo(() => {
    let rows = activeLeads
    if (stageFilter === 'KYP_RAISED') {
      rows = rows.filter((l) => l.caseStage && KYP_RAISED_STAGES.includes(l.caseStage as CaseStage))
    } else if (stageFilter !== 'all') {
      rows = rows.filter((l) => l.caseStage === stageFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (l) =>
          String(l.patientName ?? '').toLowerCase().includes(q) ||
          String(l.leadRef ?? '').toLowerCase().includes(q) ||
          String(l.hospitalName ?? '').toLowerCase().includes(q) ||
          String(l.treatment ?? '').toLowerCase().includes(q)
      )
    }
    rows = [...rows].sort((a, b) => {
      const ta = a.createdDate ? new Date(a.createdDate as string).getTime() : 0
      const tb = b.createdDate ? new Date(b.createdDate as string).getTime() : 0
      return tb - ta
    })
    return rows
  }, [activeLeads, stageFilter, search])

  const pickerLeads = useMemo(() => leads.filter((l) => l.caseStage === CaseStage.NEW_LEAD), [leads])

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen bg-[#F2F2F7] dark:bg-background">
        <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Case tracker</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Active insurance pipeline after KYP â€” tap a card to filter
              </p>
            </div>
            <Button onClick={() => setShowForm(true)} className="shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              New case submission
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <button
              type="button"
              onClick={() => setStageFilter('all')}
              className={`rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md ${
                stageFilter === 'all' ? 'ring-2 ring-primary' : ''
              }`}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">All active</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{activeLeads.length}</p>
            </button>
            <button
              type="button"
              onClick={() => setStageFilter('IPD_DONE')}
              className={`rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md ${
                stageFilter === 'IPD_DONE' ? 'ring-2 ring-primary' : ''
              }`}
            >
              <p className="text-[11px] font-medium text-muted-foreground">IPD done</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">{counts.IPD_DONE}</p>
            </button>
            <button
              type="button"
              onClick={() => setStageFilter('KYP_RAISED')}
              className={`rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md ${
                stageFilter === 'KYP_RAISED' ? 'ring-2 ring-primary' : ''
              }`}
            >
              <p className="text-[11px] font-medium text-muted-foreground">KYP raised</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-sky-600">{counts.KYP_RAISED}</p>
            </button>
            {CARD_DEFS.filter((c) => c.key !== 'IPD_DONE').map(({ key, label, stage }) => (
              <button
                key={key}
                type="button"
                onClick={() => setStageFilter(key)}
                className={`rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md ${
                  stageFilter === key ? 'ring-2 ring-primary' : ''
                }`}
              >
                <p className="line-clamp-2 text-[11px] font-medium text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{counts[key as keyof typeof counts]}</p>
              </button>
            ))}
          </div>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Leads</CardTitle>
                  <CardDescription>
                    {filteredRows.length} shown Â· {activeLeads.length} in active pipeline
                  </CardDescription>
                </div>
                <div className="relative max-w-sm flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Searchâ€¦" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="py-10 text-center text-muted-foreground">Loadingâ€¦</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Lead ref</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Age/Sex</TableHead>
                        <TableHead>Circle</TableHead>
                        <TableHead>Treatment</TableHead>
                        <TableHead>BDM</TableHead>
                        <TableHead>Hospital</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead className="w-[100px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                            No leads match
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRows.map((lead) => {
                          const cfg = lead.caseStage ? getCaseStageBadgeConfig(String(lead.caseStage)) : null
                          const d = lead.leadDate || lead.createdDate
                          return (
                            <TableRow
                              key={lead.id}
                              className="cursor-pointer"
                              onClick={() => router.push(`/patient/${lead.id}`)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-0.5">
                                  <span className="font-medium">{lead.leadRef}</span>
                                  {lead.leadRef && <CopyLeadRefButton leadRef={String(lead.leadRef)} />}
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                {d ? format(new Date(d as string), 'MMM d, yyyy') : 'â€”'}
                              </TableCell>
                              <TableCell>{lead.patientName}</TableCell>
                              <TableCell className="whitespace-nowrap text-sm">{formatLeadAgeSex(lead)}</TableCell>
                              <TableCell>{typeof lead.circle === 'string' ? lead.circle : '—'}</TableCell>
                              <TableCell className="max-w-[140px] truncate">{lead.treatment ?? 'â€”'}</TableCell>
                              <TableCell className="max-w-[120px] truncate">
                                {(lead.plRecord?.bdmName ?? '').trim() || '—'}
                              </TableCell>
                              <TableCell className="max-w-[160px] truncate">{lead.hospitalName}</TableCell>
                              <TableCell>
                                {cfg ? (
                                  <Badge variant="secondary" className={cfg.className}>
                                    {cfg.label}
                                  </Badge>
                                ) : (
                                  'â€”'
                                )}
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Button size="sm" variant="outline" asChild>
                                  <Link href={`/patient/${lead.id}`}>Open</Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New case submission</DialogTitle>
                <DialogDescription>Select a new lead, then submit card details.</DialogDescription>
              </DialogHeader>
              {!selectedLeadId ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {pickerLeads.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No new leads available.</p>
                  ) : (
                    pickerLeads.map((lead) => (
                      <Button
                        key={lead.id}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => setSelectedLeadId(lead.id)}
                      >
                        {lead.leadRef} â€” {lead.patientName}
                      </Button>
                    ))
                  )}
                </div>
              ) : (
                (() => {
                  const selectedLead = leads.find((l) => l.id === selectedLeadId)
                  return (
                    <KYPBasicForm
                      leadId={selectedLeadId}
                      initialPatientName={selectedLead?.patientName}
                      initialPhone={selectedLead?.phoneNumber}
                      initialDob={(() => {
                        const dob = (selectedLead as { dateOfBirth?: string } | undefined)?.dateOfBirth
                        return dob ? format(new Date(dob), 'yyyy-MM-dd') : undefined
                      })()}
                      onSuccess={() => {
                        setShowForm(false)
                        setSelectedLeadId(null)
                        queryClient.invalidateQueries({ queryKey: ['kyp-submissions'] })
                        queryClient.invalidateQueries({ queryKey: ['leads'] })
                      }}
                      onCancel={() => {
                        setShowForm(false)
                        setSelectedLeadId(null)
                      }}
                    />
                  )
                })()
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </AuthenticatedLayout>
  )
}


