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
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Lead {
  id: string
  leadRef?: string
  patientName?: string
  hospitalName?: string
  treatment?: string
  surgeryDate?: string
  admissionDate?: string
  dischargeDate?: string
  caseStage?: string
}

interface PlPatientDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  stageFilter: string
  dateField?: 'surgery' | 'admission' | 'discharge'
}

export function PlPatientDrawer({
  open,
  onOpenChange,
  title,
  stageFilter,
  dateField = 'surgery',
}: PlPatientDrawerProps) {
  const router = useRouter()

  const { data: patients, isLoading } = useQuery<Lead[]>({
    queryKey: ['pl', 'patients', stageFilter],
    queryFn: () => apiGet<Lead[]>(`/api/leads?caseStage=${stageFilter}&limit=500`),
    enabled: open && !!stageFilter,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[60vw] sm:max-w-[60vw] p-0 gap-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="text-lg font-bold">
            {title} {!isLoading && patients && <span className="text-muted-foreground font-normal">({patients.length})</span>}
          </SheetTitle>
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
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead Ref</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Hospital</TableHead>
                  <TableHead>Treatment</TableHead>
                  <TableHead>{dateField === 'admission' ? 'Admission' : dateField === 'discharge' ? 'Discharge' : 'Surgery'} Date</TableHead>
                  <TableHead>Stage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-teal-50/50 dark:hover:bg-teal-950/20"
                    onClick={() => router.push(`/patient/${p.id}`)}
                  >
                    <TableCell className="font-medium whitespace-nowrap">{p.leadRef || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{p.patientName || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{p.hospitalName || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{p.treatment || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.surgeryDate || p.admissionDate
                        ? new Date((p.surgeryDate || p.admissionDate) as string).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.caseStage || '—'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
