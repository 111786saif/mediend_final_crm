'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { apiGet, apiPost, apiDelete } from '@/lib/api-client'
import { formatPlDate, formatPlRupee } from '@/lib/pl/resolve-pl-row'

type Recipient = 'HOSPITAL' | 'DOCTOR' | 'MEDIEND'
type Mode = 'CASH' | 'UPI' | 'NEFT' | 'RTGS' | 'CHEQUE' | 'CARD' | 'OTHER'

type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'

type Installment = {
  id: string
  leadId: string
  recipient: Recipient
  amount: number
  paidOn: string
  mode: Mode | null
  reference: string | null
  notes: string | null
  verificationStatus?: VerificationStatus
  rejectionRemarks?: string | null
  recordedBy?: { id: string; name: string } | null
  createdAt: string
}

const RECIPIENTS: Recipient[] = ['HOSPITAL', 'DOCTOR', 'MEDIEND']
const MODES: Mode[] = ['CASH', 'UPI', 'NEFT', 'RTGS', 'CHEQUE', 'CARD', 'OTHER']

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

interface Props {
  leadId: string
  lockRecipient?: Recipient
  doctorName?: string | null
  hospitalName?: string | null
  /** When false, hide add/delete form (Finance read-only). Default true. */
  canWrite?: boolean
}

export function PaymentInstallmentsCard({
  leadId,
  lockRecipient,
  doctorName,
  hospitalName,
  canWrite = true,
}: Props) {
  const queryClient = useQueryClient()
  const [paidOn, setPaidOn] = useState(todayYmd())
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState<Recipient>(lockRecipient ?? 'MEDIEND')
  const [mode, setMode] = useState<Mode | ''>('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const { data: rows, isLoading } = useQuery<Installment[]>({
    queryKey: ['installments', leadId],
    queryFn: () => apiGet<Installment[]>(`/api/installments?leadId=${leadId}`),
    enabled: !!leadId,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiPost(`/api/installments`, {
        leadId,
        recipient,
        amount: parseFloat(amount),
        paidOn: new Date(paidOn).toISOString(),
        mode: mode || null,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      })
    },
    onSuccess: () => {
      toast.success('Installment recorded')
      setAmount('')
      setReference('')
      setNotes('')
      setMode('')
      queryClient.invalidateQueries({ queryKey: ['installments', leadId] })
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['outstanding'] })
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Failed to record installment')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiDelete(`/api/installments/${id}`),
    onSuccess: () => {
      toast.success('Installment removed')
      queryClient.invalidateQueries({ queryKey: ['installments', leadId] })
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['outstanding'] })
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to delete'),
  })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter an amount greater than 0')
      return
    }
    if (!paidOn) {
      toast.error('Pick a payment date')
      return
    }
    if (!mode) {
      toast.error('Please select a payment mode')
      return
    }
    createMutation.mutate()
  }

  // Outstanding uses Finance-verified amounts only (pending MediEND receipts excluded).
  const totals = (rows ?? []).reduce(
    (acc, r) => {
      if ((r.verificationStatus ?? 'VERIFIED') !== 'VERIFIED') return acc
      acc[r.recipient] = (acc[r.recipient] ?? 0) + r.amount
      return acc
    },
    { HOSPITAL: 0, DOCTOR: 0, MEDIEND: 0 } as Record<Recipient, number>
  )

  return (
    <Card className="overflow-hidden border-violet-200/50 shadow-sm dark:border-violet-800/35">
      <CardHeader className="border-b bg-gradient-to-r from-violet-500/10 to-fuchsia-500/8">
        <CardTitle className="text-violet-950 dark:text-violet-100">Payment Installments</CardTitle>
        <CardDescription>
          MediEND receipts stay pending until Finance verifies them. Only verified amounts reduce
          outstanding.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <TotalTile label="Hospital paid" amount={totals.HOSPITAL} />
          <TotalTile label="Doctor paid" amount={totals.DOCTOR} />
          <TotalTile label="MediEND received" amount={totals.MEDIEND} />
        </div>

        {canWrite && (
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
            <div className="sm:col-span-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="mt-1" />
            </div>
            <div className="sm:col-span-1">
              <Label className="text-xs">Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-1">
              <Label className="text-xs">Recipient</Label>
              <Select
                value={recipient}
                onValueChange={(v) => setRecipient(v as Recipient)}
                disabled={!!lockRecipient}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECIPIENTS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r === 'HOSPITAL' && hospitalName ? `HOSPITAL (${hospitalName})` :
                       r === 'DOCTOR' && doctorName ? `DOCTOR (${doctorName})` : r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-1">
              <Label className="text-xs">
                Mode <span className="text-destructive">*</span>
              </Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  {MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-1">
              <Label className="text-xs">Reference</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="UTR / cheque"
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-1">
              <Button type="submit" disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Add
              </Button>
            </div>
            <div className="sm:col-span-6">
              <Label className="text-xs">Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional context"
                className="mt-1"
              />
            </div>
          </form>
        )}

        <div className="border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Loading installments…
            </div>
          ) : !rows || rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No installments recorded yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Recipient</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Mode</th>
                  <th className="px-3 py-2 text-left">Reference</th>
                  <th className="px-3 py-2 text-left">Notes</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">By</th>
                  {canWrite && <th className="px-3 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const status = r.verificationStatus ?? 'VERIFIED'
                  return (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatPlDate(new Date(r.paidOn))}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">
                        {r.recipient === 'HOSPITAL' && hospitalName ? `HOSPITAL (${hospitalName})` :
                         r.recipient === 'DOCTOR' && doctorName ? `DOCTOR (${doctorName})` : r.recipient}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatPlRupee(r.amount)}
                    </td>
                    <td className="px-3 py-2">{r.mode ?? '—'}</td>
                    <td className="px-3 py-2">{r.reference ?? '—'}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate" title={r.notes ?? ''}>
                      {r.notes ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          status === 'VERIFIED'
                            ? 'default'
                            : status === 'REJECTED'
                              ? 'destructive'
                              : 'outline'
                        }
                        title={r.rejectionRemarks ?? undefined}
                      >
                        {status === 'PENDING'
                          ? 'Pending Finance'
                          : status === 'REJECTED'
                            ? 'Rejected'
                            : 'Verified'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.recordedBy?.name ?? '—'}
                    </td>
                    {canWrite && (
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => deleteMutation.mutate(r.id)}
                          disabled={deleteMutation.isPending}
                          aria-label="Delete installment"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </td>
                    )}
                  </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function TotalTile({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="rounded-lg border border-violet-200/40 bg-gradient-to-br from-violet-50/60 to-card p-3 dark:border-violet-800/30 dark:from-violet-950/20">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{formatPlRupee(amount)}</div>
    </div>
  )
}
