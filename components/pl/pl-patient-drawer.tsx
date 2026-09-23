'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { resolveLeadHospitalDoctor, formatLeadAgeSex } from '@/lib/lead-display'
import { Loader2, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMemo, useState, useEffect } from 'react'

interface Lead {
  id: number
  leadRef?: string
  patientName?: string
  hospitalName?: string
  treatment?: string
  surgeryDate?: string
  admissionDate?: string
  dischargeDate?: string
  caseStage?: string
  age?: number | null
  sex?: string | null
  circle?: string | null
  ipdDrName?: string | null
  surgeonName?: string | null
  admissionRecord?: { admissionDate?: string; surgeryDate?: string } | null
  dischargeSheet?: { dischargeDate?: string; hospitalName?: string; doctorName?: string } | null
  plRecord?: { hospitalName?: string; doctorName?: string } | null
  kypSubmission?: {
    preAuthData?: {
      requestedHospitalName?: string
      suggestedHospitals?: Array<{ hospitalName?: string; suggestedDoctor?: string }>
      hospitalNameSuggestion?: string
      hospitalSuggestions?: unknown[]
    }
  } | null
}

interface PlPatientDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  stageFilter: string
  dateField?: 'surgery' | 'admission' | 'discharge'
  startDate?: string
  endDate?: string
}

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

export function PlPatientDrawer({
  open,
  onOpenChange,
  title,
  stageFilter,
  dateField = 'surgery',
  startDate,
  endDate,
}: PlPatientDrawerProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 250)

  const { data: patients, isLoading } = useQuery<Lead[]>({
    queryKey: ['pl', 'patients', stageFilter, startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams({ caseStage: stageFilter })
      return apiGet<Lead[]>(`/api/leads?${params.toString()}`)
    },
    enabled: open && !!stageFilter,
  })

  const inRangeFiltered = useMemo(() => {
    if (!patients) return []
    let result = patients

    if (startDate || endDate) {
      const rangeStart = startDate ? new Date(startDate) : null
      const rangeEnd = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : null

      result = result.filter((p) => {
        let raw: string | undefined
        if (dateField === 'admission') {
          raw = p.admissionRecord?.admissionDate
        } else if (dateField === 'discharge') {
          raw = p.dischargeSheet?.dischargeDate
        } else {
          raw = p.surgeryDate ?? p.admissionRecord?.surgeryDate
        }
        if (!raw) return false
        const d = new Date(raw)
        if (Number.isNaN(d.getTime())) return false
        if (rangeStart && d < rangeStart) return false
        if (rangeEnd && d > rangeEnd) return false
        return true
      })
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter((p) => {
        const { hospital, doctor } = resolveLeadHospitalDoctor(p)
        return (
          String(p.patientName ?? '').toLowerCase().includes(q) ||
          String(p.leadRef ?? '').toLowerCase().includes(q) ||
          String(p.treatment ?? '').toLowerCase().includes(q) ||
          String(hospital ?? '').toLowerCase().includes(q) ||
          String(doctor ?? '').toLowerCase().includes(q)
        )
      })
    }

    return result
  }, [patients, startDate, endDate, dateField, debouncedSearch])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[80vw] sm:max-w-[80vw] p-0 gap-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between gap-4">
            <SheetTitle className="text-lg font-bold">
              {title}{' '}
              {!isLoading && patients && (
                <span className="text-muted-foreground font-normal">({inRangeFiltered.length})</span>
              )}
            </SheetTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-9"
                placeholder="Search patients…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !patients || patients.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No patients found
            </div>
          ) : inRangeFiltered.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No patients in selected date range
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead Ref</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Age/Sex</TableHead>
                  <TableHead>Hospital</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Treatment</TableHead>
                  <TableHead>Circle</TableHead>
                  <TableHead>
                    {dateField === 'admission' ? 'Admission' : dateField === 'discharge' ? 'Discharge' : 'Surgery'} Date
                  </TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {inRangeFiltered.map((p) => {
                  const { hospital, doctor } = resolveLeadHospitalDoctor(p)
                  return (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover:bg-teal-50/50 dark:hover:bg-teal-950/20"
                      onClick={() => router.push(`/patient/${p.id}`)}
                    >
                      <TableCell className="font-medium whitespace-nowrap">{p.leadRef || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{p.patientName || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatLeadAgeSex(p)}</TableCell>
                      <TableCell className="whitespace-nowrap max-w-[180px] truncate">{hospital || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap max-w-[160px] truncate">{doctor || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap max-w-[140px] truncate">{p.treatment || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{typeof p.circle === 'string' ? p.circle : '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {(dateField === 'admission'
                          ? p.admissionRecord?.admissionDate
                          : dateField === 'discharge'
                            ? p.dischargeSheet?.dischargeDate
                            : p.surgeryDate
                        )
                          ? new Date(
                              (dateField === 'admission'
                                ? p.admissionRecord?.admissionDate
                                : dateField === 'discharge'
                                  ? p.dischargeSheet?.dischargeDate
                                  : p.surgeryDate) as string
                            ).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.caseStage || '—'}</Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onOpenChange(false)
                            setTimeout(() => router.push(`/patient/${p.id}`), 100)
                          }}
                        >
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="px-6 py-3 border-t shrink-0 text-xs text-muted-foreground">
          <Button variant="outline" size="sm" onClick={() => setSearch('')}>
            Clear search
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
