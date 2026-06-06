'use client'

import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { Check, X, ArrowDownCircle, AlertTriangle, Clock, Edit, LayoutGrid, LayoutList, ChevronLeft, ChevronRight, Search, RotateCcw, FileText, Image as ImageIcon, Maximize2, ExternalLink, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import Link from 'next/link'
import { useIsMobile } from '@/hooks/use-mobile'
import { AttachmentCarousel } from '@/components/finance/attachment-carousel'
import confetti from 'canvas-confetti'
import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion'

interface LedgerEntry {
  id: string
  serialNumber: string
  transactionType: 'CREDIT' | 'DEBIT'
  transactionDate: string
  description: string
  paymentAmount: number | null
  receivedAmount: number | null
  openingBalance: number
  currentBalance: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approvedAt?: string | null
  approvedBy?: {
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
  party: {
    id: string
    name: string
    partyType: string
  } | null
  head: {
    id: string
    name: string
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
  createdBy: {
    id: string
    name: string
    email: string
  } | null
  attachments?: {
    name: string
    url: string
    type: string
  }[] | null
}

interface LedgerResponse {
  data: LedgerEntry[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface Head {
  id: string
  name: string
  department: string | null
  description: string | null
  isActive: boolean
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Compact INR formatter: 10L, 10.4L, 1.1Cr (Indian lakh/crore, up to 1 decimal, trailing .0 stripped) */
function formatCompactINR(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, '')
  if (abs >= 1_00_00_000) return `${sign}₹${trim(abs / 1_00_00_000)}Cr`
  if (abs >= 1_00_000) return `${sign}₹${trim(abs / 1_00_000)}L`
  if (abs >= 1_000) return `${sign}₹${trim(abs / 1_000)}K`
  return `${sign}₹${abs}`
}

function getPartyName(entry: LedgerEntry) {
  return entry.party?.name ?? 'Unknown party'
}

function getPartyType(entry: LedgerEntry) {
  return entry.party?.partyType ?? 'N/A'
}

function matchesLedgerEntrySearch(entry: LedgerEntry, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true

  return (
    getPartyName(entry).toLowerCase().includes(q) ||
    entry.description.toLowerCase().includes(q) ||
    entry.serialNumber.toLowerCase().includes(q) ||
    (entry.createdBy?.name ?? '').toLowerCase().includes(q)
  )
}

/** For edit requests: show requested amount from editRequestData (e.g. paymentAmount when changing to DEBIT); otherwise current entry amount. */
function getEditRequestDisplayAmount(entry: LedgerEntry): { amount: number; isDebit: boolean } {
  const data = entry.editRequestData as Record<string, unknown> | null | undefined
  if (data && typeof data.paymentAmount === 'number') return { amount: data.paymentAmount, isDebit: true }
  if (data && typeof data.receivedAmount === 'number') return { amount: data.receivedAmount, isDebit: false }
  const amount = entry.paymentAmount ?? entry.receivedAmount ?? 0
  return { amount, isDebit: entry.transactionType === 'DEBIT' }
}

interface SwipeCardProps {
  entry: LedgerEntry
  onApprove: () => void
  onReject: () => void
  onSkip?: () => void
}

interface HistoryCardProps {
  entry: LedgerEntry
  onUndo?: () => void
}

interface EditRequestCardProps {
  entry: LedgerEntry
  onApprove: () => void
  onReject: () => void
}


function EditRequestCard({ entry, onApprove, onReject }: EditRequestCardProps) {
  const { amount, isDebit } = getEditRequestDisplayAmount(entry)
  return (
    <Card className="border-2 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {entry.serialNumber}
            </Badge>
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
              Edit Request
            </Badge>
          </div>
          <span className="text-sm text-muted-foreground">
            {format(new Date(entry.transactionDate), 'dd MMM yyyy')}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="font-semibold text-lg">{getPartyName(entry)}</div>
          <div className="text-xs text-muted-foreground">{getPartyType(entry)}</div>
        </div>

        {entry.attachments && entry.attachments.length > 0 && (
          <AttachmentCarousel attachments={entry.attachments} />
        )}

        <div>
          <div className="text-xs text-muted-foreground mb-1">Description</div>
          <div className="text-sm wrap-break-word">{entry.description}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Head</div>
            <div className="font-medium">{entry.head?.name || 'N/A'}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Payment Mode</div>
            <Badge variant="outline">{entry.paymentMode?.name || 'N/A'}</Badge>
          </div>
        </div>

        <div className="border-t pt-3 space-y-2">
          <div>
            <div className="text-xs text-muted-foreground">Requested by</div>
            <div className="text-sm font-medium">{entry.editRequestedBy?.name || 'Unknown'}</div>
            {entry.editRequestedAt && (
              <div className="text-xs text-muted-foreground">
                {format(new Date(entry.editRequestedAt), 'dd MMM yyyy HH:mm')}
              </div>
            )}
          </div>
          {entry.editRequestReason && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Reason</div>
              <div className="text-sm wrap-break-word bg-yellow-100/50 dark:bg-yellow-900/20 p-2 rounded">
                {entry.editRequestReason}
              </div>
            </div>
          )}
        </div>

        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs text-muted-foreground">Requested amount</div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                {isDebit ? '-' : '+'}{formatCurrency(amount)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="destructive"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation()
              onReject()
            }}
          >
            <X className="h-4 w-4 mr-1" />
            Reject
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={(e) => {
              e.stopPropagation()
              onApprove()
            }}
          >
            <Check className="h-4 w-4 mr-1" />
            Approve
          </Button>
          <Link href={`/finance/ledger/${entry.id}`}>
            <Button size="sm" variant="outline">
              View
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function DeleteRequestCard({ entry, onApprove, onReject }: EditRequestCardProps) {
  const amount = entry.transactionType === 'CREDIT'
    ? entry.receivedAmount || 0
    : entry.paymentAmount || 0
  const isDebit = entry.transactionType === 'DEBIT'
  return (
    <Card className="border-2 border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {entry.serialNumber}
            </Badge>
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
              Delete Request
            </Badge>
          </div>
          <span className="text-sm text-muted-foreground">
            {format(new Date(entry.transactionDate), 'dd MMM yyyy')}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="font-semibold text-lg">{getPartyName(entry)}</div>
          <div className="text-xs text-muted-foreground">{getPartyType(entry)}</div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground mb-1">Description</div>
          <div className="text-sm wrap-break-word">{entry.description}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Head</div>
            <div className="font-medium">{entry.head?.name || 'N/A'}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Amount</div>
            <div className={`font-bold ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
              {isDebit ? '-' : '+'}{formatCurrency(amount)}
            </div>
          </div>
        </div>

        <div className="border-t pt-3 space-y-2">
          <div>
            <div className="text-xs text-muted-foreground">Requested by</div>
            <div className="text-sm font-medium">{(entry as any).deleteRequestedBy?.name || 'Unknown'}</div>
            {(entry as any).deleteRequestedAt && (
              <div className="text-xs text-muted-foreground">
                {format(new Date((entry as any).deleteRequestedAt), 'dd MMM yyyy HH:mm')}
              </div>
            )}
          </div>
          {(entry as any).deleteRequestReason && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Reason</div>
              <div className="text-sm wrap-break-word bg-red-100/50 dark:bg-red-900/20 p-2 rounded">
                {(entry as any).deleteRequestReason}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation()
              onReject()
            }}
          >
            <X className="h-4 w-4 mr-1" />
            Reject
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation()
              onApprove()
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Approve Delete
          </Button>
          <Link href={`/finance/ledger/${entry.id}`}>
            <Button size="sm" variant="outline">
              View
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function HistoryCard({ entry, onUndo }: HistoryCardProps) {
  const isApproved = entry.status === 'APPROVED'
  const isRejected = entry.status === 'REJECTED'
  
  return (
    <Card className={`border-2 ${
      isApproved 
        ? 'border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800' 
        : isRejected
        ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800'
        : 'border-gray-200 bg-white dark:bg-slate-800'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {entry.serialNumber}
            </Badge>
            {isApproved && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                Approved
              </Badge>
            )}
            {isRejected && (
              <Badge variant="destructive">
                Rejected
              </Badge>
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            {format(new Date(entry.transactionDate), 'dd MMM yyyy')}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="font-semibold text-lg">{getPartyName(entry)}</div>
          <div className="text-xs text-muted-foreground">{getPartyType(entry)}</div>
        </div>

        {entry.attachments && entry.attachments.length > 0 && (
          <AttachmentCarousel attachments={entry.attachments} />
        )}

        <div>
          <div className="text-xs text-muted-foreground mb-1">Description</div>
          <div className="text-sm wrap-break-word">{entry.description}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Head</div>
            <div className="font-medium">{entry.head?.name || 'N/A'}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Payment Mode</div>
            <Badge variant="outline">{entry.paymentMode?.name || 'N/A'}</Badge>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-xs text-muted-foreground">Created by</div>
              <div className="text-sm">{entry.createdBy?.name ?? '—'}</div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${isApproved ? 'text-green-600' : 'text-red-600'}`}>
                -{formatCurrency(entry.paymentAmount || 0)}
              </div>
            </div>
          </div>
          {entry.approvedAt && (
            <div className="text-xs text-muted-foreground">
              {isApproved ? 'Approved' : 'Rejected'} at: {format(new Date(entry.approvedAt), 'dd MMM yyyy HH:mm')}
            </div>
          )}
        </div>

        {onUndo && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              className={`w-full ${
                isApproved
                  ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400'
                  : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400'
              }`}
              onClick={onUndo}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Undo {isApproved ? 'Approval' : 'Rejection'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const SWIPE_THRESHOLD = 96
const SWIPE_VELOCITY = 420
const SWIPE_EXIT_X = 520

function DebitCardFace({
  entry,
  footer,
  className,
}: {
  entry: LedgerEntry
  footer: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('border-2 border-blue-200/80 bg-card shadow-lg dark:border-blue-900/50', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="font-mono">
            {entry.serialNumber}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {format(new Date(entry.transactionDate), 'dd MMM yyyy')}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="font-semibold text-lg">{getPartyName(entry)}</div>
          <div className="text-xs text-muted-foreground">{getPartyType(entry)}</div>
        </div>

        {entry.attachments && entry.attachments.length > 0 && (
          <AttachmentCarousel attachments={entry.attachments} />
        )}

        <div>
          <div className="text-xs text-muted-foreground mb-1">Description</div>
          <div className="text-sm wrap-break-word">{entry.description}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Head</div>
            <div className="font-medium">{entry.head?.name || 'N/A'}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Payment Mode</div>
            <Badge variant="outline">{entry.paymentMode?.name || 'N/A'}</Badge>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Created by</div>
              <div className="text-sm">{entry.createdBy?.name ?? '—'}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-red-600">
                -{formatCurrency(entry.paymentAmount || 0)}
              </div>
            </div>
          </div>
        </div>
        {footer}
      </CardContent>
    </Card>
  )
}

function DebitStackPreviewCard({ entry, depth }: { entry: LedgerEntry; depth: number }) {
  const scale = 1 - depth * 0.045
  const y = depth * 12
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 origin-top select-none"
      style={{
        transform: `translateY(${y}px) scale(${scale})`,
        opacity: Math.max(0.35, 1 - depth * 0.22),
        zIndex: 20 - depth,
      }}
      aria-hidden
    >
      <DebitCardFace
        entry={entry}
        className="ring-1 ring-blue-200/50 dark:ring-blue-900/40"
        footer={
          <div className="mt-4 h-10 rounded-md bg-muted/40" />
        }
      />
    </div>
  )
}

function MotionSwipeCard({ entry, onApprove, onReject, onSkip }: SwipeCardProps) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-280, 280], [-16, 16])
  const approveTint = useTransform(x, [0, 120], [0, 1])
  const rejectTint = useTransform(x, [-120, 0], [1, 0])

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info
    if (offset.y < -SWIPE_THRESHOLD || velocity.y < -SWIPE_VELOCITY) {
      onSkip?.()
      void animate(x, 0, { type: 'spring', stiffness: 380, damping: 28 })
      void animate(y, 0, { type: 'spring', stiffness: 380, damping: 28 })
      return
    }
    if (offset.x > SWIPE_THRESHOLD || velocity.x > SWIPE_VELOCITY) {
      void animate(x, SWIPE_EXIT_X, { duration: 0.32, ease: [0.22, 1, 0.36, 1] }).then(() => {
        onApprove()
        x.set(0)
      })
      return
    }
    if (offset.x < -SWIPE_THRESHOLD || velocity.x < -SWIPE_VELOCITY) {
      onReject()
      void animate(x, 0, { type: 'spring', stiffness: 420, damping: 32 })
      return
    }
    void animate(x, 0, { type: 'spring', stiffness: 380, damping: 28 })
    void animate(y, 0, { type: 'spring', stiffness: 380, damping: 28 })
  }

  return (
    <div className="relative z-30 touch-pan-y [overflow-anchor:none]">
      <motion.div
        style={{ opacity: approveTint }}
        className="pointer-events-none absolute inset-0 rounded-xl bg-green-500/15 ring-2 ring-green-500/25"
      />
      <motion.div
        style={{ opacity: rejectTint }}
        className="pointer-events-none absolute inset-0 rounded-xl bg-red-500/15 ring-2 ring-red-500/25"
      />
      <div className="pointer-events-none absolute inset-y-4 left-2 flex items-center">
        <ChevronLeft className="h-10 w-10 text-red-500/35" />
      </div>
      <div className="pointer-events-none absolute inset-y-4 right-2 flex items-center">
        <ChevronRight className="h-10 w-10 text-green-500/35" />
      </div>

      <motion.div
        style={{ x, y, rotate }}
        drag
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.92}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        className="relative cursor-grab active:cursor-grabbing"
      >
        <DebitCardFace
          entry={entry}
          footer={
            <>
              <div className="flex gap-2 mt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSkip?.()
                  }}
                >
                  Skip
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onReject()
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void animate(x, SWIPE_EXIT_X, { duration: 0.28, ease: [0.22, 1, 0.36, 1] }).then(() => {
                      onApprove()
                      x.set(0)
                    })
                  }}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-2">
                Swipe right to approve · Swipe left to reject · Swipe up to skip
              </p>
            </>
          }
        />
      </motion.div>
    </div>
  )
}

function DebitSwipeStack({
  entries,
  onApprove,
  onReject,
  onSkip,
}: {
  entries: LedgerEntry[]
  onApprove: (e: LedgerEntry) => void
  onReject: (e: LedgerEntry) => void
  onSkip?: (e: LedgerEntry) => void
}) {
  const top = entries[0]
  const under = entries.slice(1, 3)

  if (!top) return null

  return (
    <div
      className="relative mx-auto w-full max-w-lg min-h-[min(72vh,560px)] overscroll-y-contain [overflow-anchor:none]"
      style={{ touchAction: 'pan-y' }}
    >
      {under.map((entry, i) => (
        <DebitStackPreviewCard key={entry.id} entry={entry} depth={i + 1} />
      ))}
      <MotionSwipeCard
        key={top.id}
        entry={top}
        onApprove={() => onApprove(top)}
        onReject={() => onReject(top)}
        onSkip={onSkip ? () => onSkip(top) : undefined}
      />
    </div>
  )
}

export default function ApprovalsPage() {
  const isMobile = useIsMobile()
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject'>('approve')
  const [dialogType, setDialogType] = useState<'debit' | 'edit' | 'delete'>('debit')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [headFilter, setHeadFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [skipOrder, setSkipOrder] = useState<Map<string, number>>(new Map())
  const previousPendingCountRef = useRef(0)

  const queryClient = useQueryClient()

  // Auto-set view mode based on device
  useEffect(() => {
    if (isMobile && viewMode !== 'cards') {
      // Use a microtask or timeout to avoid synchronous setState in effect
      const timer = setTimeout(() => setViewMode('cards'), 0)
      return () => clearTimeout(timer)
    } else if (!isMobile && viewMode !== 'table') {
      const timer = setTimeout(() => setViewMode('table'), 0)
      return () => clearTimeout(timer)
    }
  }, [isMobile, viewMode])

  // Fetch pending debit entries
  const { data: pendingData, isLoading } = useQuery<LedgerResponse>({
    queryKey: ['pending-debits'],
    queryFn: () => apiGet<LedgerResponse>('/api/finance/ledger?status=PENDING&transactionType=DEBIT&limit=1000'),
  })

  // Fetch pending edit requests
  const { data: editRequestsData, isLoading: isLoadingEdits } = useQuery<LedgerResponse>({
    queryKey: ['pending-edit-requests'],
    queryFn: () => apiGet<LedgerResponse>('/api/finance/ledger?editRequestStatus=PENDING&status=APPROVED&limit=1000'),
  })

  // Fetch pending delete requests
  const { data: deleteRequestsData, isLoading: isLoadingDeletes } = useQuery<LedgerResponse>({
    queryKey: ['pending-delete-requests'],
    queryFn: () => apiGet<LedgerResponse>('/api/finance/ledger?deleteRequestStatus=PENDING&status=APPROVED&limit=1000'),
  })

  // Fetch approved and rejected entries for history tab
  const { data: historyData, isLoading: isLoadingHistory } = useQuery<LedgerResponse>({
    queryKey: ['approved-debits-history', headFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('transactionType', 'DEBIT')
      params.set('limit', '1000')
      if (headFilter !== 'all') {
        params.set('headId', headFilter)
      }
      if (searchQuery) {
        params.set('search', searchQuery)
      }
      
      // Fetch both approved and rejected entries
      const [approvedRes, rejectedRes] = await Promise.all([
        apiGet<LedgerResponse>(`/api/finance/ledger?${params.toString()}&status=APPROVED`),
        apiGet<LedgerResponse>(`/api/finance/ledger?${params.toString()}&status=REJECTED`),
      ])
      
      // Combine and sort by date (newest first)
      const combined = [...(approvedRes.data || []), ...(rejectedRes.data || [])]
      combined.sort((a, b) => {
        const dateA = new Date(a.approvedAt || a.transactionDate).getTime()
        const dateB = new Date(b.approvedAt || b.transactionDate).getTime()
        return dateB - dateA
      })
      
      return {
        data: combined,
        pagination: {
          page: 1,
          limit: 1000,
          total: combined.length,
          totalPages: 1,
        },
      }
    },
  })

  // Fetch heads for filter
  const { data: headsData } = useQuery<{ data: Head[] }>({
    queryKey: ['heads-list-filtered'],
    queryFn: () => apiGet<{ data: Head[] }>('/api/finance/heads?isActive=true&hasEntries=true&limit=100'),
  })

  const triggerConfetti = () => {
    const end = Date.now() + 3 * 1000 // 3 seconds
    const colors = ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"]

    const frame = () => {
      if (Date.now() > end) return

      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        startVelocity: 60,
        origin: { x: 0, y: 0.5 },
        colors: colors,
      })
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        startVelocity: 60,
        origin: { x: 1, y: 0.5 },
        colors: colors,
      })

      requestAnimationFrame(frame)
    }

    frame()
  }

  const approveMutation = useMutation({
    mutationFn: async ({ id, action, rejectionReason }: { id: string; action: 'approve' | 'reject'; rejectionReason?: string }) => {
      return apiPost(`/api/finance/ledger/${id}/approve`, { action, rejectionReason })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pending-debits'] })
      queryClient.invalidateQueries({ queryKey: ['ledger'] })
      queryClient.invalidateQueries({ queryKey: ['payment-modes'] })
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] })
      setIsDialogOpen(false)
      setSelectedEntry(null)
      setRejectionReason('')

    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to process approval')
    },
  })

  const bulkApproveMutation = useMutation({
    mutationFn: async ({ ids, action, rejectionReason }: { ids: string[]; action: 'approve' | 'reject'; rejectionReason?: string }) => {
      return apiPost('/api/finance/ledger/bulk-approve', { ids, action, rejectionReason })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pending-debits'] })
      queryClient.invalidateQueries({ queryKey: ['pending-edit-requests'] })
      queryClient.invalidateQueries({ queryKey: ['ledger'] })
      queryClient.invalidateQueries({ queryKey: ['payment-modes'] })
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] })
      setSelectedIds(new Set())
      setIsDialogOpen(false)
      setRejectionReason('')
      
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to process bulk approval')
    },
  })

  const approveEditMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiPost(`/api/finance/ledger/${id}/approve-edit`, { reason: reason || '' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-edit-requests'] })
      queryClient.invalidateQueries({ queryKey: ['ledger'] })
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve edit request')
    },
  })

  const rejectEditMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiPost(`/api/finance/ledger/${id}/reject-edit`, { reason })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pending-edit-requests'] })
      queryClient.invalidateQueries({ queryKey: ['ledger'] })
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] })
      setIsDialogOpen(false)
      setSelectedEntry(null)
      setRejectionReason('')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reject edit request')
    },
  })

  const approveDeleteMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      return apiPost(`/api/finance/ledger/${id}/approve-delete`, { reason: '' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-delete-requests'] })
      queryClient.invalidateQueries({ queryKey: ['ledger'] })
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] })
      toast.success('Delete request approved — entry deleted')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve delete request')
    },
  })

  const rejectDeleteMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiPost(`/api/finance/ledger/${id}/reject-delete`, { reason })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-delete-requests'] })
      queryClient.invalidateQueries({ queryKey: ['ledger'] })
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] })
      setIsDialogOpen(false)
      setSelectedEntry(null)
      setRejectionReason('')
      toast.success('Delete request rejected')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reject delete request')
    },
  })

  const undoMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/api/finance/ledger/${id}/undo`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-debits'] })
      queryClient.invalidateQueries({ queryKey: ['approved-debits-history'] })
      queryClient.invalidateQueries({ queryKey: ['pending-edit-requests'] })
      queryClient.invalidateQueries({ queryKey: ['ledger'] })
      queryClient.invalidateQueries({ queryKey: ['payment-modes'] })
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to undo')
    },
  })

  const handleApprove = (entry: LedgerEntry, type: 'debit' | 'edit' | 'delete' = 'debit') => {
    if (type === 'debit') {
      approveMutation.mutate({ id: entry.id, action: 'approve' })
      return
    }
    if (type === 'delete') {
      approveDeleteMutation.mutate({ id: entry.id })
      return
    }
    // Edit request - approve directly without modal
    approveEditMutation.mutate({
      id: entry.id,
      reason: '',
    })
  }

  const handleReject = (entry: LedgerEntry, type: 'debit' | 'edit' | 'delete' = 'debit') => {
    setSelectedEntry(entry)
    setDialogAction('reject')
    setDialogType(type)
    setRejectionReason('')
    setIsDialogOpen(true)
  }

  const handleConfirm = () => {
    // Handle bulk rejection
    if (!selectedEntry && selectedIds.size > 0 && dialogAction === 'reject') {
      handleConfirmBulkReject()
      return
    }

    if (!selectedEntry) return

    if (dialogType === 'debit') {
      if (dialogAction === 'reject' && !rejectionReason.trim()) {
        toast.error('Rejection reason is required')
        return
      }

      approveMutation.mutate({
        id: selectedEntry.id,
        action: dialogAction,
        rejectionReason: dialogAction === 'reject' ? rejectionReason.trim() : undefined,
      })
    } else if (dialogType === 'delete') {
      if (!rejectionReason.trim()) {
        toast.error('Rejection reason is required')
        return
      }
      rejectDeleteMutation.mutate({
        id: selectedEntry.id,
        reason: rejectionReason.trim(),
      })
    } else {
      // Edit request - only reject goes through dialog (approve is handled directly)
      if (!rejectionReason.trim()) {
        toast.error('Rejection reason is required')
        return
      }
      rejectEditMutation.mutate({
        id: selectedEntry.id,
        reason: rejectionReason.trim(),
      })
    }
  }

  // Filter pending data by head and search
  const filteredPendingData = useMemo(() => {
    const data = pendingData?.data
    if (!data) return []
    let filtered = data

    // Filter by head
    if (headFilter !== 'all') {
      filtered = filtered.filter((e) => e.head?.id === headFilter)
    }

    // Filter by search (party name, description, serial number)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (e) =>
          matchesLedgerEntrySearch(e, query)
      )
    }

    return filtered
  }, [pendingData, headFilter, searchQuery])

  const filteredPendingDataWithSkips = useMemo(() => {
    const skippedIds = new Set(skipOrder.keys())
    const unskipped = filteredPendingData.filter((e) => !skippedIds.has(e.id))
    const skipped = filteredPendingData
      .filter((e) => skippedIds.has(e.id))
      .sort((a, b) => (skipOrder.get(a.id) || 0) - (skipOrder.get(b.id) || 0))
    return [...unskipped, ...skipped]
  }, [filteredPendingData, skipOrder])

  const handleSkip = (entry: LedgerEntry) => {
    setSkipOrder((prev) => {
      const next = new Map(prev)
      if (!next.has(entry.id)) {
        next.set(entry.id, Date.now())
      }
      return next
    })
  }

  const pendingCount = filteredPendingData.length
  const totalPendingAmount = filteredPendingData.reduce((sum, e) => sum + (e.paymentAmount || 0), 0)
  const editRequestsCount = editRequestsData?.pagination.total || 0
  const deleteRequestsCount = deleteRequestsData?.pagination.total || 0

  // Trigger confetti when all approvals are done
  useEffect(() => {
    if (previousPendingCountRef.current > 0 && pendingCount === 0) {
      triggerConfetti()
    }
    previousPendingCountRef.current = pendingCount
  }, [pendingCount])

  const handleBulkApprove = () => {
    if (selectedIds.size === 0) return
    bulkApproveMutation.mutate({
      ids: Array.from(selectedIds),
      action: 'approve',
    })
  }

  const handleBulkReject = () => {
    if (selectedIds.size === 0) return
    setDialogAction('reject')
    setDialogType('debit')
    setIsDialogOpen(true)
  }

  const handleConfirmBulkReject = () => {
    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is required')
      return
    }
    bulkApproveMutation.mutate({
      ids: Array.from(selectedIds),
      action: 'reject',
      rejectionReason: rejectionReason.trim(),
    })
  }

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPendingData.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredPendingData.map((e) => e.id)))
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="debits" className="space-y-6">
        <TabsList className="grid h-auto min-h-10 w-full grid-cols-3 gap-0.5">
          <TabsTrigger value="debits" className="min-w-0 px-1.5 sm:px-3">
            <span className="truncate sm:whitespace-normal">Debit Approvals</span>
            {pendingCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 shrink-0 group-data-[state=active]:border-white/40 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white"
              >
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="edits" className="min-w-0 px-1.5 sm:px-3">
            <span className="truncate sm:whitespace-normal">Edits & Deletes</span>
            {(editRequestsCount + deleteRequestsCount) > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 shrink-0 group-data-[state=active]:border-white/40 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white"
              >
                {editRequestsCount + deleteRequestsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="min-w-0 px-1.5 sm:px-3">
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="debits" className="space-y-6">

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by party name, description, serial number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={headFilter} onValueChange={setHeadFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="All Heads" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Heads</SelectItem>
                    {headsData?.data.map((head) => (
                      <SelectItem key={head.id} value={head.id}>
                        {head.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-blue-200/80 bg-blue-50/80 dark:border-blue-800/60 dark:bg-blue-950/25">
              <CardContent className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 truncate">Pending</p>
                    <p className="text-lg font-bold text-blue-950 dark:text-blue-50 leading-tight">{pendingCount}</p>
                  </div>
                  <Clock className="h-5 w-5 text-blue-400 shrink-0" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-200/80 bg-blue-50/80 dark:border-blue-800/60 dark:bg-blue-950/25">
              <CardContent className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 truncate">Total Amount</p>
                    <p className="text-lg font-bold text-blue-950 dark:text-blue-50 leading-tight" title={formatCurrency(totalPendingAmount)}>
                      {formatCompactINR(totalPendingAmount)}
                    </p>
                  </div>
                  <ArrowDownCircle className="h-5 w-5 text-blue-400 shrink-0" />
                </div>
              </CardContent>
            </Card>
          </div>


          {/* Bulk Action Bar */}
          {viewMode === 'table' && selectedIds.size > 0 && (
            <Card className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-medium">{selectedIds.size} selected</span>
                    <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                      Clear
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleBulkReject}
                      disabled={bulkApproveMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject Selected ({selectedIds.size})
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={handleBulkApprove}
                      disabled={bulkApproveMutation.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve Selected ({selectedIds.size})
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending Entries Table/Cards */}

        <div>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : pendingCount === 0 ? (
            <div className="text-center py-12">
              <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-muted-foreground">No pending debit entries to approve.</p>
            </div>
          ) : viewMode === 'cards' ? (
            <DebitSwipeStack
              entries={filteredPendingDataWithSkips}
              onApprove={(entry) => handleApprove(entry, 'debit')}
              onReject={(entry) => handleReject(entry, 'debit')}
              onSkip={handleSkip}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.size === pendingData?.data.length && pendingData?.data.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Head</TableHead>
                  <TableHead>Payment Mode</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPendingData.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(entry.id)}
                        onCheckedChange={() => toggleSelection(entry.id)}
                      />
                    </TableCell>
                    <TableCell>{format(new Date(entry.transactionDate), 'dd MMM yyyy')}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{getPartyName(entry)}</div>
                        <div className="text-xs text-muted-foreground">{getPartyType(entry)}</div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                    <TableCell>{entry.head?.name || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.paymentMode?.name || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-red-600">
                      -{formatCurrency(entry.paymentAmount || 0)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{entry.createdBy?.name ?? '—'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(entry, 'debit')}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove(entry, 'debit')}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        </TabsContent>

        <TabsContent value="edits" className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">Edit Requests</p>
                    <p className="text-3xl font-bold">{editRequestsCount}</p>
                  </div>
                  <Edit className="h-10 w-10 text-yellow-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-600 dark:text-red-400">Delete Requests</p>
                    <p className="text-3xl font-bold">{deleteRequestsCount}</p>
                  </div>
                  <Trash2 className="h-10 w-10 text-red-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Delete Requests */}
          {deleteRequestsCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-red-700 dark:text-red-400">Pending Delete Requests</CardTitle>
                <CardDescription>Review and approve/reject delete requests from finance team</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingDeletes ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : (
                  <div className="space-y-4">
                    {deleteRequestsData?.data.map((entry) => (
                      <DeleteRequestCard
                        key={entry.id}
                        entry={entry}
                        onApprove={() => handleApprove(entry, 'delete')}
                        onReject={() => handleReject(entry, 'delete')}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Edit Requests */}
          <Card>
            <CardHeader>
              <CardTitle>Pending Edit Requests</CardTitle>
              <CardDescription>Review and approve/reject edit requests from finance team</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingEdits ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : editRequestsCount === 0 ? (
                <div className="text-center py-12">
                  <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-lg font-medium">All caught up!</p>
                  <p className="text-muted-foreground">No pending edit requests to review.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {editRequestsData?.data.map((entry) => (
                    <EditRequestCard
                      key={entry.id}
                      entry={entry}
                      onApprove={() => handleApprove(entry, 'edit')}
                      onReject={() => handleReject(entry, 'edit')}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          {/* History Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by party name, description, serial number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={headFilter} onValueChange={setHeadFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="All Heads" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Heads</SelectItem>
                    {headsData?.data.map((head) => (
                      <SelectItem key={head.id} value={head.id}>
                        {head.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>


            <div>
              {isLoadingHistory ? (
                <div className="text-center py-8 text-muted-foreground">Loading history...</div>
              ) : !historyData?.data || historyData.data.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No history entries</p>
                  <p className="text-muted-foreground">Approved and rejected entries will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historyData.data.map((entry) => (
                    <HistoryCard
                      key={entry.id}
                      entry={entry}
                      onUndo={() => {
                        const action = entry.status === 'APPROVED' ? 'approval' : 'rejection'
                        if (confirm(`Are you sure you want to undo this ${action}? This will revert the entry to pending status.`)) {
                          undoMutation.mutate(entry.id)
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

        </TabsContent>
      </Tabs>

      {/* Approval/Rejection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open)
        if (!open) {
          setSelectedEntry(null)
          setRejectionReason('')
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {!selectedEntry && selectedIds.size > 0
                ? `Reject ${selectedIds.size} Entries`
                : dialogType === 'edit' 
                ? 'Reject Edit Request'
                : (dialogAction === 'approve' ? 'Confirm Approval' : 'Reject Entry')}
            </DialogTitle>
          <DialogDescription>
            {!selectedEntry && selectedIds.size > 0
              ? `You are about to reject ${selectedIds.size} entries. Please provide a reason.`
              : dialogType === 'edit'
              ? 'Please provide a reason for rejecting this edit request.'
              : (dialogAction === 'approve'
                  ? 'Are you sure you want to approve this debit entry?'
                  : 'Please provide a reason for rejection.')}
          </DialogDescription>
          </DialogHeader>

          {!selectedEntry && selectedIds.size > 0 ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium">Selected Entries: {selectedIds.size}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulkRejectionReason">Rejection Reason *</Label>
                <Textarea
                  id="bulkRejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a reason for rejecting these entries..."
                  rows={3}
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false)
                    setRejectionReason('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={bulkApproveMutation.isPending}
                  variant="destructive"
                >
                  {bulkApproveMutation.isPending ? 'Processing...' : 'Confirm Rejection'}
                </Button>
              </div>
            </div>
          ) : selectedEntry && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Serial Number</span>
                  <Link href={`/finance/ledger/${selectedEntry.id}`} className="font-mono font-medium hover:underline">
                    {selectedEntry.serialNumber}
                  </Link>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Party</span>
                  <span>{getPartyName(selectedEntry)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Description</span>
                  <span className="text-right max-w-[200px] truncate">{selectedEntry.description}</span>
                </div>
                {dialogType === 'debit' && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Payment Mode</span>
                      <span>{selectedEntry.paymentMode?.name || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Amount</span>
                      <span className="text-red-600">-{formatCurrency(selectedEntry.paymentAmount || 0)}</span>
                    </div>
                  </>
                )}
                {dialogType === 'edit' && (() => {
                  const { amount, isDebit } = getEditRequestDisplayAmount(selectedEntry)
                  return (
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Requested amount</span>
                      <span className={isDebit ? 'text-red-600' : 'text-green-600'}>
                        {isDebit ? '-' : '+'}{formatCurrency(amount)}
                      </span>
                    </div>
                  )
                })()}
              </div>

              {dialogType === 'edit' && selectedEntry.editRequestData && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
                  <p className="text-sm font-medium mb-2">Requested Changes:</p>
                  <pre className="text-xs bg-background p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(selectedEntry.editRequestData, null, 2)}
                  </pre>
                </div>
              )}

              {dialogType === 'edit' && selectedEntry.editRequestReason && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg">
                  <p className="text-sm font-medium mb-1">Request Reason:</p>
                  <p className="text-sm">{selectedEntry.editRequestReason}</p>
                </div>
              )}

              {dialogAction === 'approve' && dialogType === 'debit' && (
                <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    <strong>Balance Impact:</strong> This amount will be deducted from{' '}
                    <strong>{selectedEntry.paymentMode?.name || 'N/A'}</strong> immediately upon approval.
                  </p>
                </div>
              )}

              {dialogAction === 'reject' && (
                <div className="space-y-2">
                  <Label htmlFor="rejectionReason">Rejection Reason *</Label>
                  <Textarea
                    id="rejectionReason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder={dialogType === 'edit' ? 'Explain why you are rejecting this edit request...' : 'Please provide a reason for rejection...'}
                    rows={3}
                    required
                  />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false)
                    setSelectedEntry(null)
                    setRejectionReason('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={approveMutation.isPending || approveEditMutation.isPending || rejectEditMutation.isPending}
                  className={dialogAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                  variant={dialogAction === 'reject' ? 'destructive' : 'default'}
                >
                  {(approveMutation.isPending || approveEditMutation.isPending || rejectEditMutation.isPending)
                    ? 'Processing...'
                    : dialogAction === 'approve'
                    ? 'Confirm Approval'
                    : 'Confirm Rejection'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
