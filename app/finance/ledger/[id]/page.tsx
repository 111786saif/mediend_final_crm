'use client'

import { use, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { ArrowLeft, Calendar as CalendarIcon, ArrowUpCircle, ArrowDownCircle, AlertCircle, Clock, CheckCircle2, XCircle, Trash2, Edit, Save, X, Eye, FileText, ImageIcon, ExternalLink, Paperclip, Check, Calendar, User } from 'lucide-react'
import { AttachmentCarousel } from '@/components/finance/attachment-carousel'
import { format } from 'date-fns'
import Link from 'next/link'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

interface AuditLog {
  id: string
  action: 'CREATED' | 'UPDATED' | 'APPROVED' | 'REJECTED' | 'DELETED' | 'EDIT_REQUESTED' | 'EDIT_APPROVED' | 'EDIT_REJECTED'
  previousData: Record<string, unknown> | null
  newData: Record<string, unknown> | null
  reason: string | null
  performedAt: string
  performedBy: {
    id: string
    name: string
    email: string
  }
}

interface LedgerEntry {
  id: string
  serialNumber: string
  transactionType: 'CREDIT' | 'DEBIT' | 'SELF_TRANSFER'
  transactionDate: string
  description: string
  paymentAmount: number | null
  receivedAmount: number | null
  transferAmount: number | null
  componentA: number | null
  componentB: number | null
  openingBalance: number
  currentBalance: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason: string | null
  approvedAt: string | null
  createdAt: string
  isDeleted: boolean
  deletedAt: string | null
  deletedReason: string | null
  deletedBy: {
    id: string
    name: string
    email: string
  } | null
  editRequestStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null
  editRequestReason: string | null
  editRequestData: Record<string, unknown> | null
  editRequestedAt: string | null
  editRequestedBy: {
    id: string
    name: string
    email: string
  } | null
  editApprovalReason: string | null
  editApprovedAt: string | null
  editApprovedBy: {
    id: string
    name: string
    email: string
  } | null
  editCount: number
  deleteRequestStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null
  deleteRequestReason: string | null
  deleteRequestedAt: string | null
  deleteRequestedBy: {
    id: string
    name: string
    email: string
  } | null
  deleteApprovalReason: string | null
  deleteApprovedAt: string | null
  deleteApprovedBy: {
    id: string
    name: string
    email: string
  } | null
  party: {
    id: string
    name: string
    partyType: string
    contactName: string | null
    contactPhone: string | null
    contactEmail: string | null
  } | null
  head: {
    id: string
    name: string
    department: string | null
  } | null
  paymentType: {
    id: string
    name: string
    paymentType: string
  } | null
  paymentMode: {
    id: string
    name: string
  } | null
  fromPaymentMode: {
    id: string
    name: string
  } | null
  toPaymentMode: {
    id: string
    name: string
  } | null
  createdBy: {
    id: string
    name: string
    email: string
  } | null
  approvedBy: {
    id: string
    name: string
    email: string
  } | null
  attachments?: {
    name: string
    url: string
    type: string
  }[] | null
  auditLogs: AuditLog[]
}

interface Party {
  id: string
  name: string
}

interface Head {
  id: string
  name: string
}

interface PaymentType {
  id: string
  name: string
  paymentType: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export default function LedgerEntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [requestDeleteDialogOpen, setRequestDeleteDialogOpen] = useState(false)
  const [rejectDeleteDialogOpen, setRejectDeleteDialogOpen] = useState(false)
  
  const [editFormData, setEditFormData] = useState({
    description: '',
    transactionDate: '',
    partyId: '',
    headId: '',
    paymentTypeId: '',
    transactionType: 'DEBIT' as 'CREDIT' | 'DEBIT' | 'SELF_TRANSFER',
    paymentAmount: 0,
    componentA: 0,
    componentB: 0,
    receivedAmount: 0,
    transferAmount: 0,
    paymentModeId: '',
    fromPaymentModeId: '',
    toPaymentModeId: '',
    reason: '',
  })

  const [rejectionReason, setRejectionReason] = useState('')
  const [deleteReason, setDeleteReason] = useState('')
  const [requestDeleteReason, setRequestDeleteReason] = useState('')
  const [rejectDeleteReason, setRejectDeleteReason] = useState('')

  const { data: entry, isLoading, error } = useQuery<LedgerEntry>({
    queryKey: ['ledger-entry', id],
    queryFn: () => apiGet<LedgerEntry>(`/api/finance/ledger/${id}`),
  })

  // Fetch masters for edit form
  const { data: partiesData } = useQuery({
    queryKey: ['parties-list'],
    queryFn: () => apiGet<{ data: Party[] }>('/api/finance/parties?isActive=true&limit=10000'),
  })

  const { data: headsData } = useQuery({
    queryKey: ['heads-list'],
    queryFn: () => apiGet<{ data: Head[] }>('/api/finance/heads?isActive=true&limit=10000'),
  })

  const { data: paymentModesData } = useQuery({
    queryKey: ['payment-modes-list'],
    queryFn: () => apiGet<{ data: PaymentMode[] }>('/api/finance/payment-modes?isActive=true&limit=10000'),
  })

  interface PaymentMode {
    id: string
    name: string
  }

  const { data: paymentTypesData } = useQuery({
    queryKey: ['payment-types-list'],
    queryFn: () => apiGet<{ data: PaymentType[] }>('/api/finance/payment-types?isActive=true&limit=10000'),
  })

  const requestEditMutation = useMutation({
    mutationFn: (data: { reason: string; changes: Record<string, unknown> }) =>
      apiPost(`/api/finance/ledger/${id}/request-edit`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-entry', id] })
      setEditDialogOpen(false)
      setEditFormData({
        description: '',
        transactionDate: '',
        partyId: '',
        headId: '',
        paymentTypeId: '',
        transactionType: 'DEBIT' as 'CREDIT' | 'DEBIT' | 'SELF_TRANSFER',
        paymentAmount: 0,
        componentA: 0,
        componentB: 0,
        receivedAmount: 0,
        transferAmount: 0,
        paymentModeId: '',
        fromPaymentModeId: '',
        toPaymentModeId: '',
        reason: '',
      })
      toast.success('Edit request submitted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit edit request')
    },
  })

  const approveEditMutation = useMutation({
    mutationFn: (data: { reason: string }) =>
      apiPost(`/api/finance/ledger/${id}/approve-edit`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-entry', id] })
      toast.success('Edit request approved and applied')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve edit request')
    },
  })

  const rejectEditMutation = useMutation({
    mutationFn: (data: { reason: string }) =>
      apiPost(`/api/finance/ledger/${id}/reject-edit`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-entry', id] })
      setRejectDialogOpen(false)
      setRejectionReason('')
      toast.success('Edit request rejected')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reject edit request')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (data: { reason: string }) =>
      apiDelete(`/api/finance/ledger/${id}/delete`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-entry', id] })
      queryClient.invalidateQueries({ queryKey: ['ledger'] })
      setDeleteDialogOpen(false)
      setDeleteReason('')
      toast.success('Entry deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete entry')
    },
  })

  const requestDeleteMutation = useMutation({
    mutationFn: (data: { reason: string }) =>
      apiPost(`/api/finance/ledger/${id}/request-delete`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-entry', id] })
      queryClient.invalidateQueries({ queryKey: ['ledger'] })
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] })
      setRequestDeleteDialogOpen(false)
      setRequestDeleteReason('')
      toast.success('Delete request submitted')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to request deletion')
    },
  })

  const approveDeleteMutation = useMutation({
    mutationFn: (data: { reason: string }) =>
      apiPost(`/api/finance/ledger/${id}/approve-delete`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-entry', id] })
      queryClient.invalidateQueries({ queryKey: ['ledger'] })
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] })
      toast.success('Delete request approved — entry deleted')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve delete request')
    },
  })

  const rejectDeleteMutation = useMutation({
    mutationFn: (data: { reason: string }) =>
      apiPost(`/api/finance/ledger/${id}/reject-delete`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-entry', id] })
      queryClient.invalidateQueries({ queryKey: ['ledger'] })
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] })
      setRejectDeleteDialogOpen(false)
      setRejectDeleteReason('')
      toast.success('Delete request rejected')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reject delete request')
    },
  })

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MD'
  const isFinance = user?.role === 'FINANCE_HEAD'

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">Approved</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge variant="secondary">Pending</Badge>
    }
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATED':
        return <Badge variant="outline">Created</Badge>
      case 'UPDATED':
        return <Badge variant="outline" className="border-blue-500 text-blue-600">Updated</Badge>
      case 'APPROVED':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>
      case 'DELETED':
        return <Badge variant="destructive">Deleted</Badge>
      case 'EDIT_REQUESTED':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Edit Requested</Badge>
      case 'EDIT_APPROVED':
        return <Badge className="bg-green-100 text-green-800">Edit Approved</Badge>
      case 'EDIT_REJECTED':
        return <Badge variant="destructive">Edit Rejected</Badge>
      default:
        return <Badge variant="outline">{action}</Badge>
    }
  }

  const handleRequestEdit = () => {
    if (!editFormData.reason.trim()) {
      toast.error('Please provide a reason for the edit')
      return
    }

    const changes: Record<string, unknown> = {}
    
    // Basic fields
    if (editFormData.description !== entry?.description) {
      changes.description = editFormData.description
    }
    
    // Compare dates properly (entry has full datetime, form has date only)
    const entryDateStr = entry?.transactionDate ? entry.transactionDate.split('T')[0] : ''
    if (editFormData.transactionDate && editFormData.transactionDate !== entryDateStr) {
      changes.transactionDate = editFormData.transactionDate
    }
    
    if (editFormData.partyId !== entry?.party?.id) {
      changes.partyId = editFormData.partyId || null
    }
    
    if (editFormData.headId !== entry?.head?.id) {
      changes.headId = editFormData.headId || null
    }
    
    if (editFormData.paymentTypeId !== entry?.paymentType?.id) {
      changes.paymentTypeId = editFormData.paymentTypeId || null
    }
    
    // Transaction type
    if (editFormData.transactionType !== entry?.transactionType) {
      changes.transactionType = editFormData.transactionType
    }
    
    // Amount fields based on transaction type
    if (editFormData.transactionType === 'DEBIT') {
      if (editFormData.paymentAmount !== (entry?.paymentAmount || 0)) {
        changes.paymentAmount = editFormData.paymentAmount
      }
      if (editFormData.componentA !== (entry?.componentA || 0)) {
        changes.componentA = editFormData.componentA
      }
      if (editFormData.componentB !== (entry?.componentB || 0)) {
        changes.componentB = editFormData.componentB
      }
      if (editFormData.paymentModeId !== entry?.paymentMode?.id) {
        changes.paymentModeId = editFormData.paymentModeId || null
      }
    } else if (editFormData.transactionType === 'CREDIT') {
      if (editFormData.receivedAmount !== (entry?.receivedAmount || 0)) {
        changes.receivedAmount = editFormData.receivedAmount
      }
      if (editFormData.paymentModeId !== entry?.paymentMode?.id) {
        changes.paymentModeId = editFormData.paymentModeId || null
      }
    } else if (editFormData.transactionType === 'SELF_TRANSFER') {
      if (editFormData.transferAmount !== (entry?.transferAmount || 0)) {
        changes.transferAmount = editFormData.transferAmount
      }
      if (editFormData.fromPaymentModeId !== entry?.fromPaymentMode?.id) {
        changes.fromPaymentModeId = editFormData.fromPaymentModeId || null
      }
      if (editFormData.toPaymentModeId !== entry?.toPaymentMode?.id) {
        changes.toPaymentModeId = editFormData.toPaymentModeId || null
      }
    }

    if (Object.keys(changes).length === 0) {
      toast.error('Please make at least one change')
      return
    }

    requestEditMutation.mutate({
      reason: editFormData.reason,
      changes,
    })
  }

  const handleApproveEdit = () => {
    approveEditMutation.mutate({ reason: '' })
  }

  const handleRejectEdit = () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    rejectEditMutation.mutate({ reason: rejectionReason })
  }

  const handleDelete = () => {
    if (!deleteReason.trim()) {
      toast.error('Please provide a deletion reason')
      return
    }
    deleteMutation.mutate({ reason: deleteReason })
  }

  const handleRequestDelete = () => {
    if (!requestDeleteReason.trim()) {
      toast.error('Please provide a reason for deletion')
      return
    }
    requestDeleteMutation.mutate({ reason: requestDeleteReason })
  }

  const handleApproveDelete = () => {
    approveDeleteMutation.mutate({ reason: '' })
  }

  const handleRejectDelete = () => {
    if (!rejectDeleteReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    rejectDeleteMutation.mutate({ reason: rejectDeleteReason })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (error || !entry) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Entry not found</p>
        <Link href="/finance/ledger">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Ledger
          </Button>
        </Link>
      </div>
    )
  }

  if (entry.isDeleted) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
          <CardHeader>
            <CardTitle className="text-red-700 dark:text-red-400">Entry Deleted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700 dark:text-red-300 mb-4">{entry.deletedReason}</p>
            {entry.deletedBy && (
              <p className="text-sm text-muted-foreground">
                Deleted by {entry.deletedBy.name} on {entry.deletedAt && format(new Date(entry.deletedAt), 'PPP p')}
              </p>
            )}
            <Link href="/finance/ledger" className="mt-4 inline-block">
              <Button variant="outline">Back to Ledger</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isCredit = entry.transactionType === 'CREDIT'
  const isSelfTransfer = entry.transactionType === 'SELF_TRANSFER'
  const amount = isCredit ? entry.receivedAmount || 0 : isSelfTransfer ? entry.transferAmount || 0 : entry.paymentAmount || 0
  const canRequestEdit = isFinance && entry.status === 'APPROVED' && entry.editRequestStatus !== 'PENDING' && entry.editCount < 5
  const canApproveEdit = isAdmin && entry.editRequestStatus === 'PENDING'
  const canRequestDelete = isFinance && entry.status === 'APPROVED' && !entry.isDeleted && entry.deleteRequestStatus !== 'PENDING'
  const canApproveDelete = isAdmin && entry.deleteRequestStatus === 'PENDING'

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-0 pb-24 sm:pb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Link href="/finance/ledger">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 sm:flex-initial">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-mono">{entry.serialNumber}</h1>
              {getStatusBadge(entry.status)}
              {entry.editRequestStatus && (
                <Badge variant="outline" className={entry.editRequestStatus === 'APPROVED' ? 'border-green-500 text-green-600' : entry.editRequestStatus === 'REJECTED' ? 'border-red-500 text-red-600' : 'border-yellow-500 text-yellow-600'}>
                  Edit {entry.editRequestStatus}
                </Badge>
              )}
              {entry.deleteRequestStatus && (
                <Badge variant="outline" className={entry.deleteRequestStatus === 'REJECTED' ? 'border-red-500 text-red-600' : 'border-red-500 text-red-600 bg-red-50 dark:bg-red-900/20'}>
                  Delete {entry.deleteRequestStatus}
                </Badge>
              )}
              {entry.editCount > 0 && (
                <Badge variant="secondary">
                  Edited {entry.editCount}/5
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">Ledger Entry Details</p>
          </div>
        </div>


        {/* Desktop Action Buttons */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap">
          {canRequestEdit && (
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => {
                  setEditFormData({
                    description: entry.description,
                    transactionDate: entry.transactionDate.split('T')[0],
                    partyId: entry.party?.id || '',
                    headId: entry.head?.id || '',
                    paymentTypeId: entry.paymentType?.id || '',
                    transactionType: entry.transactionType,
                    paymentAmount: entry.paymentAmount || 0,
                    componentA: entry.componentA || 0,
                    componentB: entry.componentB || 0,
                    receivedAmount: entry.receivedAmount || 0,
                    transferAmount: entry.transferAmount || 0,
                    paymentModeId: entry.paymentMode?.id || '',
                    fromPaymentModeId: entry.fromPaymentMode?.id || '',
                    toPaymentModeId: entry.toPaymentMode?.id || '',
                    reason: '',
                  })
                }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Request Edit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Request Edit</DialogTitle>
                  <DialogDescription>Request changes to this approved entry</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transactionDate">Transaction Date</Label>
                    <Input
                      id="transactionDate"
                      type="date"
                      value={editFormData.transactionDate}
                      onChange={(e) => setEditFormData({ ...editFormData, transactionDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="partyId">Party</Label>
                    <Select value={editFormData.partyId} onValueChange={(value) => setEditFormData({ ...editFormData, partyId: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {partiesData?.data.map((party) => (
                          <SelectItem key={party.id} value={party.id}>
                            {party.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="headId">Head</Label>
                    <Select value={editFormData.headId} onValueChange={(value) => setEditFormData({ ...editFormData, headId: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {headsData?.data.map((head) => (
                          <SelectItem key={head.id} value={head.id}>
                            {head.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentTypeId">Payment Type</Label>
                    <Select value={editFormData.paymentTypeId} onValueChange={(value) => setEditFormData({ ...editFormData, paymentTypeId: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentTypesData?.data.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name} ({type.paymentType})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transactionType">Transaction Type</Label>
                    <Select value={editFormData.transactionType} onValueChange={(value: 'CREDIT' | 'DEBIT' | 'SELF_TRANSFER') => setEditFormData({ ...editFormData, transactionType: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CREDIT">Credit</SelectItem>
                        <SelectItem value="DEBIT">Debit</SelectItem>
                        <SelectItem value="SELF_TRANSFER">Self Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {editFormData.transactionType === 'DEBIT' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="paymentAmount">Payment Amount</Label>
                        <Input
                          id="paymentAmount"
                          type="number"
                          step="0.01"
                          value={editFormData.paymentAmount}
                          onChange={(e) => setEditFormData({ ...editFormData, paymentAmount: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="componentA">Component A</Label>
                          <Input
                            id="componentA"
                            type="number"
                            step="0.01"
                            value={editFormData.componentA}
                            onChange={(e) => setEditFormData({ ...editFormData, componentA: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="componentB">Component B</Label>
                          <Input
                            id="componentB"
                            type="number"
                            step="0.01"
                            value={editFormData.componentB}
                            onChange={(e) => setEditFormData({ ...editFormData, componentB: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="paymentModeId">Payment Mode</Label>
                        <Select value={editFormData.paymentModeId} onValueChange={(value) => setEditFormData({ ...editFormData, paymentModeId: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentModesData?.data.map((mode) => (
                              <SelectItem key={mode.id} value={mode.id}>
                                {mode.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  {editFormData.transactionType === 'CREDIT' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="receivedAmount">Received Amount</Label>
                        <Input
                          id="receivedAmount"
                          type="number"
                          step="0.01"
                          value={editFormData.receivedAmount}
                          onChange={(e) => setEditFormData({ ...editFormData, receivedAmount: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="paymentModeId">Payment Mode</Label>
                        <Select value={editFormData.paymentModeId} onValueChange={(value) => setEditFormData({ ...editFormData, paymentModeId: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentModesData?.data.map((mode) => (
                              <SelectItem key={mode.id} value={mode.id}>
                                {mode.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  {editFormData.transactionType === 'SELF_TRANSFER' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="transferAmount">Transfer Amount</Label>
                        <Input
                          id="transferAmount"
                          type="number"
                          step="0.01"
                          value={editFormData.transferAmount}
                          onChange={(e) => setEditFormData({ ...editFormData, transferAmount: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fromPaymentModeId">From Payment Mode</Label>
                        <Select value={editFormData.fromPaymentModeId} onValueChange={(value) => setEditFormData({ ...editFormData, fromPaymentModeId: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentModesData?.data.map((mode) => (
                              <SelectItem key={mode.id} value={mode.id}>
                                {mode.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="toPaymentModeId">To Payment Mode</Label>
                        <Select value={editFormData.toPaymentModeId} onValueChange={(value) => setEditFormData({ ...editFormData, toPaymentModeId: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentModesData?.data.map((mode) => (
                              <SelectItem key={mode.id} value={mode.id}>
                                {mode.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason for Edit *</Label>
                    <Textarea
                      id="reason"
                      value={editFormData.reason}
                      onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                      placeholder="Explain why this edit is needed..."
                      rows={3}
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleRequestEdit} disabled={requestEditMutation.isPending}>
                      Submit Request
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {canApproveEdit && (
            <>
              <Button 
                variant="default" 
                className="bg-green-600 hover:bg-green-700"
                onClick={handleApproveEdit}
                disabled={approveEditMutation.isPending}
              >
                <Check className="h-4 w-4 mr-2" />
                Approve Edit
              </Button>
              <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <X className="h-4 w-4 mr-2" />
                    <span className="hidden md:inline">Reject Edit</span>
                    <span className="md:hidden">Reject</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reject Edit Request</DialogTitle>
                    <DialogDescription>Provide a reason for rejecting this edit request</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {entry.editRequestReason && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium mb-1">Request Reason:</p>
                        <p className="text-sm">{entry.editRequestReason}</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="rejectionReason">Rejection Reason *</Label>
                      <Textarea
                        id="rejectionReason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Explain why you are rejecting this edit..."
                        rows={3}
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleRejectEdit} disabled={rejectEditMutation.isPending} variant="destructive">
                        Reject
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
          {canRequestDelete && (
            <AlertDialog open={requestDeleteDialogOpen} onOpenChange={setRequestDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Request Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Request Deletion</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will send a delete request for MD/Admin approval.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="requestDeleteReason">Reason *</Label>
                    <Textarea
                      id="requestDeleteReason"
                      value={requestDeleteReason}
                      onChange={(e) => setRequestDeleteReason(e.target.value)}
                      placeholder="Why should this entry be deleted..."
                      rows={3}
                      required
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRequestDelete} disabled={requestDeleteMutation.isPending} className="bg-red-600 hover:bg-red-700">
                    Submit Request
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {canApproveDelete && (
            <>
              <Button size="sm" variant="destructive" onClick={handleApproveDelete} disabled={approveDeleteMutation.isPending}>
                <Check className="h-4 w-4 mr-2" />
                Approve Delete
              </Button>
              <AlertDialog open={rejectDeleteDialogOpen} onOpenChange={setRejectDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <X className="h-4 w-4 mr-2" />
                    Reject Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reject Delete Request</AlertDialogTitle>
                    <AlertDialogDescription>
                      Provide a reason for rejecting this delete request.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="rejectDeleteReason">Rejection Reason *</Label>
                      <Textarea
                        id="rejectDeleteReason"
                        value={rejectDeleteReason}
                        onChange={(e) => setRejectDeleteReason(e.target.value)}
                        placeholder="Why is this delete request being rejected..."
                        rows={3}
                        required
                      />
                    </div>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRejectDelete} disabled={rejectDeleteMutation.isPending} className="bg-red-600 hover:bg-red-700">
                      Reject
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          {isAdmin && !entry.isDeleted && (
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Ledger Entry</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will soft delete the entry. You must provide a reason for deletion.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="deleteReason">Deletion Reason *</Label>
                    <Textarea
                      id="deleteReason"
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      placeholder="Explain why you are deleting this entry..."
                      rows={3}
                      required
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending} className="bg-red-600 hover:bg-red-700">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Mobile Action Buttons - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 sm:hidden bg-background border-t p-4 space-y-2 z-50 shadow-lg">
        {canRequestEdit && (
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full" onClick={() => {
                setEditFormData({
                  description: entry.description,
                  transactionDate: entry.transactionDate.split('T')[0],
                  partyId: entry.party?.id || '',
                  headId: entry.head?.id || '',
                  paymentTypeId: entry.paymentType?.id || '',
                  transactionType: entry.transactionType,
                  paymentAmount: entry.paymentAmount || 0,
                  componentA: entry.componentA || 0,
                  componentB: entry.componentB || 0,
                  receivedAmount: entry.receivedAmount || 0,
                  transferAmount: entry.transferAmount || 0,
                  paymentModeId: entry.paymentMode?.id || '',
                  fromPaymentModeId: entry.fromPaymentMode?.id || '',
                  toPaymentModeId: entry.toPaymentMode?.id || '',
                  reason: '',
                })
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Request Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Request Edit</DialogTitle>
                <DialogDescription>Request changes to this approved entry</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description-mobile">Description</Label>
                  <Input
                    id="description-mobile"
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transactionDate-mobile">Transaction Date</Label>
                  <Input
                    id="transactionDate-mobile"
                    type="date"
                    value={editFormData.transactionDate}
                    onChange={(e) => setEditFormData({ ...editFormData, transactionDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partyId-mobile">Party</Label>
                  <Select value={editFormData.partyId} onValueChange={(value) => setEditFormData({ ...editFormData, partyId: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {partiesData?.data.map((party) => (
                        <SelectItem key={party.id} value={party.id}>
                          {party.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="headId-mobile">Head</Label>
                  <Select value={editFormData.headId} onValueChange={(value) => setEditFormData({ ...editFormData, headId: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {headsData?.data.map((head) => (
                        <SelectItem key={head.id} value={head.id}>
                          {head.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentTypeId-mobile">Payment Type</Label>
                  <Select value={editFormData.paymentTypeId} onValueChange={(value) => setEditFormData({ ...editFormData, paymentTypeId: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentTypesData?.data.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name} ({type.paymentType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transactionType-mobile">Transaction Type</Label>
                  <Select value={editFormData.transactionType} onValueChange={(value: 'CREDIT' | 'DEBIT' | 'SELF_TRANSFER') => setEditFormData({ ...editFormData, transactionType: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CREDIT">Credit</SelectItem>
                      <SelectItem value="DEBIT">Debit</SelectItem>
                      <SelectItem value="SELF_TRANSFER">Self Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editFormData.transactionType === 'DEBIT' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="paymentAmount-mobile">Payment Amount</Label>
                      <Input
                        id="paymentAmount-mobile"
                        type="number"
                        step="0.01"
                        value={editFormData.paymentAmount}
                        onChange={(e) => setEditFormData({ ...editFormData, paymentAmount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="componentA-mobile">Component A</Label>
                        <Input
                          id="componentA-mobile"
                          type="number"
                          step="0.01"
                          value={editFormData.componentA}
                          onChange={(e) => setEditFormData({ ...editFormData, componentA: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="componentB-mobile">Component B</Label>
                        <Input
                          id="componentB-mobile"
                          type="number"
                          step="0.01"
                          value={editFormData.componentB}
                          onChange={(e) => setEditFormData({ ...editFormData, componentB: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentModeId-mobile">Payment Mode</Label>
                      <Select value={editFormData.paymentModeId} onValueChange={(value) => setEditFormData({ ...editFormData, paymentModeId: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentModesData?.data.map((mode) => (
                            <SelectItem key={mode.id} value={mode.id}>
                              {mode.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                {editFormData.transactionType === 'CREDIT' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="receivedAmount-mobile">Received Amount</Label>
                      <Input
                        id="receivedAmount-mobile"
                        type="number"
                        step="0.01"
                        value={editFormData.receivedAmount}
                        onChange={(e) => setEditFormData({ ...editFormData, receivedAmount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentModeId-mobile">Payment Mode</Label>
                      <Select value={editFormData.paymentModeId} onValueChange={(value) => setEditFormData({ ...editFormData, paymentModeId: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentModesData?.data.map((mode) => (
                            <SelectItem key={mode.id} value={mode.id}>
                              {mode.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                {editFormData.transactionType === 'SELF_TRANSFER' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="transferAmount-mobile">Transfer Amount</Label>
                      <Input
                        id="transferAmount-mobile"
                        type="number"
                        step="0.01"
                        value={editFormData.transferAmount}
                        onChange={(e) => setEditFormData({ ...editFormData, transferAmount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fromPaymentModeId-mobile">From Payment Mode</Label>
                      <Select value={editFormData.fromPaymentModeId} onValueChange={(value) => setEditFormData({ ...editFormData, fromPaymentModeId: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentModesData?.data.map((mode) => (
                            <SelectItem key={mode.id} value={mode.id}>
                              {mode.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="toPaymentModeId-mobile">To Payment Mode</Label>
                      <Select value={editFormData.toPaymentModeId} onValueChange={(value) => setEditFormData({ ...editFormData, toPaymentModeId: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentModesData?.data.map((mode) => (
                            <SelectItem key={mode.id} value={mode.id}>
                              {mode.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="reason-mobile">Reason for Edit *</Label>
                  <Textarea
                    id="reason-mobile"
                    value={editFormData.reason}
                    onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                    placeholder="Explain why this edit is needed..."
                    rows={3}
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleRequestEdit} disabled={requestEditMutation.isPending}>
                    Submit Request
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {canApproveEdit && (
          <>
            <Button 
              variant="default" 
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={handleApproveEdit}
              disabled={approveEditMutation.isPending}
            >
              <Check className="h-4 w-4 mr-2" />
              Approve Edit
            </Button>
            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <X className="h-4 w-4 mr-2" />
                  Reject Edit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reject Edit Request</DialogTitle>
                  <DialogDescription>Provide a reason for rejecting this edit request</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {entry.editRequestReason && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium mb-1">Request Reason:</p>
                      <p className="text-sm">{entry.editRequestReason}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="rejectionReason-mobile">Rejection Reason *</Label>
                    <Textarea
                      id="rejectionReason-mobile"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Explain why you are rejecting this edit..."
                      rows={3}
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleRejectEdit} disabled={rejectEditMutation.isPending} variant="destructive">
                      Reject
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
        {canRequestDelete && (
          <AlertDialog open={requestDeleteDialogOpen} onOpenChange={setRequestDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="h-4 w-4 mr-2" />
                Request Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Request Deletion</AlertDialogTitle>
                <AlertDialogDescription>
                  This will send a delete request for MD/Admin approval.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="requestDeleteReason-mobile">Reason *</Label>
                  <Textarea
                    id="requestDeleteReason-mobile"
                    value={requestDeleteReason}
                    onChange={(e) => setRequestDeleteReason(e.target.value)}
                    placeholder="Why should this entry be deleted..."
                    rows={3}
                    required
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRequestDelete} disabled={requestDeleteMutation.isPending} className="bg-red-600 hover:bg-red-700">
                  Submit Request
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {canApproveDelete && (
          <>
            <Button variant="destructive" className="w-full" onClick={handleApproveDelete} disabled={approveDeleteMutation.isPending}>
              <Check className="h-4 w-4 mr-2" />
              Approve Delete
            </Button>
            <AlertDialog open={rejectDeleteDialogOpen} onOpenChange={setRejectDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <X className="h-4 w-4 mr-2" />
                  Reject Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject Delete Request</AlertDialogTitle>
                  <AlertDialogDescription>
                    Provide a reason for rejecting this delete request.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="rejectDeleteReason-mobile">Rejection Reason *</Label>
                    <Textarea
                      id="rejectDeleteReason-mobile"
                      value={rejectDeleteReason}
                      onChange={(e) => setRejectDeleteReason(e.target.value)}
                      placeholder="Why is this delete request being rejected..."
                      rows={3}
                      required
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRejectDelete} disabled={rejectDeleteMutation.isPending} className="bg-red-600 hover:bg-red-700">
                    Reject
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
        {isAdmin && !entry.isDeleted && (
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Ledger Entry</AlertDialogTitle>
                <AlertDialogDescription>
                  This will soft delete the entry. You must provide a reason for deletion.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="deleteReason-mobile">Deletion Reason *</Label>
                  <Textarea
                    id="deleteReason-mobile"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Explain why you are deleting this entry..."
                    rows={3}
                    required
                  />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending} className="bg-red-600 hover:bg-red-700">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Delete Request Status */}
      {entry.deleteRequestStatus && (
        <Card className={entry.deleteRequestStatus === 'REJECTED' ? 'border-red-200 bg-red-50 dark:bg-red-900/10' : 'border-red-200 bg-red-50 dark:bg-red-900/10'}>
          <CardHeader>
            <CardTitle className="text-red-700 dark:text-red-400">
              Delete Request {entry.deleteRequestStatus}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {entry.deleteRequestReason && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Reason</p>
                <p className="text-sm">{entry.deleteRequestReason}</p>
              </div>
            )}
            {entry.deleteApprovalReason && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {entry.deleteRequestStatus === 'REJECTED' ? 'Rejection reason' : 'Approval reason'}
                </p>
                <p className="text-sm">{entry.deleteApprovalReason}</p>
              </div>
            )}
            {entry.deleteRequestedBy && (
              <p className="text-xs text-muted-foreground">
                Requested by {entry.deleteRequestedBy.name}
                {entry.deleteRequestedAt && ` on ${format(new Date(entry.deleteRequestedAt), 'PPP p')}`}
              </p>
            )}
            {entry.deleteApprovedBy && (
              <p className="text-xs text-muted-foreground">
                {entry.deleteRequestStatus === 'REJECTED' ? 'Rejected' : 'Approved'} by {entry.deleteApprovedBy.name}
                {entry.deleteApprovedAt && ` on ${format(new Date(entry.deleteApprovedAt), 'PPP p')}`}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Request Status */}
      {entry.editRequestStatus && (
        <Card className={entry.editRequestStatus === 'APPROVED' ? 'border-green-200 bg-green-50 dark:bg-green-900/10' : entry.editRequestStatus === 'REJECTED' ? 'border-red-200 bg-red-50 dark:bg-red-900/10' : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10'}>
          <CardHeader>
            <CardTitle className={entry.editRequestStatus === 'APPROVED' ? 'text-green-700 dark:text-green-400' : entry.editRequestStatus === 'REJECTED' ? 'text-red-700 dark:text-red-400' : 'text-yellow-700 dark:text-yellow-400'}>
              Edit Request {entry.editRequestStatus}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {entry.editRequestReason && (
              <div>
                <p className="text-sm font-medium mb-1">Request Reason:</p>
                <p className="text-sm">{entry.editRequestReason}</p>
              </div>
            )}
            {entry.editRequestData && (
              <div>
                <p className="text-sm font-medium mb-1">Requested Changes:</p>
                <pre className="text-xs bg-background p-2 rounded overflow-auto">{JSON.stringify(entry.editRequestData, null, 2)}</pre>
              </div>
            )}
            {entry.editApprovalReason && (
              <div>
                <p className="text-sm font-medium mb-1">{entry.editRequestStatus === 'APPROVED' ? 'Approval' : 'Rejection'} Reason:</p>
                <p className="text-sm">{entry.editApprovalReason}</p>
              </div>
            )}
            {entry.editRequestedBy && (
              <p className="text-xs text-muted-foreground">
                Requested by {entry.editRequestedBy.name} on {entry.editRequestedAt && format(new Date(entry.editRequestedAt), 'PPP p')}
              </p>
            )}
            {entry.editApprovedBy && (
              <p className="text-xs text-muted-foreground">
                {entry.editRequestStatus === 'APPROVED' ? 'Approved' : 'Rejected'} by {entry.editApprovedBy.name} on {entry.editApprovedAt && format(new Date(entry.editApprovedAt), 'PPP p')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Details */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Transaction Type</label>
                <p className={`font-semibold ${
                  isCredit ? 'text-green-600' :
                  isSelfTransfer ? 'text-blue-600' :
                  'text-red-600'
                }`}>
                  {isSelfTransfer ? 'Self Transfer' : entry.transactionType} ({
                    isCredit ? 'Money In' :
                    isSelfTransfer ? 'Between Payment Modes' :
                    'Money Out'
                  })
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Transaction Date</label>
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {format(new Date(entry.transactionDate), 'PPP')}
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Description</label>
                <p className="font-medium">{entry.description}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Amount</label>
                <p className={`text-2xl font-bold font-mono ${
                  isCredit ? 'text-green-600' :
                  isSelfTransfer ? 'text-blue-600' :
                  'text-red-600'
                }`}>
                  {isCredit ? '+' : isSelfTransfer ? '' : '-'}{formatCurrency(amount)}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {isSelfTransfer ? (
                <>
                  <div>
                    <label className="text-sm text-muted-foreground">From Payment Mode</label>
                    <p className="font-semibold text-blue-600">{entry.fromPaymentMode?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">To Payment Mode</label>
                    <p className="font-semibold text-blue-600">{entry.toPaymentMode?.name || 'N/A'}</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm text-muted-foreground">Party</label>
                    {entry.party ? (
                      <>
                        <p className="font-semibold">{entry.party.name}</p>
                        <p className="text-sm text-muted-foreground">{entry.party.partyType}</p>
                        {entry.party.contactPhone && <p className="text-sm">{entry.party.contactPhone}</p>}
                      </>
                    ) : (
                      <p className="text-muted-foreground">N/A</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Head</label>
                    {entry.head ? (
                      <>
                        <p className="font-medium">{entry.head.name}</p>
                        {entry.head.department && <p className="text-sm text-muted-foreground">{entry.head.department}</p>}
                      </>
                    ) : (
                      <p className="text-muted-foreground">N/A</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Payment Type</label>
                    {entry.paymentType ? (
                      <p>{entry.paymentType.name} ({entry.paymentType.paymentType})</p>
                    ) : (
                      <p className="text-muted-foreground">N/A</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Payment Mode</label>
                    {entry.paymentMode ? (
                      <p className="font-medium">{entry.paymentMode.name}</p>
                    ) : (
                      <p className="text-muted-foreground">N/A</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attachments Section */}
      {entry.attachments && entry.attachments.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-blue-500" />
              <CardTitle>Attachments ({entry.attachments.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-w-2xl mx-auto">
              <AttachmentCarousel attachments={entry.attachments} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Balance Information */}
      <Card>
        <CardHeader>
          <CardTitle>Balance Information</CardTitle>
          <CardDescription>Balance snapshot at time of transaction</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <label className="text-sm text-muted-foreground">Opening Balance</label>
              <p className="text-lg sm:text-xl font-mono font-semibold">{formatCurrency(entry.openingBalance)}</p>
            </div>
            <div className={`p-4 rounded-lg ${
              isCredit ? 'bg-green-50 dark:bg-green-900/10' :
              isSelfTransfer ? 'bg-blue-50 dark:bg-blue-900/10' :
              'bg-red-50 dark:bg-red-900/10'
            }`}>
              <label className="text-sm text-muted-foreground">Transaction</label>
              <p className={`text-lg sm:text-xl font-mono font-semibold ${
                isCredit ? 'text-green-600' :
                isSelfTransfer ? 'text-blue-600' :
                'text-red-600'
              }`}>
                {isCredit ? '+' : isSelfTransfer ? '' : '-'}{formatCurrency(amount)}
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <label className="text-sm text-muted-foreground">Current Balance</label>
              <p className="text-lg sm:text-xl font-mono font-semibold">{formatCurrency(entry.currentBalance)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Information */}
      {entry.status === 'REJECTED' && entry.rejectionReason && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
          <CardHeader>
            <CardTitle className="text-red-700 dark:text-red-400">Rejection Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700 dark:text-red-300">{entry.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      {/* Meta Information */}
      <Card>
        <CardHeader>
          <CardTitle>Meta Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <label className="text-sm text-muted-foreground">Created By</label>
                <p>{entry.createdBy?.name ?? 'Unknown'}</p>
                <p className="text-xs text-muted-foreground">{entry.createdBy?.email ?? '–'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <label className="text-sm text-muted-foreground">Created At</label>
                <p>{format(new Date(entry.createdAt), 'PPP p')}</p>
              </div>
            </div>
            {entry.approvedBy && (
              <>
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <label className="text-sm text-muted-foreground">
                      {entry.status === 'APPROVED' ? 'Approved By' : 'Rejected By'}
                    </label>
                    <p>{entry.approvedBy.name}</p>
                    <p className="text-xs text-muted-foreground">{entry.approvedBy.email}</p>
                  </div>
                </div>
                {entry.approvedAt && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <label className="text-sm text-muted-foreground">
                        {entry.status === 'APPROVED' ? 'Approved At' : 'Rejected At'}
                      </label>
                      <p>{format(new Date(entry.approvedAt), 'PPP p')}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audit Trail */}
      {entry.auditLogs && entry.auditLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Audit Trail</CardTitle>
            <CardDescription>Complete history of changes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {entry.auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 p-3 bg-muted rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getActionBadge(log.action)}
                      <span className="text-sm text-muted-foreground">
                        by {log.performedBy?.name ?? 'Unknown'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.performedAt), 'PPP p')}
                    </p>
                    {log.reason && (
                      <p className="text-sm mt-1 text-red-600">{log.reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
