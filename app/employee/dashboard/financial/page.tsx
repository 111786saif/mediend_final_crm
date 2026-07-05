'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTabPermissions } from '@/hooks/use-tab-permissions'
import { PermissionsGuard } from '@/components/permissions-guard'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import type { BadgeCounts } from '@/app/api/badge-counts/route'
import { format } from 'date-fns'
import {
  Calendar,
  DollarSign,
  Download,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  AlertCircle,
  FileText,
  Link,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SectionContainer } from '@/components/employee/section-container'
import { TabNavigation, type TabItem } from '@/components/employee/tab-navigation'
import { toast } from 'sonner'

const FINANCIAL_TAB_VALUES = [
  { value: 'payroll', label: 'Payroll' },
  { value: 'increment', label: 'Increment' },
] as const

interface PayrollComponent {
  id: string
  componentType: 'ALLOWANCE' | 'DEDUCTION'
  name: string
  amount: number
}

interface PayrollRecord {
  id: string
  month: number
  year: number
  disbursedAt?: Date
  basicSalary?: number
  grossSalary: number
  netSalary: number
  status: string
  components?: PayrollComponent[]
}

interface MonthlyPayrollRecord {
  id: string
  month: number
  year: number
  adjustedGross: number
  netPayable: number
  status: string
}

interface PayrollMyResponse {
  monthlyPayrolls: MonthlyPayrollRecord[]
  payrollRecords: PayrollRecord[]
}

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
}

const INCREMENT_STATUS_CONFIG = {
  PENDING: { label: 'Pending', variant: 'secondary' as const, icon: Clock },
  APPROVED: { label: 'Approved', variant: 'default' as const, icon: CheckCircle },
  REJECTED: { label: 'Rejected', variant: 'destructive' as const, icon: XCircle },
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)
}

function getMonthName(month: number) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  return months[month - 1] || ''
}

function FinancialPageContent() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('payroll')

  const { data: badges } = useQuery<BadgeCounts>({
    queryKey: ['badge-counts'],
    queryFn: () => apiGet<BadgeCounts>('/api/badge-counts'),
    refetchInterval: 60_000,
  })

  const tabs: TabItem[] = useMemo(
    () =>
      FINANCIAL_TAB_VALUES.map((t) => ({
        ...t,
        badge: t.value === 'increment' ? badges?.pendingIncrementRequests : undefined,
      })),
    [badges]
  )

  const tabsWithPerms = useMemo(() => {
    return tabs.map((t) => ({
      ...t,
      perm: `myhrms.my_financial.${t.value}`,
    }))
  }, [tabs])

  const { allowedTabs, isLoading: isPermsLoading } = useTabPermissions(tabsWithPerms, activeTab, setActiveTab)

  useEffect(() => {
    if (allowedTabs.length > 0) {
      const t = searchParams.get('tab')
      if (t && allowedTabs.some((x) => x.value === t)) {
        setActiveTab(t)
      }
    }
  }, [allowedTabs, searchParams])

  return (
    <PermissionsGuard
      isLoading={isPermsLoading}
      hasAccess={allowedTabs.length > 0}
      resourceName="Financial"
      variant="card"
    >
      <div className="space-y-6">

        <TabNavigation
          tabs={allowedTabs}
          value={activeTab}
          onValueChange={setActiveTab}
          variant="financial"
        />

        <div className="mt-6">
          {activeTab === 'payroll' && <PayrollTab />}
          {activeTab === 'increment' && <IncrementTab />}
        </div>
      </div>
    </PermissionsGuard>
  )
}

export default function FinancialPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>}>
      <FinancialPageContent />
    </Suspense>
  )
}

function PayrollTab() {
  const { data: payrollData, isLoading } = useQuery<PayrollMyResponse>({
    queryKey: ['payroll', 'my'],
    queryFn: () => apiGet<PayrollMyResponse>('/api/payroll/my'),
  })

  const handleDownloadSlip = (id: string) => {
    window.open(`/employee/payroll/${id}/slip`, '_blank')
  }

  const monthlyPayrolls = payrollData?.monthlyPayrolls ?? []
  const legacyRecords = payrollData?.payrollRecords ?? []
  const hasAny = monthlyPayrolls.length > 0 || legacyRecords.length > 0

  return (
    <div className="space-y-6">
      <SectionContainer title="Salary slips">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Disbursed</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Net Pay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyPayrolls.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {getMonthName(record.month)}
                    </div>
                  </TableCell>
                  <TableCell>{record.year}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      {formatCurrency(record.adjustedGross)}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(record.netPayable)}</TableCell>
                  <TableCell>
                    <Badge variant={record.status === 'PAID' ? 'default' : record.status === 'APPROVED' ? 'secondary' : 'outline'}>
                      {record.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => handleDownloadSlip(record.id)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {legacyRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {getMonthName(record.month)}
                    </div>
                  </TableCell>
                  <TableCell>{record.year}</TableCell>
                  <TableCell>
                    {record.disbursedAt ? format(new Date(record.disbursedAt), 'PPP') : '—'}
                  </TableCell>
                  <TableCell>{formatCurrency(record.grossSalary)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(record.netSalary)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{record.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => handleDownloadSlip(record.id)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!hasAny && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No payroll records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </SectionContainer>
    </div>
  )
}

function IncrementTab() {
  const [reason, setReason] = useState('')
  const [achievements, setAchievements] = useState('')
  const [requestedAmount, setRequestedAmount] = useState('')
  const [documents, setDocuments] = useState<string[]>([])
  const [newDocUrl, setNewDocUrl] = useState('')
  const queryClient = useQueryClient()

  const { data: requests, isLoading } = useQuery<IncrementRequest[]>({
    queryKey: ['my-increments'],
    queryFn: () => apiGet<IncrementRequest[]>('/api/employee/increment'),
  })

  const submitMutation = useMutation({
    mutationFn: (data: {
      reason: string
      achievements?: string
      requestedAmount?: number
      documents?: string[]
    }) => apiPost<IncrementRequest>('/api/employee/increment', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-increments'] })
      setReason('')
      setAchievements('')
      setRequestedAmount('')
      setDocuments([])
      toast.success('Increment request submitted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit request')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (reason.trim().length < 15) {
      toast.error('Please provide a detailed reason (at least 15 characters)')
      return
    }
    submitMutation.mutate({
      reason,
      achievements: achievements || undefined,
      requestedAmount: requestedAmount ? parseFloat(requestedAmount) : undefined,
      documents: documents.length > 0 ? documents : undefined,
    })
  }

  const addDocument = () => {
    if (newDocUrl && documents.length < 5) {
      try {
        new URL(newDocUrl)
        setDocuments([...documents, newDocUrl])
        setNewDocUrl('')
      } catch {
        toast.error('Please enter a valid URL')
      }
    }
  }

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index))
  }

  const hasPendingRequest = requests?.some((r) => r.status === 'PENDING')

  return (
    <div className="space-y-6">
      <SectionContainer title="Increment application">
        {hasPendingRequest ? (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-amber-700 text-sm">
              You have a pending increment request. Please wait for a response before submitting a new one.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="reason">Reason for increment *</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe why you deserve an increment, your contributions..."
                rows={5}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum 15 characters ({reason.length}/15)
              </p>
            </div>
            <div>
              <Label htmlFor="achievements">Key achievements (optional)</Label>
              <Textarea
                id="achievements"
                value={achievements}
                onChange={(e) => setAchievements(e.target.value)}
                placeholder="List major achievements, projects completed..."
                rows={4}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="requestedAmount">Requested amount (optional)</Label>
              <Input
                id="requestedAmount"
                type="number"
                value={requestedAmount}
                onChange={(e) => setRequestedAmount(e.target.value)}
                placeholder="Expected increment (annual)"
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">Leave empty if you prefer HR to decide</p>
            </div>
            <div>
              <Label>Supporting documents (optional, max 5)</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newDocUrl}
                  onChange={(e) => setNewDocUrl(e.target.value)}
                  placeholder="Document URL"
                  disabled={documents.length >= 5}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addDocument}
                  disabled={documents.length >= 5 || !newDocUrl}
                >
                  Add
                </Button>
              </div>
              {documents.length > 0 && (
                <div className="space-y-2 mt-2">
                  {documents.map((doc, index) => (
                    <div key={index} className="flex items-center gap-2 bg-muted/50 p-2 rounded">
                      <Link className="h-4 w-4 shrink-0" />
                      <span className="text-sm flex-1 truncate">{doc}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDocument(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button
              type="submit"
              disabled={submitMutation.isPending || reason.length < 15}
            >
              <Send className="h-4 w-4 mr-2" />
              {submitMutation.isPending ? 'Submitting...' : 'Submit request'}
            </Button>
          </form>
        )}
      </SectionContainer>

      <SectionContainer title="My increment requests">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : requests && requests.length > 0 ? (
          <div className="space-y-4">
            {requests.map((request) => {
              const config = INCREMENT_STATUS_CONFIG[request.status]
              const StatusIcon = config.icon
              return (
                <div key={request.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Submitted {format(new Date(request.createdAt), 'PPP')}
                      </p>
                      <p className="text-sm mt-1">
                        Current: <strong>{formatCurrency(request.currentSalary)}</strong>
                        {request.requestedAmount && (
                          <> · Requested: <strong>{formatCurrency(request.requestedAmount)}</strong></>
                        )}
                      </p>
                    </div>
                    <Badge variant={config.variant} className="flex items-center gap-1 shrink-0">
                      <StatusIcon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                  </div>
                  <p className="font-medium mb-1">Reason:</p>
                  <p className="text-sm bg-muted/50 p-3 rounded mb-3">{request.reason}</p>
                  {request.achievements && (
                    <div className="mb-3">
                      <p className="font-medium mb-1">Achievements:</p>
                      <p className="text-sm bg-muted/50 p-3 rounded">{request.achievements}</p>
                    </div>
                  )}
                  {request.documents && request.documents.length > 0 && (
                    <div className="mb-3">
                      <p className="font-medium mb-1 flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        Attached documents
                      </p>
                      <div className="space-y-1">
                        {request.documents.map((doc, i) => (
                          <a
                            key={i}
                            href={doc}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline block"
                          >
                            Document {i + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {request.status === 'APPROVED' && request.approvalPercentage && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-medium text-green-700">
                        Approved increment: {request.approvalPercentage}%
                      </p>
                      {request.hrRemarks && (
                        <p className="text-sm text-green-600 mt-1">{request.hrRemarks}</p>
                      )}
                    </div>
                  )}
                  {request.status === 'REJECTED' && request.hrRemarks && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm font-medium text-red-700">HR remarks:</p>
                      <p className="text-sm text-red-600">{request.hrRemarks}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No increment requests yet</p>
          </div>
        )}
      </SectionContainer>
    </div>
  )
}
