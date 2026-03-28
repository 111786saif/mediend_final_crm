'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Scale } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

export interface LeaveBalanceEditRequestRow {
  id: string
  employeeId: string
  employeeName: string
  employeeCode: string
  department: string | null
  requestedBy: { id: string; name: string; email: string }
  previous: { CL: number; SL: number; EL: number }
  proposed: { CL: number; SL: number; EL: number }
  reason: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  reviewedBy: { id: string; name: string } | null
  reviewedAt: string | null
  reviewRemarks: string | null
}

function BalCell({ v }: { v: number }) {
  return <span className="font-mono tabular-nums text-sm">{v}</span>
}

export function MDLeaveBalanceRequestsPage() {
  const queryClient = useQueryClient()
  const [dialogRow, setDialogRow] = useState<LeaveBalanceEditRequestRow | null>(null)
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject' | null>(null)
  const [remarks, setRemarks] = useState('')

  const { data: rows = [], isLoading } = useQuery<LeaveBalanceEditRequestRow[]>({
    queryKey: ['md', 'leave-balance-edit-requests'],
    queryFn: () => apiGet<LeaveBalanceEditRequestRow[]>('/api/md/leave-balance-edit-requests'),
  })

  const pending = useMemo(() => rows.filter((r) => r.status === 'PENDING'), [rows])
  const history = useMemo(() => rows.filter((r) => r.status !== 'PENDING'), [rows])

  const decisionMutation = useMutation({
    mutationFn: (payload: { id: string; action: 'approve' | 'reject'; remarks: string | null }) =>
      apiPatch<{ message: string }>(`/api/md/leave-balance-edit-requests/${payload.id}`, {
        action: payload.action,
        remarks: payload.remarks,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['md', 'leave-balance-edit-requests'] })
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] })
      setDialogRow(null)
      setDialogAction(null)
      setRemarks('')
      toast.success(
        variables.action === 'approve' ? 'Approved and balances updated' : 'Request rejected'
      )
    },
    onError: (e: Error) => toast.error(e.message ?? 'Action failed'),
  })

  const openDialog = (row: LeaveBalanceEditRequestRow, action: 'approve' | 'reject') => {
    setDialogRow(row)
    setDialogAction(action)
    setRemarks('')
  }

  const confirmDecision = () => {
    if (!dialogRow || !dialogAction) return
    decisionMutation.mutate({
      id: dialogRow.id,
      action: dialogAction,
      remarks: remarks.trim() || null,
    })
  }

  const renderTable = (list: LeaveBalanceEditRequestRow[], showActions: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Requested by</TableHead>
          <TableHead>Previous CL/SL/EL</TableHead>
          <TableHead>Proposed CL/SL/EL</TableHead>
          <TableHead>Date</TableHead>
          {!showActions && <TableHead>Outcome</TableHead>}
          {showActions && <TableHead className="w-[200px] text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {list.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <div className="font-medium">{r.employeeName}</div>
              <div className="text-xs text-muted-foreground">
                {r.employeeCode}
                {r.department ? ` · ${r.department}` : ''}
              </div>
              {r.reason && (
                <p className="text-xs text-muted-foreground mt-1 max-w-xs line-clamp-2">{r.reason}</p>
              )}
            </TableCell>
            <TableCell>
              <div className="text-sm">{r.requestedBy.name}</div>
              <div className="text-xs text-muted-foreground">{r.requestedBy.email}</div>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                <span>CL <BalCell v={r.previous.CL} /></span>
                <span>SL <BalCell v={r.previous.SL} /></span>
                <span>EL <BalCell v={r.previous.EL} /></span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                <span>CL <BalCell v={r.proposed.CL} /></span>
                <span>SL <BalCell v={r.proposed.SL} /></span>
                <span>EL <BalCell v={r.proposed.EL} /></span>
              </div>
            </TableCell>
            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
              {format(new Date(r.createdAt), 'PPp')}
            </TableCell>
            {!showActions && (
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge variant={r.status === 'APPROVED' ? 'default' : 'destructive'} className="w-fit font-normal">
                    {r.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                  </Badge>
                  {r.reviewedBy && (
                    <span className="text-xs text-muted-foreground">by {r.reviewedBy.name}</span>
                  )}
                  {r.reviewedAt && (
                    <span className="text-xs text-muted-foreground">{format(new Date(r.reviewedAt), 'PP')}</span>
                  )}
                  {r.reviewRemarks && (
                    <span className="text-xs text-muted-foreground max-w-[200px] line-clamp-2">{r.reviewRemarks}</span>
                  )}
                </div>
              </TableCell>
            )}
            {showActions && (
              <TableCell className="text-right space-x-2">
                <Button size="sm" variant="default" onClick={() => openDialog(r, 'approve')}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => openDialog(r, 'reject')}>
                  Reject
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  return (
    <div className="container max-w-6xl py-8 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Scale className="h-8 w-8" />
          Leave balance changes
        </h1>
        <p className="text-muted-foreground mt-1.5 max-w-2xl">
          HR requests to adjust employee CL/SL/EL baselines. Approving applies the same baseline rules as a direct MD
          update (allocated = proposed, used reset to 0). Full history of decisions is below.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
          <CardDescription>Pending items need your decision. History shows all past approvals and rejections.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Tabs defaultValue="pending">
              <TabsList className="mb-4">
                <TabsTrigger value="pending">
                  Pending
                  {pending.length > 0 && (
                    <Badge variant="secondary" className="ml-2 font-normal">
                      {pending.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="history">History ({history.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="pending">
                {!pending.length ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No pending requests.</p>
                ) : (
                  renderTable(pending, true)
                )}
              </TabsContent>
              <TabsContent value="history">
                {!history.length ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No past requests yet.</p>
                ) : (
                  renderTable(history, false)
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!dialogRow && !!dialogAction}
        onOpenChange={(o) => {
          if (!o) {
            setDialogRow(null)
            setDialogAction(null)
            setRemarks('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogAction === 'approve' ? 'Approve balance change?' : 'Reject request?'}</DialogTitle>
            <DialogDescription>
              {dialogRow && (
                <>
                  {dialogRow.employeeName} ({dialogRow.employeeCode}): CL/SL/EL will move from{' '}
                  {dialogRow.previous.CL}/{dialogRow.previous.SL}/{dialogRow.previous.EL} to{' '}
                  {dialogRow.proposed.CL}/{dialogRow.proposed.SL}/{dialogRow.proposed.EL}
                  {dialogAction === 'approve' ? ' and baselines will be saved.' : '.'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="md-lb-remarks">Remarks (optional)</Label>
            <Textarea
              id="md-lb-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Note for HR audit trail…"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDialogRow(null)
                setDialogAction(null)
              }}
              disabled={decisionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={dialogAction === 'reject' ? 'destructive' : 'default'}
              onClick={confirmDecision}
              disabled={decisionMutation.isPending}
            >
              {decisionMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : dialogAction === 'approve' ? (
                'Approve'
              ) : (
                'Reject'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
