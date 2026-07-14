'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { useTabPermissions } from '@/hooks/use-tab-permissions'
import { PermissionsGuard } from '@/components/permissions-guard'
import { cn } from '@/lib/utils'
import { useQuery as usePermissionQuery } from '@tanstack/react-query'
import { Check, X, ChevronLeft, ChevronRight, Plus, CheckCircle, Clock, Paperclip, LayoutGrid, LayoutList, Filter, Search } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useSwipeable } from 'react-swipeable'
import confetti from 'canvas-confetti'
import { motion, AnimatePresence } from 'framer-motion'
import { AttachmentCarousel } from '@/components/finance/attachment-carousel'
import { Skeleton } from '@/components/ui/skeleton'
import { useIsMobile } from '@/hooks/use-mobile'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Checkbox } from '@/components/ui/checkbox'

interface Attachment {
  name: string
  url: string
  type: string
}

interface MDApprovalRequest {
  id: string
  title: string
  description: string | null
  amount: number | null
  attachments?: Attachment[] | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  requestedById: string
  requestedBy: { id: string; name: string; email: string }
  respondedBy?: { id: string; name: string } | null
  responseNote: string | null
  respondedAt: string | null
  financeAcknowledged: boolean
  financeAcknowledgedBy?: { id: string; name: string } | null
  financeAcknowledgedAt: string | null
  createdAt: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function SwipeCard({
  request,
  onApprove,
  onReject,
}: {
  request: MDApprovalRequest
  onApprove: () => void
  onReject: () => void
}) {
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null)
  const [swipeOffset, setSwipeOffset] = useState(0)

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      setSwipeOffset(eventData.deltaX)
      if (eventData.deltaX > 50) setSwipeDirection('right')
      else if (eventData.deltaX < -50) setSwipeDirection('left')
      else setSwipeDirection(null)
    },
    onSwiped: (eventData) => {
      if (eventData.deltaX > 100) onApprove()
      else if (eventData.deltaX < -100) onReject()
      setSwipeOffset(0)
      setSwipeDirection(null)
    },
    trackMouse: true,
  })

  const bg =
    swipeDirection === 'right'
      ? 'bg-indigo-100 dark:bg-indigo-900/20'
      : swipeDirection === 'left'
      ? 'bg-red-100 dark:bg-red-900/20'
      : 'bg-white dark:bg-slate-800'

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 left-0 w-16 bg-indigo-500/20 flex items-center justify-center">
        <ChevronRight className={`h-8 w-8 text-indigo-600 transition-opacity ${swipeDirection === 'right' ? 'opacity-100' : 'opacity-30'}`} />
      </div>
      <div className="absolute inset-y-0 right-0 w-16 bg-red-500/20 flex items-center justify-center">
        <ChevronLeft className={`h-8 w-8 text-red-600 transition-opacity ${swipeDirection === 'left' ? 'opacity-100' : 'opacity-30'}`} />
      </div>

      <div {...handlers} className={`transition-all duration-200 ${bg}`} style={{ transform: `translateX(${swipeOffset}px)` }}>
        <Card className="border-2 border-indigo-200 dark:border-indigo-800 cursor-grab active:cursor-grabbing">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                Pending
              </Badge>
              <span className="text-sm text-muted-foreground">{format(new Date(request.createdAt), 'dd MMM yyyy')}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <h3 className="font-semibold text-lg">{request.title}</h3>
            {request.description && <p className="text-sm text-muted-foreground">{request.description}</p>}
            {request.amount != null && (
              <div className="text-xl font-bold text-indigo-600">{formatCurrency(request.amount)}</div>
            )}
            {request.attachments && request.attachments.length > 0 && (
              <AttachmentCarousel attachments={request.attachments} />
            )}
            <div className="text-sm text-muted-foreground">Requested by {request.requestedBy.name}</div>

            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="destructive" className="flex-1" onClick={onReject}>
                <X className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button size="sm" className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={onApprove}>
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">Swipe right to approve • Swipe left to reject</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function PendingCard({ request }: { request: MDApprovalRequest }) {
  return (
    <Card className="border-2 border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
            <Clock className="h-3 w-3 mr-1" />
            Awaiting MD Review
          </Badge>
          <span className="text-sm text-muted-foreground">{format(new Date(request.createdAt), 'dd MMM yyyy')}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <h3 className="font-semibold text-lg">{request.title}</h3>
        {request.description && <p className="text-sm text-muted-foreground">{request.description}</p>}
        {request.amount != null && (
          <div className="text-xl font-bold text-indigo-600">{formatCurrency(request.amount)}</div>
        )}
        {request.attachments && request.attachments.length > 0 && (
          <AttachmentCarousel attachments={request.attachments} />
        )}
        <p className="text-sm text-muted-foreground">Submitted on {format(new Date(request.createdAt), 'dd MMM yyyy, HH:mm')}</p>
      </CardContent>
    </Card>
  )
}

function HistoryCard({ request }: { request: MDApprovalRequest }) {
  const isApproved = request.status === 'APPROVED'
  const needsFinanceAck = isApproved && request.amount != null && !request.financeAcknowledged

  return (
    <Card
      className={`border-2 ${
        isApproved
          ? 'border-indigo-200 bg-indigo-50/50 dark:bg-indigo-900/10 dark:border-indigo-800'
          : 'border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-800'
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Badge className={isApproved ? 'bg-indigo-100 text-indigo-800' : 'bg-red-100 text-red-800'}>
              {isApproved ? 'Approved' : 'Rejected'}
            </Badge>
            {needsFinanceAck && (
              <Badge variant="outline" className="flex items-center gap-1 text-amber-600 border-amber-300">
                <Clock className="h-3 w-3" />
                Awaiting Finance
              </Badge>
            )}
            {isApproved && request.amount != null && request.financeAcknowledged && (
              <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-300">
                <CheckCircle className="h-3 w-3" />
                Finance Ack
              </Badge>
            )}
          </div>
          <span className="text-sm text-muted-foreground">{format(new Date(request.createdAt), 'dd MMM yyyy')}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <h3 className="font-semibold">{request.title}</h3>
        {request.description && <p className="text-sm text-muted-foreground">{request.description}</p>}
        {request.amount != null && <div className="font-medium text-indigo-600">{formatCurrency(request.amount)}</div>}
        {request.attachments && request.attachments.length > 0 && (
          <AttachmentCarousel attachments={request.attachments} />
        )}
        <p className="text-xs text-muted-foreground">Requested by {request.requestedBy.name}</p>
        {request.respondedBy && request.respondedAt && (
          <div className="pt-2 mt-2 border-t border-border/50 space-y-1">
            <p className="text-xs text-muted-foreground">
              {request.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {request.respondedBy.name} on{' '}
              {format(new Date(request.respondedAt), 'dd MMM yyyy, HH:mm')}
            </p>
            {request.responseNote && (
              <p className="text-sm text-muted-foreground italic">&ldquo;{request.responseNote}&rdquo;</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PendingSkeleton() {
  return (
    <Card className="border-2 border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-8 w-32" />
      </CardContent>
    </Card>
  )
}

export default function MDApprovalsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState('pending')

  const staticTabs = useMemo(
    () => [
      { value: 'pending', label: 'Pending', perm: 'myhrms.ask_md_approval.pending' },
      { value: 'history', label: 'History', perm: 'myhrms.ask_md_approval.history' },
    ],
    []
  )

  const { allowedTabs, isLoading: isPermsLoading } = useTabPermissions(staticTabs, activeTab, setActiveTab)

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [requestOpen, setRequestOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<MDApprovalRequest | null>(null)
  const [responseNote, setResponseNote] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'APPROVED' | 'REJECTED'>('all')
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')
  const [historyPeopleFilter, setHistoryPeopleFilter] = useState<string[]>([])
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)

  const isMD = user?.role === 'MD' || user?.role === 'ADMIN'

  const { data: canRequest } = usePermissionQuery({
    queryKey: ['permission-md-approval-request'],
    queryFn: () => apiGet<{ allowed: boolean }>('/api/permissions/check?feature=md_approval_request'),
  })

  const { data: requests = [], isLoading } = useQuery<MDApprovalRequest[]>({
    queryKey: ['md-approvals'],
    queryFn: () => apiGet<MDApprovalRequest[]>('/api/md-approvals'),
  })

  const pending = requests.filter((r) => r.status === 'PENDING')
  const history = requests.filter((r) => r.status !== 'PENDING')

  const uniqueRequesters = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of history) map.set(r.requestedBy.id, r.requestedBy.name)
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [history])

  const filteredHistory = useMemo(() => {
    let result = history
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase()
      result = result.filter(r => r.title.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.requestedBy.name.toLowerCase().includes(q))
    }
    if (historyStatusFilter !== 'all') {
      result = result.filter(r => r.status === historyStatusFilter)
    }
    if (historyDateFrom) {
      result = result.filter(r => r.createdAt >= historyDateFrom)
    }
    if (historyDateTo) {
      const to = historyDateTo + 'T23:59:59'
      result = result.filter(r => r.createdAt <= to)
    }
    if (historyPeopleFilter.length > 0) {
      result = result.filter(r => historyPeopleFilter.includes(r.requestedBy.id))
    }
    return result
  }, [history, historySearch, historyStatusFilter, historyDateFrom, historyDateTo, historyPeopleFilter])

  const activeFilterCount = [
    historyStatusFilter !== 'all',
    historyDateFrom !== '',
    historyDateTo !== '',
    historyPeopleFilter.length > 0,
  ].filter(Boolean).length

  // Mobile: cards only. Desktop: grid default, user can toggle to table.
  useEffect(() => {
    if (isMobile) setViewMode('grid')
  }, [isMobile])

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      apiPatch(`/api/md-approvals/${id}`, { status: 'APPROVED', responseNote: note }),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['md-approvals'] })
      const prev = queryClient.getQueryData<MDApprovalRequest[]>(['md-approvals'])
      queryClient.setQueryData<MDApprovalRequest[]>(['md-approvals'], (old) =>
        (old ?? []).map((r) =>
          r.id === id ? { ...r, status: 'APPROVED' as const } : r
        )
      )
      return { prev }
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['md-approvals'], ctx.prev)
      toast.error(err.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['md-approvals'] })
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] })
      setApproveDialogOpen(false)
      setSelectedRequest(null)
      setResponseNote('')
      confetti({ particleCount: 80, spread: 60 })
      toast.success('Approved')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      apiPatch(`/api/md-approvals/${id}`, { status: 'REJECTED', responseNote: note }),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['md-approvals'] })
      const prev = queryClient.getQueryData<MDApprovalRequest[]>(['md-approvals'])
      queryClient.setQueryData<MDApprovalRequest[]>(['md-approvals'], (old) =>
        (old ?? []).map((r) =>
          r.id === id ? { ...r, status: 'REJECTED' as const } : r
        )
      )
      return { prev }
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['md-approvals'], ctx.prev)
      toast.error(err.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['md-approvals'] })
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] })
      setRejectDialogOpen(false)
      setSelectedRequest(null)
      setResponseNote('')
      toast.success('Rejected')
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: { title: string; description?: string; amount?: number; attachments?: Attachment[] }) =>
      apiPost('/api/md-approvals', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['md-approvals'] })
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] })
      setRequestOpen(false)
      setTitle('')
      setDescription('')
      setAmount('')
      setAttachments([])
      toast.success('Request submitted')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleApprove = () => {
    if (selectedRequest) {
      approveMutation.mutate({ id: selectedRequest.id, note: responseNote || undefined })
    }
  }

  const handleReject = () => {
    if (selectedRequest) {
      rejectMutation.mutate({ id: selectedRequest.id, note: responseNote || undefined })
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploadingFiles(true)
    try {
      const newAttachments: Attachment[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/md-approvals/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Upload failed')
        newAttachments.push({
          name: file.name,
          url: data.data.url,
          type: file.type,
        })
      }
      setAttachments((prev) => [...prev, ...newAttachments])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingFiles(false)
      e.target.value = ''
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleCreate = () => {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      amount: amount ? parseFloat(amount) : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    })
  }

  return (
    <PermissionsGuard
      isLoading={isPermsLoading}
      hasAccess={allowedTabs.length > 0}
      resourceName="MD Team Approvals"
      variant="page"
    >
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">MD Team Approvals</h1>
        <div className="flex items-center gap-2">
          {!isMobile && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
            >
              {viewMode === 'grid' ? (
                <>
                  <LayoutList className="h-4 w-4 mr-2" />
                  Table View
                </>
              ) : (
                <>
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Grid View
                </>
              )}
            </Button>
          )}
          {canRequest?.allowed && !isMD && (
          <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Request Approval
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request MD Approval</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Title *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Request title" />
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details..." rows={3} />
                </div>
                <div>
                  <Label>Amount (optional)</Label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label>Attachments (optional)</Label>
                  <Input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                    disabled={uploadingFiles}
                    className="cursor-pointer"
                  />
                  {uploadingFiles && <p className="text-xs text-muted-foreground mt-1">Uploading...</p>}
                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {attachments.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <Paperclip className="h-4 w-4" />
                          <span className="truncate flex-1">{a.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-destructive"
                            onClick={() => removeAttachment(i)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={cn("grid w-full max-w-md", allowedTabs.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {allowedTabs.map((t) => {
            if (t.value === 'pending') {
              return (
                <TabsTrigger key={t.value} value="pending" className="relative">
                  Pending
                  {pending.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1.5 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                      {pending.length}
                    </Badge>
                  )}
                </TabsTrigger>
              )
            }
            return (
              <TabsTrigger key={t.value} value="history">
                History
                {history.length > 0 && (
                  <span className="ml-2 text-muted-foreground text-sm">({history.length})</span>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <PendingSkeleton key={i} />
              ))}
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Check className="h-14 w-14 mx-auto mb-4 opacity-40" />
              <p className="font-medium">{isMD ? 'All caught up' : 'No pending requests'}</p>
              <p className="text-sm mt-1">{isMD ? 'No requests awaiting your approval' : 'Your submitted requests will appear here until MD responds'}</p>
            </div>
          ) : viewMode === 'table' ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Attachments</TableHead>
                    {isMD && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{req.title}</div>
                          {req.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">{req.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{req.requestedBy.name}</TableCell>
                      <TableCell className="font-semibold text-indigo-600">
                        {req.amount != null ? formatCurrency(req.amount) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(req.createdAt), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        {req.attachments && req.attachments.length > 0 ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Paperclip className="h-4 w-4" />
                            <span>{req.attachments.length}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      {isMD && (
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedRequest(req)
                                setRejectDialogOpen(true)
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="bg-indigo-600 hover:bg-indigo-700"
                              onClick={() => {
                                setSelectedRequest(req)
                                setApproveDialogOpen(true)
                              }}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className={isMobile ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
              <AnimatePresence mode="popLayout">
                {pending.map((req) => (
                  <motion.div
                    key={req.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    {isMD ? (
                      <SwipeCard
                        request={req}
                        onApprove={() => {
                          setSelectedRequest(req)
                          setApproveDialogOpen(true)
                        }}
                        onReject={() => {
                          setSelectedRequest(req)
                          setRejectDialogOpen(true)
                        }}
                      />
                    ) : (
                      <PendingCard request={req} />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search history..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                  <Filter className="h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge className="h-5 min-w-5 px-1.5 bg-indigo-600 text-white">{activeFilterCount}</Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-80 sm:w-96 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filter History</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 mt-6">
                  {/* Status */}
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</Label>
                    <div className="flex gap-2 mt-2">
                      {(['all', 'APPROVED', 'REJECTED'] as const).map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant={historyStatusFilter === s ? 'default' : 'outline'}
                          onClick={() => setHistoryStatusFilter(s)}
                          className={historyStatusFilter === s && s === 'APPROVED' ? 'bg-indigo-600 hover:bg-indigo-700' : historyStatusFilter === s && s === 'REJECTED' ? 'bg-red-600 hover:bg-red-700' : ''}
                        >
                          {s === 'all' ? 'All' : s === 'APPROVED' ? 'Approved' : 'Rejected'}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Date Range */}
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date Range</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <Label className="text-xs">From</Label>
                        <Input type="date" value={historyDateFrom} onChange={(e) => setHistoryDateFrom(e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">To</Label>
                        <Input type="date" value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)} className="mt-1" />
                      </div>
                    </div>
                  </div>

                  {/* People */}
                  {uniqueRequesters.length > 0 && (
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Requested By</Label>
                      <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
                        {uniqueRequesters.map(([id, name]) => (
                          <label key={id} className="flex items-center gap-2 cursor-pointer text-sm">
                            <Checkbox
                              checked={historyPeopleFilter.includes(id)}
                              onCheckedChange={(checked) => {
                                setHistoryPeopleFilter((prev) =>
                                  checked ? [...prev, id] : prev.filter((p) => p !== id)
                                )
                              }}
                            />
                            {name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clear */}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setHistoryStatusFilter('all')
                      setHistoryDateFrom('')
                      setHistoryDateTo('')
                      setHistoryPeopleFilter([])
                    }}
                  >
                    Clear all filters
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Clock className="h-14 w-14 mx-auto mb-4 opacity-40" />
              <p className="font-medium">{history.length === 0 ? 'No history yet' : 'No results match your filters'}</p>
              <p className="text-sm mt-1">{history.length === 0 ? (isMD ? 'Approved and rejected requests will appear here' : 'Your approved or rejected requests will appear here') : 'Try adjusting your search or filters'}</p>
            </div>
          ) : viewMode === 'table' ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Responded</TableHead>
                    <TableHead>Attachments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{req.title}</div>
                          {req.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">{req.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{req.requestedBy.name}</TableCell>
                      <TableCell className="font-semibold text-indigo-600">
                        {req.amount != null ? formatCurrency(req.amount) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={req.status === 'APPROVED' ? 'bg-indigo-100 text-indigo-800' : 'bg-red-100 text-red-800'}>
                          {req.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                        </Badge>
                        {req.status === 'APPROVED' && req.amount != null && !req.financeAcknowledged && (
                          <Badge variant="outline" className="ml-1 text-amber-600 border-amber-300">
                            Awaiting Finance
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {req.respondedAt && req.respondedBy
                          ? `${req.respondedBy.name} on ${format(new Date(req.respondedAt), 'dd MMM yyyy, HH:mm')}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {req.attachments && req.attachments.length > 0 ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Paperclip className="h-4 w-4" />
                            <span>{req.attachments.length}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className={isMobile ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
              <AnimatePresence mode="popLayout">
                {filteredHistory.map((req, i) => (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    <HistoryCard request={req} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve request</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <p className="font-medium">{selectedRequest.title}</p>
              <div>
                <Label>Note (optional)</Label>
                <Textarea value={responseNote} onChange={(e) => setResponseNote(e.target.value)} rows={2} />
              </div>
              <Button onClick={handleApprove} disabled={approveMutation.isPending} className="w-full bg-indigo-600 hover:bg-indigo-700">
                Confirm Approve
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <p className="font-medium">{selectedRequest.title}</p>
              <div>
                <Label>Reason (optional)</Label>
                <Textarea value={responseNote} onChange={(e) => setResponseNote(e.target.value)} rows={2} />
              </div>
              <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending} className="w-full">
                Confirm Reject
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </PermissionsGuard>
  )
}
