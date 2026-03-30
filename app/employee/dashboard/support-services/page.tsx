'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import type { BadgeCounts } from '@/app/api/badge-counts/route'
import { apiGet, apiPost, apiPatch } from '@/lib/api-client'
import { format } from 'date-fns'
import {
  MessageSquare,
  Send,
  Clock,
  CheckCircle,
  Eye,
  Ticket,
  Plus,
  AlertCircle,
  Building,
  ShieldCheck,
  Calendar,
  CalendarCheck,
  XCircle,
  UserCircle,
  Heart,
  Briefcase,
  Users,
  FileText,
  ExternalLink,
  Link,
  AlertTriangle,
  Paperclip,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { SectionContainer } from '@/components/employee/section-container'
import { TabNavigation, type TabItem } from '@/components/employee/tab-navigation'
import { toast } from 'sonner'

const SUPPORT_TAB_VALUES = [
  { value: 'feedback', label: 'Feedback' },
  { value: 'tickets', label: 'Tickets' },
  { value: 'md-connect', label: 'MD Connect' },
  { value: 'mental-health', label: 'Mental Health' },
  { value: 'job-postings', label: 'Job Postings' },
] as const

/** Dropdown for new tickets only (legacy tickets may still show other target roles). */
const HEAD_ROLE_OPTIONS = [
  { value: 'HR_HEAD', label: 'HR Head' },
  { value: 'FINANCE_HEAD', label: 'Finance Head' },
  { value: 'SALES_HEAD', label: 'Sales Head' },
  { value: 'DIGITAL_MARKETING_HEAD', label: 'Digital Marketing Head' },
  { value: 'IT_HEAD', label: 'IT Head' },
  { value: 'ADMIN', label: 'Admin' },
]

function headRoleLabel(role: string | null | undefined): string {
  if (!role) return '—'
  const found = HEAD_ROLE_OPTIONS.find((h) => h.value === role)
  if (found) return found.label
  return role.replace(/_/g, ' ')
}

const MAX_TICKET_ATTACHMENTS = 5
const TICKET_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024

function ticketAttachmentUrls(t: { attachments?: unknown }): string[] {
  const a = t.attachments
  if (!a) return []
  if (Array.isArray(a) && a.every((x) => typeof x === 'string')) return a
  return []
}

interface Feedback {
  id: string
  content: string
  status: 'PENDING' | 'REVIEWED' | 'ACKNOWLEDGED'
  createdAt: string
}

interface SupportTicket {
  id: string
  subject: string
  description: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  response: string | null
  respondedAt: string | null
  createdAt: string
  department?: { name: string } | null
  targetHeadRole?: string | null
  attachments?: unknown
  employee?: {
    user: { name: string; email: string }
    department?: { name: string } | null
  }
  isOverdue?: boolean
  hoursRemaining?: number
}

interface Appointment {
  id: string
  preferredDate: string | null
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
  remarks: string | null
  createdAt: string
  meet?: {
    id: string
    title: string
    scheduledAt: string
    type: 'VIRTUAL' | 'OFFLINE'
    meetLink: string | null
    location: string | null
    module: string
  } | null
}

interface MentalHealthRequest {
  id: string
  reason: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  hrResponse: string | null
  respondedAt: string | null
  createdAt: string
}

interface InternalJobPosting {
  id: string
  title: string
  description: string
  department: string | null
  requirements: string | null
  isActive: boolean
  createdAt: string
}

interface IJPApplication {
  id: string
  candidateName: string
  candidateEmail: string | null
  candidatePhone: string | null
  resumeUrl: string
  description: string | null
  documents: string[] | null
  status: 'PENDING' | 'SHORTLISTED' | 'REJECTED' | 'HIRED'
  createdAt: string
  posting: InternalJobPosting
}

const FEEDBACK_STATUS = {
  PENDING: { label: 'Pending', variant: 'secondary' as const, icon: Clock },
  REVIEWED: { label: 'Reviewed', variant: 'default' as const, icon: Eye },
  ACKNOWLEDGED: { label: 'Acknowledged', variant: 'default' as const, icon: CheckCircle },
}

const TICKET_PRIORITY = {
  LOW: { label: 'Low', variant: 'secondary' as const },
  MEDIUM: { label: 'Medium', variant: 'default' as const },
  HIGH: { label: 'High', variant: 'destructive' as const },
  URGENT: { label: 'Urgent', variant: 'destructive' as const },
}

const TICKET_STATUS = {
  OPEN: { label: 'Open', variant: 'secondary' as const, icon: Clock },
  IN_PROGRESS: { label: 'In Progress', variant: 'default' as const, icon: AlertCircle },
  RESOLVED: { label: 'Resolved', variant: 'default' as const, icon: CheckCircle },
  CLOSED: { label: 'Closed', variant: 'outline' as const, icon: CheckCircle },
}

const APPOINTMENT_STATUS = {
  PENDING: { label: 'Pending', variant: 'secondary' as const, icon: Clock },
  APPROVED: { label: 'Approved', variant: 'default' as const, icon: CheckCircle },
  REJECTED: { label: 'Rejected', variant: 'destructive' as const, icon: XCircle },
  COMPLETED: { label: 'Completed', variant: 'default' as const, icon: CheckCircle },
}

const MH_STATUS = {
  PENDING: { label: 'Pending', variant: 'secondary' as const, icon: Clock },
  APPROVED: { label: 'Approved', variant: 'default' as const, icon: CheckCircle },
  REJECTED: { label: 'Rejected', variant: 'destructive' as const, icon: XCircle },
}

const IJP_STATUS = {
  PENDING: { label: 'Pending', variant: 'secondary' as const, icon: Clock },
  SHORTLISTED: { label: 'Shortlisted', variant: 'default' as const, icon: CheckCircle },
  REJECTED: { label: 'Rejected', variant: 'destructive' as const, icon: XCircle },
  HIRED: { label: 'Hired', variant: 'default' as const, icon: CheckCircle },
}

const HEAD_ROLES = ['HR_HEAD', 'FINANCE_HEAD', 'SALES_HEAD', 'INSURANCE_HEAD', 'PL_HEAD', 'OUTSTANDING_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD']

function SupportServicesPageContent() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('feedback')

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t && SUPPORT_TAB_VALUES.some((x) => x.value === t)) {
      setActiveTab(t)
    }
  }, [searchParams])

  const { data: badges } = useQuery<BadgeCounts>({
    queryKey: ['badge-counts'],
    queryFn: () => apiGet<BadgeCounts>('/api/badge-counts'),
    refetchInterval: 60_000,
  })

  const isHead = user && HEAD_ROLES.includes(user.role)

  const tabs: TabItem[] = useMemo(
    () =>
      SUPPORT_TAB_VALUES.map((t) => {
        let badge: number | undefined
        if (t.value === 'feedback') badge = badges?.pendingFeedback
        else if (t.value === 'tickets' && isHead) badge = badges?.pendingTickets
        else if (t.value === 'md-connect') badge = badges?.pendingMDAppointments
        else if (t.value === 'mental-health') badge = badges?.pendingMentalHealth
        return { ...t, badge }
      }),
    [badges, isHead]
  )

  // Determine variant based on active tab
  const tabVariant: 'support' | 'mental-health' = activeTab === 'mental-health' ? 'mental-health' : 'support'

  return (
    <div className="space-y-6">
      <TabNavigation
        tabs={tabs}
        value={activeTab}
        onValueChange={setActiveTab}
        variant={tabVariant}
      />

      <div className="mt-6">
        {activeTab === 'feedback' && <FeedbackTab />}
        {activeTab === 'tickets' && <TicketsTab />}
        {activeTab === 'md-connect' && <MDServicesTab />}
        {activeTab === 'mental-health' && <MentalHealthTab />}
        {activeTab === 'job-postings' && <JobPostingsTab />}
      </div>
    </div>
  )
}

export default function SupportServicesPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>}>
      <SupportServicesPageContent />
    </Suspense>
  )
}

function FeedbackTab() {
  const [content, setContent] = useState('')
  const queryClient = useQueryClient()

  const { data: feedbacks, isLoading } = useQuery<Feedback[]>({
    queryKey: ['my-feedback'],
    queryFn: () => apiGet<Feedback[]>('/api/employee/feedback'),
  })

  const submitMutation = useMutation({
    mutationFn: (content: string) => apiPost<Feedback>('/api/employee/feedback', { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-feedback'] })
      setContent('')
      toast.success('Feedback submitted successfully')
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to submit feedback'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (content.trim().length < 10) {
      toast.error('Feedback must be at least 10 characters')
      return
    }
    submitMutation.mutate(content)
  }

  return (
    <div className="space-y-6">
      <SectionContainer title="Submit feedback to HR">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="feedback">Your feedback</Label>
            <Textarea
              id="feedback"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts, suggestions, or concerns..."
              rows={5}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">Minimum 10 characters</p>
          </div>
          <Button
            type="submit"
            disabled={submitMutation.isPending || content.length < 10}
          >
            <Send className="h-4 w-4 mr-2" />
            {submitMutation.isPending ? 'Submitting...' : 'Submit feedback'}
          </Button>
        </form>
      </SectionContainer>

      <SectionContainer title="Your feedback">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : feedbacks && feedbacks.length > 0 ? (
          <div className="space-y-4">
            {feedbacks.map((f) => {
              const config = FEEDBACK_STATUS[f.status]
              const Icon = config.icon
              return (
                <div key={f.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-2">
                        {format(new Date(f.createdAt), 'PPP')}
                      </p>
                      <p className="whitespace-pre-wrap">{f.content}</p>
                    </div>
                    <Badge variant={config.variant} className="flex items-center gap-1 shrink-0">
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No feedback submitted yet</p>
          </div>
        )}
      </SectionContainer>
    </div>
  )
}

function HeadTicketCard({
  ticket,
  onUpdate,
}: {
  ticket: SupportTicket
  onUpdate: () => void
}) {
  const [response, setResponse] = useState('')
  const [status, setStatus] = useState(ticket.status)
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: (data: { status: string; response?: string }) =>
      apiPatch(`/api/head/tickets/${ticket.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['head-tickets'] })
      setResponse('')
      onUpdate()
      toast.success('Ticket updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const statusConfig = TICKET_STATUS[ticket.status]
  const priorityConfig = TICKET_PRIORITY[ticket.priority]
  const StatusIcon = statusConfig.icon

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-medium">{ticket.subject}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            {ticket.employee?.user?.name} ({ticket.employee?.user?.email})
            <span>·</span>
            {format(new Date(ticket.createdAt), 'PPP')}
            {ticket.isOverdue && (
              <Badge variant="destructive" className="text-xs">Overdue</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={priorityConfig.variant}>{priorityConfig.label}</Badge>
          <Badge variant={statusConfig.variant} className="flex items-center gap-1">
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </Badge>
        </div>
      </div>
      <p className="text-sm bg-muted/50 p-3 rounded mb-3">{ticket.description}</p>
      <TicketAttachments urls={ticketAttachmentUrls(ticket)} />
      {ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS' ? (
        <div className="space-y-2">
          <Label>Response</Label>
          <Textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Your response..."
            rows={3}
          />
          <div className="flex gap-2">
            <Select value={status} onValueChange={(value) => setStatus(value as SupportTicket['status'])}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => updateMutation.mutate({ status, response: response || undefined })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </div>
      ) : (
        ticket.response && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-700">Your response:</p>
            <p className="text-sm text-green-600">{ticket.response}</p>
            {ticket.respondedAt && (
              <p className="text-xs text-green-500 mt-2">
                Responded {format(new Date(ticket.respondedAt), 'PPP')}
              </p>
            )}
          </div>
        )
      )}
    </div>
  )
}

function TicketAttachments({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null
  return (
    <div className="mb-3 flex flex-wrap gap-2 items-center">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Paperclip className="h-3.5 w-3.5" />
        Attachments
      </span>
      {urls.map((url) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          <FileText className="h-3 w-3 shrink-0" />
          View file
          <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
        </a>
      ))}
    </div>
  )
}

function CreateTicketForm({
  onSubmit,
  isLoading,
}: {
  onSubmit: (data: {
    targetHeadRole: string
    subject: string
    description: string
    priority: string
    files: File[]
  }) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    targetHeadRole: '',
    subject: '',
    description: '',
    priority: 'MEDIUM',
  })
  const [files, setFiles] = useState<File[]>([])

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return
    setFiles((prev) => {
      const next = [...prev]
      for (let i = 0; i < list.length; i++) {
        const f = list.item(i)
        if (!f) continue
        if (f.size > TICKET_ATTACHMENT_MAX_BYTES) {
          toast.error(`${f.name} is too large (max 10 MB)`)
          continue
        }
        if (next.length >= MAX_TICKET_ATTACHMENTS) {
          toast.error(`Maximum ${MAX_TICKET_ATTACHMENTS} attachments`)
          break
        }
        next.push(f)
      }
      return next.slice(0, MAX_TICKET_ATTACHMENTS)
    })
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({ ...formData, files })
      }}
      className="space-y-4"
    >
      <div>
        <Label>Raise to *</Label>
        <Select
          value={formData.targetHeadRole}
          onValueChange={(v) => setFormData({ ...formData, targetHeadRole: v })}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select head" />
          </SelectTrigger>
          <SelectContent>
            {HEAD_ROLE_OPTIONS.map((h) => (
              <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Subject *</Label>
        <Input
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          placeholder="Brief description"
          required
          minLength={5}
        />
      </div>
      <div>
        <Label>Priority</Label>
        <Select
          value={formData.priority}
          onValueChange={(v) => setFormData({ ...formData, priority: v })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Description *</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Detailed information..."
          rows={4}
          required
          minLength={20}
        />
      </div>
      <div>
        <Label htmlFor="ticket-files">Attachments (optional)</Label>
        <p className="text-xs text-muted-foreground mt-1 mb-2">
          Up to {MAX_TICKET_ATTACHMENTS} files — PDF or images (JPEG, PNG, GIF, WebP), max 10 MB each.
        </p>
        <Input
          id="ticket-files"
          type="file"
          accept="application/pdf,image/*"
          multiple
          className="cursor-pointer"
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        {files.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1">
                <span className="truncate text-muted-foreground">{f.name}</span>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeFile(i)}>
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Submitting...' : 'Submit ticket'}
        </Button>
      </div>
    </form>
  )
}

function TicketsTab() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [ticketFormKey, setTicketFormKey] = useState(0)
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data: tickets, isLoading } = useQuery<SupportTicket[]>({
    queryKey: ['my-tickets'],
    queryFn: () => apiGet<SupportTicket[]>('/api/employee/tickets'),
  })

  const isHead = user && HEAD_ROLES.includes(user.role)

  const { data: incomingTickets, isLoading: loadingIncoming } = useQuery<SupportTicket[]>({
    queryKey: ['head-tickets'],
    queryFn: () => apiGet<SupportTicket[]>('/api/head/tickets'),
    enabled: !!isHead,
  })

  const createMutation = useMutation({
    mutationFn: async (data: {
      targetHeadRole: string
      subject: string
      description: string
      priority: string
      files: File[]
    }) => {
      const urls: string[] = []
      for (const file of data.files) {
        const fd = new FormData()
        fd.append('file', file)
        const uploaded = await apiPost<{ url: string }>('/api/employee/tickets/upload', fd)
        urls.push(uploaded.url)
      }
      const { files: _f, ...rest } = data
      return apiPost<SupportTicket>('/api/employee/tickets', {
        ...rest,
        attachments: urls.length ? urls : undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] })
      setIsDialogOpen(false)
      toast.success('Ticket raised successfully')
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create ticket'),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Raise tickets for assistance — response within 48 hours</span>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (open) setTicketFormKey((k) => k + 1)
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Raise ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Raise support ticket</DialogTitle>
              <DialogDescription>Describe your issue and choose which head to raise to</DialogDescription>
            </DialogHeader>
            <CreateTicketForm
              key={ticketFormKey}
              onSubmit={(data) => createMutation.mutate(data)}
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isHead && (
        <SectionContainer title="Incoming tickets (for you)">
          {loadingIncoming ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : incomingTickets && incomingTickets.length > 0 ? (
            <div className="space-y-4">
              {incomingTickets.map((t) => (
                <HeadTicketCard key={t.id} ticket={t} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['head-tickets', 'my-tickets'] })} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tickets targeted at you</p>
            </div>
          )}
        </SectionContainer>
      )}

      <SectionContainer title="My tickets">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : tickets && tickets.length > 0 ? (
          <div className="space-y-4">
            {tickets.map((t) => {
              const statusConfig = TICKET_STATUS[t.status]
              const priorityConfig = TICKET_PRIORITY[t.priority]
              const StatusIcon = statusConfig.icon
              return (
                <div key={t.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="font-medium">{t.subject}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <ShieldCheck className="h-3 w-3" />
                        {t.targetHeadRole
                          ? headRoleLabel(t.targetHeadRole)
                          : t.department?.name ?? '—'}
                        <span>·</span>
                        {format(new Date(t.createdAt), 'PPP')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={priorityConfig.variant}>{priorityConfig.label}</Badge>
                      <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm bg-muted/50 p-3 rounded mb-3">{t.description}</p>
                  <TicketAttachments urls={ticketAttachmentUrls(t)} />
                  {t.response && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-medium text-green-700">Response:</p>
                      <p className="text-sm text-green-600">{t.response}</p>
                      {t.respondedAt && (
                        <p className="text-xs text-green-500 mt-2">
                          Responded {format(new Date(t.respondedAt), 'PPP')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No tickets yet</p>
            <p className="text-sm mt-1">Click &quot;Raise ticket&quot; to get help</p>
          </div>
        )}
      </SectionContainer>
    </div>
  )
}

function MDServicesTab() {
  return (
    <div className="space-y-8">
      <AnonymousMessageSection />
      <MDAppointmentSection />
    </div>
  )
}

function AnonymousMessageSection() {
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const submitMutation = useMutation({
    mutationFn: (msg: string) => apiPost<{ id: string }>('/api/anonymous/message', { message: msg }),
    onSuccess: () => {
      setMessage('')
      setSubmitted(true)
      toast.success('Message sent anonymously')
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to send message'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim().length < 10) {
      toast.error('Message must be at least 10 characters')
      return
    }
    submitMutation.mutate(message)
  }

  if (submitted) {
    return (
      <SectionContainer title="Anonymous message to MD">
        <div className="py-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Message sent</h2>
          <p className="text-muted-foreground mb-6">
            Your anonymous message has been delivered. Your identity has not been recorded.
          </p>
          <Button onClick={() => setSubmitted(false)}>Send another message</Button>
        </div>
      </SectionContainer>
    )
  }

  return (
    <SectionContainer title="Anonymous message to MD">
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
        <ul className="space-y-1">
          <li>· Your identity is NOT stored</li>
          <li>· No IP or device info is recorded</li>
          <li>· Only the message content reaches the MD</li>
        </ul>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="anon-msg">Your message</Label>
          <Textarea
            id="anon-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Share your thoughts with the MD..."
            rows={6}
            className="mt-2"
            maxLength={2000}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Min 10 characters</span>
            <span>{message.length}/2000</span>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            Once sent, you cannot edit or delete. Please review before submitting.
          </p>
        </div>
        <Button
          type="submit"
          disabled={submitMutation.isPending || message.length < 10}
          className="w-full"
        >
          <Send className="h-4 w-4 mr-2" />
          {submitMutation.isPending ? 'Sending...' : 'Send anonymous message'}
        </Button>
      </form>
    </SectionContainer>
  )
}

function MDAppointmentSection() {
  const [preferredDate, setPreferredDate] = useState('')
  const [reason, setReason] = useState('')
  const queryClient = useQueryClient()

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ['my-md-appointments'],
    queryFn: () => apiGet<Appointment[]>('/api/employee/md-appointment'),
  })

  const submitMutation = useMutation({
    mutationFn: (data: { preferredDate?: string; reason: string }) =>
      apiPost<Appointment>('/api/employee/md-appointment', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-md-appointments'] })
      setPreferredDate('')
      setReason('')
      toast.success('Appointment request submitted')
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to submit'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (reason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters')
      return
    }
    submitMutation.mutate({
      preferredDate: preferredDate.trim() || undefined,
      reason,
    })
  }

  const hasPending = appointments?.some((a) => a.status === 'PENDING')

  return (
    <div className="space-y-6">
      <SectionContainer title="Request appointment with MD">
        {hasPending ? (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-amber-700 text-sm">
              You have a pending appointment request. Wait for a response before submitting another.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="pref-date">Scheduled day (optional)</Label>
              <Input
                id="pref-date"
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="mt-2 rounded-xl"
              />
              <p className="text-xs text-muted-foreground mt-1">
                You suggest a day; MD will confirm the exact date and time.
              </p>
            </div>
            <div>
              <Label htmlFor="reason-md">Reason for appointment *</Label>
              <Textarea
                id="reason-md"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Purpose of the meeting..."
                rows={4}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">Minimum 10 characters</p>
            </div>
            <Button type="submit" disabled={submitMutation.isPending || reason.length < 10}>
              <Calendar className="h-4 w-4 mr-2" />
              {submitMutation.isPending ? 'Submitting...' : 'Request appointment'}
            </Button>
          </form>
        )}
      </SectionContainer>

      <SectionContainer title="My appointment requests">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : appointments && appointments.length > 0 ? (
          <div className="space-y-4">
            {appointments.map((apt) => {
              const config = APPOINTMENT_STATUS[apt.status]
              const Icon = config.icon
              return (
                <div key={apt.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Requested {format(new Date(apt.createdAt), 'PPP')}
                      </p>
                      {apt.preferredDate && (
                        <p className="text-sm flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          Scheduled: {format(new Date(apt.preferredDate), 'PPP')}
                        </p>
                      )}
                    </div>
                    <Badge variant={config.variant} className="flex items-center gap-1 shrink-0">
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                  </div>
                  <p className="font-medium mb-2">Reason:</p>
                  <p className="text-sm bg-muted/50 p-3 rounded">{apt.reason}</p>
                  {apt.remarks && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-blue-700">MD remarks:</p>
                      <p className="text-sm text-blue-600">{apt.remarks}</p>
                    </div>
                  )}
                  {apt.status === 'APPROVED' && apt.meet && (
                    <div className="mt-3 p-3 rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20">
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                        Scheduled meet
                      </p>
                      <p className="text-sm mt-1">
                        {format(new Date(apt.meet.scheduledAt), 'PPP p')}
                      </p>
                      {apt.meet.location && (
                        <p className="text-xs text-muted-foreground mt-1">
                          📍 {apt.meet.location}
                        </p>
                      )}
                      {apt.meet.meetLink && (
                        <Button size="sm" className="mt-2 rounded-lg" asChild>
                          <a href={apt.meet.meetLink} target="_blank" rel="noreferrer">
                            Join link
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No appointment requests yet</p>
          </div>
        )}
      </SectionContainer>
    </div>
  )
}

function MentalHealthTab() {
  const [reason, setReason] = useState('')
  const queryClient = useQueryClient()

  const { data: requests, isLoading } = useQuery<MentalHealthRequest[]>({
    queryKey: ['my-mental-health'],
    queryFn: () => apiGet<MentalHealthRequest[]>('/api/employee/mental-health'),
  })

  const submitMutation = useMutation({
    mutationFn: (reason?: string) =>
      apiPost<MentalHealthRequest>('/api/employee/mental-health', { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-mental-health'] })
      setReason('')
      toast.success('Request submitted. HR will respond within 48 hours.')
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to submit'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitMutation.mutate(reason || undefined)
  }

  const hasPending = requests?.some((r) => r.status === 'PENDING')

  return (
    <div className="space-y-6">
        <div className="mb-6 relative overflow-hidden rounded-xl bg-gradient-to-br from-rose-50 via-pink-50 to-rose-50/50 p-6 shadow-sm">
          <div className="relative z-10">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="rounded-full bg-rose-100 p-3">
                  <Heart className="h-6 w-6 text-rose-500 fill-rose-500" />
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">We&apos;re here for you</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="mt-1 shrink-0">
                      <div className="h-2 w-2 rounded-full bg-rose-500"></div>
                    </div>
                    <p className="text-base text-gray-800 leading-7 font-medium">
                      Your mental health and wellbeing are our top priority
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="mt-1 shrink-0">
                      <div className="h-2 w-2 rounded-full bg-rose-500"></div>
                    </div>
                    <p className="text-base text-gray-800 leading-7 font-medium">
                      All requests are handled with complete confidentiality and care
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="mt-1 shrink-0">
                      <div className="h-2 w-2 rounded-full bg-rose-500"></div>
                    </div>
                    <p className="text-base text-gray-800 leading-7 font-medium">
                      Our HR team will respond with empathy within 48 hours
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="mt-1 shrink-0">
                      <div className="h-2 w-2 rounded-full bg-rose-500"></div>
                    </div>
                    <p className="text-base text-gray-800 leading-7 font-medium">
                      You can share as much or as little as you&apos;re comfortable with
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Decorative background element */}
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-rose-100/40 blur-2xl"></div>
          <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-pink-100/40 blur-2xl"></div>
        </div>
        {hasPending ? (
          <div className="flex items-center gap-3 p-4 bg-rose-100 border border-rose-300 rounded-lg">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <p className="text-rose-800 text-sm">
              You have a pending request. Our HR team will respond with care within 48 hours.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Textarea
                id="mh-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="You can share what you're going through, or simply request support without details. We're here to listen and help..."
                rows={5}
                className="mt-2 border-rose-200 focus:border-rose-400 focus:ring-rose-400"
              />
              <p className="text-xs text-rose-700 mt-1.5">
                This is completely optional. You can request support without sharing any details.
              </p>
            </div>
            <Button
              type="submit"
              disabled={submitMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
            >
              <Heart className="h-4 w-4 mr-2" />
              {submitMutation.isPending ? 'Submitting...' : 'Request support'}
            </Button>
          </form>
        )}

      <SectionContainer title="My mental health requests">
        {isLoading ? (
          <div className="text-center py-8 text-rose-700">Loading...</div>
        ) : requests && requests.length > 0 ? (
          <div className="space-y-4">
            {requests.map((r) => {
              const config = MH_STATUS[r.status]
              const Icon = config.icon
              return (
                <div key={r.id} className="border border-rose-200 rounded-lg p-4 bg-white hover:bg-rose-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <p className="text-sm text-rose-700">
                      Submitted {format(new Date(r.createdAt), 'PPP')}
                    </p>
                    <Badge variant={config.variant} className="flex items-center gap-1 shrink-0">
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                  </div>
                  {r.reason && (
                    <div className="mb-3">
                      <p className="text-sm font-medium mb-1 text-rose-900">Your message:</p>
                      <p className="text-sm bg-rose-50 border border-rose-100 p-3 rounded text-rose-800">
                        {r.reason}
                      </p>
                    </div>
                  )}
                  {r.hrResponse && (
                    <div className="p-4 bg-rose-100 border border-rose-300 rounded-lg">
                      <div className="flex items-start gap-2 mb-2">
                        <Heart className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                        <p className="text-sm font-semibold text-rose-900">HR Response:</p>
                      </div>
                      <p className="text-sm text-rose-800 ml-6">{r.hrResponse}</p>
                      {r.respondedAt && (
                        <p className="text-xs text-rose-600 mt-2 ml-6">
                          Responded with care on {format(new Date(r.respondedAt), 'PPP')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-rose-700">
            <Heart className="h-16 w-16 mx-auto mb-4 text-rose-400 opacity-60" />
            <p className="text-rose-800 font-medium">No requests yet</p>
            <p className="text-sm text-rose-600 mt-1">We&apos;re here whenever you need support</p>
          </div>
        )}
      </SectionContainer>
    </div>
  )
}

function JobPostingsTab() {
  const queryClient = useQueryClient()

  const { data: postings, isLoading: loadingPostings } = useQuery<InternalJobPosting[]>({
    queryKey: ['ijp-postings'],
    queryFn: () => apiGet<InternalJobPosting[]>('/api/hr/ijp?active=true'),
  })

  const { data: myReferrals, isLoading: loadingReferrals } = useQuery<IJPApplication[]>({
    queryKey: ['my-referrals'],
    queryFn: () => apiGet<IJPApplication[]>('/api/employee/ijp'),
  })

  return (
    <div className="space-y-6">
        {loadingPostings ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : postings && postings.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {postings.map((posting) => (
              <div key={posting.id} className="border rounded-lg p-4">
                <h3 className="font-medium text-lg">{posting.title}</h3>
                {posting.department && (
                  <p className="text-sm text-muted-foreground">{posting.department}</p>
                )}
                <p className="text-sm mt-2 line-clamp-3">{posting.description}</p>
                {posting.requirements && (
                  <div className="mt-2">
                    <p className="text-sm font-medium">Requirements:</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{posting.requirements}</p>
                  </div>
                )}
                <div className="mt-4">
                  <ReferralDialog
                    posting={posting}
                    onSuccess={() => queryClient.invalidateQueries({ queryKey: ['my-referrals'] })}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No open positions at the moment</p>
          </div>
        )}

      <SectionContainer title="My referrals">
        {loadingReferrals ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : myReferrals && myReferrals.length > 0 ? (
          <div className="space-y-4">
            {myReferrals.map((ref) => {
              const config = IJP_STATUS[ref.status]
              const Icon = config.icon
              return (
                <div key={ref.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <h3 className="font-medium">{ref.candidateName}</h3>
                      <p className="text-sm text-muted-foreground">For: {ref.posting.title}</p>
                    </div>
                    <Badge variant={config.variant} className="flex items-center gap-1 shrink-0">
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Submitted {format(new Date(ref.createdAt), 'PPP')}
                  </p>
                  {ref.description && (
                    <p className="text-sm mt-2 bg-muted/50 p-2 rounded">{ref.description}</p>
                  )}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <a
                      href={ref.resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      Resume
                    </a>
                    {ref.documents?.map((doc, i) => (
                      <a
                        key={i}
                        href={doc}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Doc {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No referrals submitted yet</p>
          </div>
        )}
      </SectionContainer>
    </div>
  )
}

function ReferralDialog({
  posting,
  onSuccess,
}: {
  posting: InternalJobPosting
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    candidateName: '',
    candidateEmail: '',
    candidatePhone: '',
    resumeUrl: '',
    description: '',
  })
  const [documents, setDocuments] = useState<string[]>([])
  const [newDocUrl, setNewDocUrl] = useState('')

  const submitMutation = useMutation({
    mutationFn: (data: {
      postingId: string
      candidateName: string
      candidateEmail?: string
      candidatePhone?: string
      resumeUrl: string
      description?: string
      documents?: string[]
    }) => apiPost<IJPApplication>('/api/employee/ijp', data),
    onSuccess: () => {
      setOpen(false)
      setFormData({
        candidateName: '',
        candidateEmail: '',
        candidatePhone: '',
        resumeUrl: '',
        description: '',
      })
      setDocuments([])
      toast.success('Referral submitted successfully')
      onSuccess()
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to submit referral'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitMutation.mutate({
      postingId: posting.id,
      candidateName: formData.candidateName,
      candidateEmail: formData.candidateEmail || undefined,
      candidatePhone: formData.candidatePhone || undefined,
      resumeUrl: formData.resumeUrl,
      description: formData.description || undefined,
      documents: documents.length > 0 ? documents : undefined,
    })
  }

  const addDocument = () => {
    if (newDocUrl && documents.length < 3) {
      try {
        new URL(newDocUrl)
        setDocuments([...documents, newDocUrl])
        setNewDocUrl('')
      } catch {
        toast.error('Please enter a valid URL')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Send className="h-4 w-4 mr-2" />
          Submit referral
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Refer a candidate</DialogTitle>
          <DialogDescription>For: {posting.title}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Candidate name *</Label>
            <Input
              value={formData.candidateName}
              onChange={(e) => setFormData({ ...formData, candidateName: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.candidateEmail}
                onChange={(e) => setFormData({ ...formData, candidateEmail: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.candidatePhone}
                onChange={(e) => setFormData({ ...formData, candidatePhone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Resume URL *</Label>
            <Input
              value={formData.resumeUrl}
              onChange={(e) => setFormData({ ...formData, resumeUrl: e.target.value })}
              placeholder="https://..."
              required
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Why is this candidate a good fit?"
              rows={3}
            />
          </div>
          <div>
            <Label>Additional documents (max 3)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={newDocUrl}
                onChange={(e) => setNewDocUrl(e.target.value)}
                placeholder="Document URL"
                disabled={documents.length >= 3}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addDocument}
                disabled={documents.length >= 3 || !newDocUrl}
              >
                Add
              </Button>
            </div>
            {documents.length > 0 && (
              <div className="space-y-1 mt-2">
                {documents.map((doc, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/50 p-2 rounded text-sm">
                    <Link className="h-3 w-3 shrink-0" />
                    <span className="flex-1 truncate">{doc}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDocuments(documents.filter((_, idx) => idx !== i))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitMutation.isPending}>
              {submitMutation.isPending ? 'Submitting...' : 'Submit referral'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
