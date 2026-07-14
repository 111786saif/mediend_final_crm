'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import { useState, useMemo } from 'react'
import { TrendingUp, Clock, CheckCircle, XCircle, User, Building, FileText, ExternalLink, Settings, Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface IncrementRequest {
  id: string
  currentSalary: number
  requestedAmount: number | null
  reason: string
  achievements: string | null
  documents: string[] | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approvalPercentage: number | null
  hrRemarks: string | null
  createdAt: string
  employee: {
    employeeCode: string
    user: {
      name: string
      email: string
    }
    department: {
      name: string
    } | null
  }
}

const STATUS_CONFIG = {
  PENDING: { label: 'Pending', variant: 'secondary' as const, icon: Clock },
  APPROVED: { label: 'Approved', variant: 'default' as const, icon: CheckCircle },
  REJECTED: { label: 'Rejected', variant: 'destructive' as const, icon: XCircle },
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export default function HRIncrementsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const queryClient = useQueryClient()

  const { data: requests, isLoading } = useQuery<IncrementRequest[]>({
    queryKey: ['hr-increments', statusFilter],
    queryFn: () => {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : ''
      return apiGet<IncrementRequest[]>(`/api/hr/increments${params}`)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status, approvalPercentage, hrRemarks }: {
      id: string
      status: string
      approvalPercentage?: number
      hrRemarks?: string
    }) => apiPatch<IncrementRequest>(`/api/hr/increments?id=${id}`, { status, approvalPercentage, hrRemarks }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-increments'] })
      toast.success('Request updated')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update')
    },
  })

  const pendingCount = requests?.filter((r) => r.status === 'PENDING').length || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Increment Requests</h1>
          <p className="text-muted-foreground mt-1">Review and approve employee increment applications</p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="destructive" className="text-lg px-4 py-2">
            {pendingCount} Pending
          </Badge>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const count = requests?.filter((r) => r.status === key).length || 0
          const Icon = config.icon
          return (
            <Card key={key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>All Requests</CardTitle>
          <CardDescription>
            <div className="flex items-center gap-4 mt-2">
              <span>Filter by status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : requests && requests.length > 0 ? (
            <div className="space-y-4">
              {requests.map((request) => {
                const statusConfig = STATUS_CONFIG[request.status]
                const StatusIcon = statusConfig.icon
                return (
                  <div key={request.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{request.employee.user.name}</span>
                          <span className="text-sm text-muted-foreground">
                            ({request.employee.employeeCode})
                          </span>
                        </div>
                        {request.employee.department && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Building className="h-3 w-3" />
                            {request.employee.department.name}
                          </div>
                        )}
                      </div>
                      <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-muted-foreground">Current Salary:</span>
                        <p className="font-medium">{formatCurrency(request.currentSalary)}</p>
                      </div>
                      {request.requestedAmount && (
                        <div>
                          <span className="text-muted-foreground">Requested:</span>
                          <p className="font-medium">{formatCurrency(request.requestedAmount)}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Submitted:</span>
                        <p className="font-medium">{format(new Date(request.createdAt), 'PP')}</p>
                      </div>
                    </div>

                    <p className="text-sm font-medium mb-1">Reason:</p>
                    <p className="text-sm bg-muted/50 p-3 rounded mb-3">{request.reason}</p>

                    {request.achievements && (
                      <div className="mb-3">
                        <p className="text-sm font-medium mb-1">Achievements:</p>
                        <p className="text-sm bg-muted/50 p-3 rounded">{request.achievements}</p>
                      </div>
                    )}

                    {request.documents && request.documents.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-medium mb-2 flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          Supporting Documents:
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {request.documents.map((doc, i) => (
                            <a
                              key={i}
                              href={doc}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline flex items-center gap-1 bg-blue-50 px-2 py-1 rounded"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Document {i + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {request.status === 'APPROVED' && request.approvalPercentage && (
                      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                        <p className="text-sm font-medium text-green-700">
                          Approved: {request.approvalPercentage}% increment
                        </p>
                        {request.hrRemarks && (
                          <p className="text-sm text-green-600 mt-1">{request.hrRemarks}</p>
                        )}
                      </div>
                    )}

                    {request.status === 'REJECTED' && request.hrRemarks && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-sm text-red-600">{request.hrRemarks}</p>
                      </div>
                    )}

                    {request.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <ApproveDialog
                          request={request}
                          onSubmit={(approvalPercentage, hrRemarks) => updateMutation.mutate({
                            id: request.id,
                            status: 'APPROVED',
                            approvalPercentage,
                            hrRemarks,
                          })}
                          isLoading={updateMutation.isPending}
                        />
                        <RejectDialog
                          request={request}
                          onSubmit={(hrRemarks) => updateMutation.mutate({
                            id: request.id,
                            status: 'REJECTED',
                            hrRemarks,
                          })}
                          isLoading={updateMutation.isPending}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No increment requests</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Increment Policy Configuration ── */}
      <IncrementPolicyCard />
    </div>
  )
}

// ── Increment Policy Configuration Card ──────────────────────────────────────

interface TierRow { minPct: number; maxPct: number | null; incrementPct: number }

const DEFAULT_TIERS: TierRow[] = [
  { minPct: 0,   maxPct: 59,  incrementPct: 0  },
  { minPct: 60,  maxPct: 79,  incrementPct: 5  },
  { minPct: 80,  maxPct: 99,  incrementPct: 10 },
  { minPct: 100, maxPct: 119, incrementPct: 15 },
  { minPct: 120, maxPct: null, incrementPct: 20 },
]

function IncrementPolicyCard() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [localTiers, setLocalTiers] = useState<TierRow[]>([])

  const { data: settingsData } = useQuery<Record<string, string>>({
    queryKey: ['app-settings', 'increment_tiers'],
    queryFn: () => apiGet('/api/settings?keys=increment_tiers'),
  })

  const savedTiers = useMemo<TierRow[]>(() => {
    try {
      const raw = settingsData?.increment_tiers
      if (!raw) return DEFAULT_TIERS
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TIERS
    } catch { return DEFAULT_TIERS }
  }, [settingsData])

  const saveMutation = useMutation({
    mutationFn: (tiers: TierRow[]) =>
      fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'increment_tiers', value: JSON.stringify(tiers) }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings', 'increment_tiers'] })
      toast.success('Increment policy saved')
      setEditing(false)
    },
    onError: () => toast.error('Failed to save policy'),
  })

  const startEdit = () => {
    setLocalTiers(savedTiers.map((t) => ({ ...t })))
    setEditing(true)
  }

  const updateTier = (i: number, field: keyof TierRow, val: string) => {
    setLocalTiers((prev) => {
      const next = [...prev]
      if (field === 'maxPct') {
        next[i] = { ...next[i], maxPct: val === '' ? null : Number(val) }
      } else {
        next[i] = { ...next[i], [field]: Number(val) }
      }
      return next
    })
  }

  const addTier = () => {
    setLocalTiers((prev) => [...prev, { minPct: 0, maxPct: null, incrementPct: 0 }])
  }

  const removeTier = (i: number) => {
    setLocalTiers((prev) => prev.filter((_, idx) => idx !== i))
  }

  const handleSave = () => {
    // Validate: no empty incrementPct, minPct must be ascending
    for (const t of localTiers) {
      if (t.incrementPct < 0 || t.minPct < 0) {
        toast.error('Percentages must be 0 or greater')
        return
      }
    }
    saveMutation.mutate(localTiers)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">Increment Policy</CardTitle>
              <CardDescription>
                Configure the achievement-to-increment % mapping shown to employees
              </CardDescription>
            </div>
          </div>
          {!editing && (
            <Button variant="outline" size="sm" onClick={startEdit}>
              Edit policy
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!editing ? (
          // View mode
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Achievement range</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Increment %</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Eligibility</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {savedTiers.map((tier, i) => {
                  const rangeLabel = tier.maxPct === null
                    ? `≥ ${tier.minPct}%`
                    : tier.minPct === 0
                    ? `Below ${tier.maxPct + 1}%`
                    : `${tier.minPct}% – ${tier.maxPct}%`
                  return (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{rangeLabel}</td>
                      <td className="px-4 py-2.5">
                        {tier.incrementPct === 0 ? (
                          <Badge variant="secondary">Not eligible</Badge>
                        ) : (
                          <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400">
                            +{tier.incrementPct}%
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {tier.incrementPct === 0 ? 'No increment awarded' : 'Increment suggested automatically'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          // Edit mode
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Define each tier: the minimum achievement %, maximum achievement % (leave blank for "and above"), and the increment % to suggest.
            </p>
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-[1fr_1fr_1fr_40px] gap-2 px-1">
                <span className="text-xs font-medium text-muted-foreground uppercase">Min achievement %</span>
                <span className="text-xs font-medium text-muted-foreground uppercase">Max achievement %</span>
                <span className="text-xs font-medium text-muted-foreground uppercase">Increment %</span>
                <span />
              </div>
              {localTiers.map((tier, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_40px] gap-2 items-center">
                  <Input
                    type="number"
                    min={0}
                    max={999}
                    value={tier.minPct}
                    onChange={(e) => updateTier(i, 'minPct', e.target.value)}
                    placeholder="e.g. 60"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={999}
                    value={tier.maxPct ?? ''}
                    onChange={(e) => updateTier(i, 'maxPct', e.target.value)}
                    placeholder="blank = and above"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={tier.incrementPct}
                    onChange={(e) => updateTier(i, 'incrementPct', e.target.value)}
                    placeholder="e.g. 10"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTier(i)}
                    disabled={localTiers.length <= 1}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addTier} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add tier
            </Button>
            <div className="flex gap-2 pt-2 border-t">
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : 'Save policy'}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ApproveDialog({
  request,
  onSubmit,
  isLoading,
}: {
  request: IncrementRequest
  onSubmit: (approvalPercentage: number, hrRemarks?: string) => void
  isLoading: boolean
}) {
  const [approvalPercentage, setApprovalPercentage] = useState('')
  const [hrRemarks, setHrRemarks] = useState('')
  const [open, setOpen] = useState(false)

  const handleSubmit = () => {
    if (!approvalPercentage || parseFloat(approvalPercentage) <= 0) {
      toast.error('Please enter a valid increment percentage')
      return
    }
    onSubmit(parseFloat(approvalPercentage), hrRemarks || undefined)
    setOpen(false)
    setApprovalPercentage('')
    setHrRemarks('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <CheckCircle className="h-4 w-4 mr-1" />
          Approve
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve Increment</DialogTitle>
          <DialogDescription>
            Approve increment for {request.employee.user.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm mb-2">
              Current Salary: <strong>{formatCurrency(request.currentSalary)}</strong>
            </p>
            {request.requestedAmount && (
              <p className="text-sm">
                Requested Amount: <strong>{formatCurrency(request.requestedAmount)}</strong>
              </p>
            )}
          </div>
          <div>
            <Label>Approval Percentage *</Label>
            <Input
              type="number"
              value={approvalPercentage}
              onChange={(e) => setApprovalPercentage(e.target.value)}
              placeholder="e.g., 10"
              min={0}
              max={100}
            />
          </div>
          <div>
            <Label>Remarks (Optional)</Label>
            <Textarea
              value={hrRemarks}
              onChange={(e) => setHrRemarks(e.target.value)}
              placeholder="Any remarks for the employee..."
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? 'Approving...' : 'Approve'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RejectDialog({
  request,
  onSubmit,
  isLoading,
}: {
  request: IncrementRequest
  onSubmit: (hrRemarks: string) => void
  isLoading: boolean
}) {
  const [hrRemarks, setHrRemarks] = useState('')
  const [open, setOpen] = useState(false)

  const handleSubmit = () => {
    if (!hrRemarks.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }
    onSubmit(hrRemarks)
    setOpen(false)
    setHrRemarks('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          <XCircle className="h-4 w-4 mr-1" />
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Increment Request</DialogTitle>
          <DialogDescription>
            Reject increment request from {request.employee.user.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Reason for Rejection *</Label>
            <Textarea
              value={hrRemarks}
              onChange={(e) => setHrRemarks(e.target.value)}
              placeholder="Explain why the request is being rejected..."
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSubmit} disabled={isLoading || !hrRemarks.trim()}>
              {isLoading ? 'Rejecting...' : 'Reject'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}