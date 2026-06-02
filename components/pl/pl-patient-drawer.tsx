'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface PatientRow {
  id: string
  leadRef?: string | null
  patientName?: string | null
  hospitalName?: string | null
  treatment?: string | null
  surgeryDate?: string | Date | null
  admissionDate?: string | Date | null
  caseStage?: string | null
}

interface PlPatientDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  patients: PatientRow[]
  dateField?: 'surgery' | 'admission' | 'discharge'
}

export function PlPatientDrawer({
  open,
  onOpenChange,
  title,
  patients,
  dateField = 'surgery',
}: PlPatientDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[60vw] sm:max-w-[60vw] p-0 gap-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="text-lg font-bold">
            {title} <span className="text-muted-foreground font-normal">({patients.length})</span>
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {patients.length === 0 ? (
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
                    onClick={() => window.open(`/patient/${p.id}`, '_self')}
                  >
                    <TableCell className="font-medium whitespace-nowrap">{p.leadRef || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{p.patientName || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{p.hospitalName || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{p.treatment || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {p.surgeryDate
                        ? new Date(p.surgeryDate as string).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : p.admissionDate
                          ? new Date(p.admissionDate as string).toLocaleDateString('en-IN', {
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
