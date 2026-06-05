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
import { CopyLeadRefButton } from '@/components/pipeline/copy-lead-ref-button'
import { cn } from '@/lib/utils'
import { resolvePlRow, formatPlDate, formatPlRupee } from '@/lib/pl/resolve-pl-row'
import { useRouter } from 'next/navigation'

interface PayoutRecord {
  id: string
  leadRef?: string
  patientName?: string
  hospitalName?: string
  plRecord?: Record<string, unknown>
}

interface PendingPayoutsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  records: PayoutRecord[]
}

export function PendingPayoutsDrawer({ open, onOpenChange, records }: PendingPayoutsDrawerProps) {
  const router = useRouter()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[90vw] sm:max-w-[90vw] p-0 gap-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="text-lg font-bold text-amber-900 dark:text-amber-100">
            Pending payouts ({records.length})
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {records.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No pending payouts
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead Ref</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>BDM</TableHead>
                  <TableHead>Hospital</TableHead>
                  <TableHead>Hospital Payout</TableHead>
                  <TableHead>Doctor Payout</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const resolved = resolvePlRow(record as unknown as Record<string, unknown>)
                  const pl = record.plRecord ?? {}
                  return (
                    <TableRow
                      key={record.id}
                      className="cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
                      onClick={() => {
                        router.push(`/patient/${record.id}`)
                      }}
                    >
                      <TableCell className="font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span>{record.leadRef ?? '—'}</span>
                          {record.leadRef && <CopyLeadRefButton leadRef={String(record.leadRef)} className="h-6 w-6" />}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{record.patientName ?? '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{resolved.bdm ?? '—'}</TableCell>
                      <TableCell className="whitespace-nowrap max-w-[180px] truncate">{resolved.hospital ?? '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={pl.hospitalPayoutStatus === 'PAID' ? 'default' : pl.hospitalPayoutStatus === 'PARTIAL' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {String(pl.hospitalPayoutStatus || 'PENDING')}
                        </Badge>
                        {pl.hospitalAmountPending != null && Number(pl.hospitalAmountPending) > 0 && (
                          <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                            {formatPlRupee(Number(pl.hospitalAmountPending))}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={pl.doctorPayoutStatus === 'PAID' ? 'default' : pl.doctorPayoutStatus === 'PARTIAL' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {String(pl.doctorPayoutStatus || 'PENDING')}
                        </Badge>
                        {pl.doctorAmountPending != null && Number(pl.doctorAmountPending) > 0 && (
                          <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                            {formatPlRupee(Number(pl.doctorAmountPending))}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={pl.mediendInvoiceStatus === 'PAID' ? 'default' : pl.mediendInvoiceStatus === 'SENT' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {String(pl.mediendInvoiceStatus || 'PENDING')}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onOpenChange(false)
                            setTimeout(() => router.push(`/patient/${record.id}`), 100)
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
      </SheetContent>
    </Sheet>
  )
}
