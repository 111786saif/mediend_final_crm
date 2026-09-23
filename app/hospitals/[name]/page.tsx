'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Activity,
  ReceiptText,
  TrendingUp,
  AlertCircle,
  FileText,
  ChevronRight,
  ExternalLink,
  Loader2,
  Calendar,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { ProtectedRoute } from '@/components/protected-route'
import { RecentActivityLog } from '@/components/recent-activity-log'
import { RecordPaymentForm } from '@/components/record-payment-form'
import { ColumnFilter } from '@/components/ui/column-filter'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { apiGet, apiPost } from '@/lib/api-client'
import { formatPlDate, formatPlMonth, formatPlRupee } from '@/lib/pl/resolve-pl-row'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions, PermissionLevel } from '@/hooks/use-permissions'
import { hasPermission } from '@/lib/rbac'
import {
  useCreatePlInvoiceRequest,
  usePlAttachInvoice,
  usePlInvoiceRequests,
} from '@/hooks/use-invoice-requests'
import { useFileUpload } from '@/hooks/use-file-upload'
import { INVOICE_ATTACHMENT_ACCEPT } from '@/lib/finance/invoice-request/attachments'
import { useInvoiceRequestActivity } from '@/hooks/use-doctor-payoff-requests'
import {
  INVOICE_REQUEST_STATUS_LABEL,
  type InvoiceRequestRecord,
} from '@/lib/finance/invoice-request/types'

type HospitalCase = {
  leadId: number
  leadRef: string | null
  patientName: string | null
  doctorName: string | null
  surgeryDate: string | null
  month: string | null
  status: string | null
  billAmount: number | null
  mediendShareAmount: number | null
  hospitalAmountPending: number | null
  mediendInvoiceStatus: string | null
  mediendReceived: number
}

type HospitalDetail = {
  name: string
  kpis: {
    totalCases: number
    amountReceived: number
    pendingOutstanding: number
    mediendShare: number
  }
  cases: HospitalCase[]
}


type FilterConfigItem = {
  field: string
  label: string
  filterType: string
  filterable: boolean
  options?: Array<{ label: string; value: string }>
  min?: number
  max?: number
}

type FilterConfig = {
  filters: FilterConfigItem[]
}

export default function HospitalDetailPage() {
  const queryClient = useQueryClient()
  const params = useParams()
  const search = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const { hasAccess } = usePermissions()
  const canRequestInvoice = user ? (hasAccess('insurance_pl.pl_ledger', PermissionLevel.READ_WRITE) || hasPermission(user, 'pl:write')) : false
  const canRecordPayment = canRequestInvoice

  const rawName = params.name as string
  const name = decodeURIComponent(rawName)
  const startDate = search.get('startDate')
  const endDate = search.get('endDate')

  const [requestCase, setRequestCase] = useState<HospitalCase | null>(null)
  const [isBatchInvoice, setIsBatchInvoice] = useState(false)
  const [requestRemarks, setRequestRemarks] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [uploadTarget, setUploadTarget] = useState<{
    caseRow: HospitalCase
    invoiceReq: InvoiceRequestRecord
  } | null>(null)
  const [uploadInvoiceNumber, setUploadInvoiceNumber] = useState('')
  const [uploadInvoiceAmount, setUploadInvoiceAmount] = useState('')
  const [uploadFileMeta, setUploadFileMeta] = useState<{ url: string; name: string } | null>(null)

  // Column filter states
  const [selectedLeads, setSelectedLeads] = useState<number[]>([])
  const [leadRefFilter, setLeadRefFilter] = useState('')
  const [patientNameFilter, setPatientNameFilter] = useState('')
  const [doctorFilter, setDoctorFilter] = useState<string[]>([])
  const [monthFilter, setMonthFilter] = useState<string[]>([])
  const [surgeryDateFilter, setSurgeryDateFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [billAmountFilter, setBillAmountFilter] = useState<{ min?: number; max?: number } | null>(null)
  const [mediendShareAmountFilter, setMediendShareAmountFilter] = useState<{ min?: number; max?: number } | null>(null)
  const [mediendReceivedFilter, setMediendReceivedFilter] = useState<{ min?: number; max?: number } | null>(null)
  const [hospitalAmountPendingFilter, setHospitalAmountPendingFilter] = useState<{ min?: number; max?: number } | null>(null)
  const [mediendInvoiceStatusFilter, setMediendInvoiceStatusFilter] = useState<string[]>([])

  const { data, isLoading } = useQuery<HospitalDetail>({
    queryKey: [
      'hospitals', name, startDate, endDate,
      leadRefFilter, patientNameFilter, doctorFilter, monthFilter,
      surgeryDateFilter, statusFilter, billAmountFilter, mediendShareAmountFilter,
      mediendReceivedFilter, hospitalAmountPendingFilter, mediendInvoiceStatusFilter,
    ],
    queryFn: () => {
      const filters = []
      if (leadRefFilter.trim()) filters.push({ field: 'leadRef', operator: 'contains', value: leadRefFilter })
      if (patientNameFilter.trim()) filters.push({ field: 'patientName', operator: 'contains', value: patientNameFilter })
      if (doctorFilter.length > 0) filters.push({ field: 'doctor', operator: 'in', value: doctorFilter })
      if (statusFilter.length > 0) filters.push({ field: 'status', operator: 'in', value: statusFilter })
      if (mediendInvoiceStatusFilter.length > 0) filters.push({ field: 'mediendInvoiceStatus', operator: 'in', value: mediendInvoiceStatusFilter })

      if (monthFilter.length === 2 && monthFilter[0]) {
        filters.push({ field: 'month', operator: 'between', value: monthFilter })
      }
      if (surgeryDateFilter.length === 2 && surgeryDateFilter[0]) {
        filters.push({ field: 'surgeryDate', operator: 'between', value: surgeryDateFilter })
      }

      if (billAmountFilter && (billAmountFilter.min != null || billAmountFilter.max != null)) {
        filters.push({ field: 'billAmount', operator: 'between', value: billAmountFilter })
      }
      if (mediendShareAmountFilter && (mediendShareAmountFilter.min != null || mediendShareAmountFilter.max != null)) {
        filters.push({ field: 'mediendShareAmount', operator: 'between', value: mediendShareAmountFilter })
      }
      if (mediendReceivedFilter && (mediendReceivedFilter.min != null || mediendReceivedFilter.max != null)) {
        filters.push({ field: 'mediendReceived', operator: 'between', value: mediendReceivedFilter })
      }
      if (hospitalAmountPendingFilter && (hospitalAmountPendingFilter.min != null || hospitalAmountPendingFilter.max != null)) {
        filters.push({ field: 'hospitalAmountPending', operator: 'between', value: hospitalAmountPendingFilter })
      }

      const qs = new URLSearchParams()
      if (startDate && endDate) {
        qs.set('startDate', startDate)
        qs.set('endDate', endDate)
      }
      if (filters.length > 0) {
        qs.set('filters', JSON.stringify(filters))
      }
      const tail = qs.toString()
      return apiGet<HospitalDetail>(
        `/api/hospitals/${encodeURIComponent(name)}${tail ? `?${tail}` : ''}`,
      )
    },
    enabled: !!name,
  })

  const { data: invoiceData, isLoading: invoicesLoading } = usePlInvoiceRequests(
    {
      hospitalName: name,
      status: 'ALL',
      latestPerLead: true,
    },
    !!name,
  )

  const invoiceByLeadId = useMemo(() => {
    const map = new Map<number, InvoiceRequestRecord>()
    for (const req of invoiceData?.requests ?? []) {
      map.set(req.leadId, req)
    }
    return map
  }, [invoiceData?.requests])

  const { totalBillAmount, unsettledReceived, totalPendingOutstanding, amountReceivedDisplay } = useMemo(() => {
    if (!data?.cases) {
      return {
        totalBillAmount: 0,
        unsettledReceived: 0,
        totalPendingOutstanding: 0,
        amountReceivedDisplay: 0,
      }
    }

    let billSum = 0
    let pendingSum = 0
    let totalReceivedSum = 0
    let verifiedReceivedSum = 0

    data.cases.forEach((c) => {
      billSum += c.billAmount || 0
      pendingSum += c.hospitalAmountPending || 0
      totalReceivedSum += c.mediendReceived || 0

      const invoiceReq = invoiceByLeadId.get(c.leadId)
      const isVerified = invoiceReq?.status === 'VERIFIED'

      if (isVerified) {
        verifiedReceivedSum += c.mediendReceived || 0
      }
    })

    const unsettled = totalReceivedSum - verifiedReceivedSum
    const amtReceivedDisplay = verifiedReceivedSum > 0 ? verifiedReceivedSum : totalReceivedSum

    return {
      totalBillAmount: billSum,
      unsettledReceived: verifiedReceivedSum > 0 ? unsettled : totalReceivedSum,
      totalPendingOutstanding: pendingSum,
      amountReceivedDisplay: amtReceivedDisplay,
    }
  }, [data?.cases, invoiceByLeadId])

  const createInvoice = useCreatePlInvoiceRequest()
  const attachInvoice = usePlAttachInvoice()
  const { uploadFile, uploading: plInvoiceUploading } = useFileUpload({
    endpoint: '/api/pl/invoice-requests/upload',
  })
  const { data: invoiceActivityData, isLoading: invoiceActivityLoading } = useInvoiceRequestActivity({
    hospitalName: name,
    limit: 20,
    enabled: !!name,
  })

  // ── Filter-Config API (backend-driven options) ──────────────────────────
  const { data: filterConfig } = useQuery<FilterConfig>({
    queryKey: ['hospitals', name, 'filter-config'],
    queryFn: () => apiGet<FilterConfig>(`/api/hospitals/${encodeURIComponent(name)}/filter-config`),
    enabled: !!name,
    staleTime: 5 * 60 * 1000,
  })

  const filterOptions = useMemo(() => {
    const filters = filterConfig?.filters ?? []
    const find = (field: string) => filters.find(f => f.field === field)
    return {
      doctors: find('doctor')?.options ?? [],
      statuses: find('status')?.options ?? [],
      mediendInvoiceStatuses: find('mediendInvoiceStatus')?.options ?? [],
      billBounds: { min: find('billAmount')?.min ?? 0, max: find('billAmount')?.max ?? 0 },
      shareBounds: { min: find('mediendShareAmount')?.min ?? 0, max: find('mediendShareAmount')?.max ?? 0 },
      receivedBounds: { min: find('mediendReceived')?.min ?? 0, max: find('mediendReceived')?.max ?? 0 },
      pendingBounds: { min: find('hospitalAmountPending')?.min ?? 0, max: find('hospitalAmountPending')?.max ?? 0 },
    }
  }, [filterConfig])

  // ── Payment Collection Mutation (Reconciliation) ──────────────────────────
  const recordPaymentMutation = useMutation({
    mutationFn: async (payload: {
      amount: number
      mode: 'NEFT' | 'CHEQUE' | 'UPI' | 'OTHER'
      reference: string | null
      /** Empty = hospital-level receipt (no case). Otherwise equal-split across selected cases. */
      leadIds: number[]
      attachments?: Array<{ name: string; url: string; type: string }>
    }) => {
      const notes = `Recorded via Hospital Detail Page for ${name}. Attachments:\n${
        payload.attachments && payload.attachments.length > 0
          ? payload.attachments.map((a) => `- [${a.name}](${a.url})`).join('\n')
          : 'None'
      }`

      if (payload.leadIds.length === 0) {
        return apiPost('/api/installments', {
          hospitalName: name,
          recipient: 'MEDIEND',
          amount: payload.amount,
          paidOn: new Date().toISOString(),
          mode: payload.mode,
          reference: payload.reference || null,
          notes,
        })
      }

      const allocations = buildPaymentAllocations(payload.leadIds, payload.amount)
      return Promise.all(
        allocations.map(({ leadId, amount }) =>
          apiPost('/api/installments', {
            leadId,
            hospitalName: name,
            recipient: 'MEDIEND',
            amount,
            paidOn: new Date().toISOString(),
            mode: payload.mode,
            reference: payload.reference || null,
            notes,
          }),
        ),
      )
    },
    onSuccess: (_data, variables) => {
      const n = variables.leadIds.length
      toast.success(
        n === 0
          ? 'Hospital payment sent to Finance for verification (no case attached).'
          : n === 1
            ? 'Hospital payment recorded successfully!'
            : `Hospital payment recorded across ${n} cases (pending Finance verification).`,
      )
      setSelectedLeads([])
      queryClient.invalidateQueries({ queryKey: ['hospitals', name] })
      queryClient.invalidateQueries({ queryKey: ['finance-payment-installments'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to record payment')
    },
  })

  /** Equal-split the payment across the explicitly selected cases only. */
  function buildPaymentAllocations(
    leadIds: number[],
    amount: number,
  ): Array<{ leadId: number; amount: number }> {
    if (leadIds.length === 0 || amount <= 0) return []
    const split = Math.round((amount / leadIds.length) * 100) / 100
    const allocations = leadIds.map((leadId) => ({ leadId, amount: split }))
    // Absorb rounding remainder on the last case so totals match the entered amount
    const allocated = allocations.reduce((sum, a) => sum + a.amount, 0)
    const remainder = Math.round((amount - allocated) * 100) / 100
    if (Math.abs(remainder) > 0.0001 && allocations.length > 0) {
      allocations[allocations.length - 1].amount =
        Math.round((allocations[allocations.length - 1].amount + remainder) * 100) / 100
    }
    return allocations
  }

  const openRequestDialog = (c: HospitalCase, e: React.MouseEvent) => {
    e.stopPropagation()
    setIsBatchInvoice(false)
    setRequestCase(c)
    setRequestRemarks('')
    setInvoiceNumber('')
    setInvoiceAmount(
      c.mediendShareAmount != null && c.mediendShareAmount > 0
        ? String(c.mediendShareAmount)
        : '',
    )
  }

  const handleBatchInvoiceRequest = () => {
    setIsBatchInvoice(true)
    setRequestCase(null)
    setRequestRemarks('')
    setInvoiceNumber('')
    setInvoiceAmount('')
  }

  const closeRequestDialog = () => {
    setRequestCase(null)
    setIsBatchInvoice(false)
    setRequestRemarks('')
    setInvoiceNumber('')
    setInvoiceAmount('')
  }

  const openUploadDialog = (
    c: HospitalCase,
    invoiceReq: InvoiceRequestRecord,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation()
    setUploadTarget({ caseRow: c, invoiceReq })
    setUploadInvoiceNumber(invoiceReq.invoiceNumber ?? '')
    setUploadInvoiceAmount(
      invoiceReq.invoiceAmount != null ? String(invoiceReq.invoiceAmount) : '',
    )
    setUploadFileMeta(null)
  }

  const closeUploadDialog = () => {
    setUploadTarget(null)
    setUploadInvoiceNumber('')
    setUploadInvoiceAmount('')
    setUploadFileMeta(null)
  }

  const handleUploadFileSelect = async (file: File | undefined) => {
    if (!file) return
    const result = await uploadFile(file)
    if (result?.url) {
      setUploadFileMeta({ url: result.url, name: file.name })
    }
  }

  const handleSubmitUpload = async () => {
    if (!uploadTarget || !uploadFileMeta?.url) {
      toast.error('Please select an invoice file to upload')
      return
    }
    const amount = uploadInvoiceAmount.trim() ? Number(uploadInvoiceAmount) : undefined
    if (amount != null && (Number.isNaN(amount) || amount < 0)) {
      toast.error('Invoice amount must be a valid number')
      return
    }
    try {
      await attachInvoice.mutateAsync({
        id: uploadTarget.invoiceReq.id,
        invoicePdfUrl: uploadFileMeta.url,
        invoicePdfName: uploadFileMeta.name,
        invoiceNumber: uploadInvoiceNumber.trim() || undefined,
        invoiceAmount: amount,
      })
      toast.success('Invoice uploaded for Finance review')
      closeUploadDialog()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload invoice')
    }
  }

  const handleSubmitRequest = async () => {
    if (!isBatchInvoice && !requestCase) return
    const amount = invoiceAmount.trim() ? Number(invoiceAmount) : undefined
    if (!isBatchInvoice && amount != null && (Number.isNaN(amount) || amount < 0)) {
      toast.error('Invoice amount must be a valid number')
      return
    }

    try {
      if (isBatchInvoice) {
        await Promise.all(
          selectedLeads.map((leadId) =>
            createInvoice.mutateAsync({
              leadId,
              requestRemarks: requestRemarks.trim() || undefined,
              invoiceNumber: invoiceNumber.trim() || undefined,
            })
          )
        )
        toast.success(`Invoice requests submitted successfully for ${selectedLeads.length} cases`)
      } else if (requestCase) {
        await createInvoice.mutateAsync({
          leadId: requestCase.leadId,
          requestRemarks: requestRemarks.trim() || undefined,
          invoiceNumber: invoiceNumber.trim() || undefined,
          invoiceAmount: amount,
        })
        toast.success('Invoice request submitted to Finance')
      }
      closeRequestDialog()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit invoice request')
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen w-full min-w-0 bg-white dark:bg-[#07112f] text-slate-900 dark:text-[#dce1ff] p-6 font-sans">
        <div className="w-full min-w-0 space-y-6">
          {/* Header & Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                asChild
                className="h-9 w-9 rounded-full border-slate-200 bg-white text-cyan-600 shadow-sm transition-all duration-200 hover:bg-slate-100 dark:border-[#283150] dark:bg-[#191D2E]/80 dark:text-[#22d3ee] dark:hover:bg-[#283150] shrink-0"
              >
                <Link href="/hospitals" aria-label="Back to hospital list">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <nav className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-[#c7c6cd]/60 mb-1 leading-none">
                  <Link href="/hospitals" className="hover:text-cyan-600 dark:hover:text-[#22d3ee] transition-colors">
                    Hospital List
                  </Link>
                  <ChevronRight className="h-3 w-3 opacity-60 shrink-0" />
                  <span className="text-slate-900 dark:text-[#dce1ff] font-semibold">{name}</span>
                </nav>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-[#dce1ff] leading-none">
                    {name}
                  </h1>
                  {startDate && endDate && (
                    <div className="inline-flex items-center gap-1 rounded-full bg-cyan-50 dark:bg-[#22d3ee]/10 px-2 py-0.5 text-[10px] font-medium text-cyan-700 dark:text-[#22d3ee] border border-cyan-200 dark:border-[#22d3ee]/20 shrink-0 ml-1">
                      <span className="h-1 w-1 rounded-full bg-cyan-500 dark:bg-[#22d3ee] animate-pulse" />
                      Filtered: {startDate} → {endDate}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ColumnFilter
                type="dateRange"
                value={startDate && endDate ? [startDate, endDate] : undefined}
                onChange={(val: any) => {
                  const urlParams = new URLSearchParams(search.toString())
                  if (val && val.length === 2 && val[0]) {
                    urlParams.set('startDate', val[0].split('T')[0])
                    urlParams.set('endDate', val[1].split('T')[0])
                  } else {
                    urlParams.delete('startDate')
                    urlParams.delete('endDate')
                  }
                  router.push(`?${urlParams.toString()}`)
                }}
                trigger={
                  <Button variant="outline" className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-[#191D2E]/80 dark:border-[#283150] dark:text-[#dce1ff] dark:hover:bg-[#283150] h-9 text-xs">
                    <Calendar className="mr-2 h-3.5 w-3.5" />
                    Date Range
                  </Button>
                }
              />
              {canRequestInvoice && (
                <>
                  <Button variant="outline" className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-[#191D2E]/80 dark:border-[#283150] dark:text-[#dce1ff] dark:hover:bg-[#283150] h-9 text-xs">
                    Add Document
                  </Button>
                  <Button className="bg-cyan-600 text-white hover:bg-cyan-700 font-bold h-9 text-xs shadow-md dark:bg-[#22d3ee] dark:text-[#07112f]">
                    Request Invoice
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Summary Cards (Bento Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Tile 1: Cases */}
            <div className="bg-white border border-slate-200 dark:bg-[#191D2E]/60 dark:border-[#283150] p-4 rounded-xl flex flex-col gap-2 shadow-sm dark:shadow-lg transition-all duration-200">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-xs tracking-wider text-slate-500 dark:text-[#c7c6cd] uppercase">Cases</span>
                <div className="p-1 bg-cyan-50 text-cyan-600 dark:bg-[#22d3ee]/10 dark:text-[#22d3ee] rounded">
                  <Activity className="h-3.5 w-3.5 animate-pulse" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{data?.kpis.totalCases ?? 0}</h2>
                <p className="text-[10px] text-slate-500 dark:text-[#c7c6cd]/60 mt-0.5">Active patient cases</p>
              </div>
            </div>

            {/* Tile 2: Total Bill Amount */}
            <div className="bg-white border border-slate-200 dark:bg-[#191D2E]/60 dark:border-[#283150] p-4 rounded-xl flex flex-col gap-2 shadow-sm dark:shadow-lg transition-all duration-200">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-xs tracking-wider text-slate-500 dark:text-[#c7c6cd] uppercase">Total Bill Amount</span>
                <div className="p-1 bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400 rounded">
                  <FileText className="h-3.5 w-3.5" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{formatPlRupee(totalBillAmount)}</h2>
                <p className="text-[10px] text-slate-500 dark:text-[#c7c6cd]/60 mt-0.5">Total billing across cases</p>
              </div>
            </div>

            {/* Tile 3: Pending Outstanding */}
            <div className="bg-white border border-slate-200 dark:bg-[#191D2E]/60 dark:border-[#283150] p-4 rounded-xl flex flex-col gap-2 shadow-sm dark:shadow-lg transition-all duration-200">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-xs tracking-wider text-slate-500 dark:text-[#c7c6cd] uppercase">Pending Outstanding</span>
                <div className="p-1 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 rounded">
                  <AlertCircle className="h-3.5 w-3.5" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">{formatPlRupee(totalPendingOutstanding)}</h2>
                <p className="text-[10px] text-slate-500 dark:text-[#c7c6cd]/60 mt-0.5">Awaiting collection</p>
              </div>
            </div>

            {/* Tile 4: Total MediEND Share */}
            <div className="bg-white border border-slate-200 dark:bg-[#191D2E]/60 dark:border-[#283150] p-4 rounded-xl flex flex-col gap-2 shadow-sm dark:shadow-lg transition-all duration-200">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-xs tracking-wider text-slate-500 dark:text-[#c7c6cd] uppercase">Total MediEND Share</span>
                <div className="p-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-[#c7bfff] rounded">
                  <ReceiptText className="h-3.5 w-3.5" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{formatPlRupee(data?.kpis.mediendShare ?? null)}</h2>
                <p className="text-[10px] text-slate-500 dark:text-[#c7c6cd]/60 mt-0.5">Projected contract share</p>
              </div>
            </div>

            {/* Tile 5: Amount Received */}
            <div className="bg-white border border-slate-200 dark:bg-[#191D2E]/60 dark:border-[#283150] p-4 rounded-xl flex flex-col gap-2 shadow-sm dark:shadow-lg transition-all duration-200">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-xs tracking-wider text-slate-500 dark:text-[#c7c6cd] uppercase">Amount Received</span>
                <div className="p-1 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 rounded">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-cyan-600 dark:text-[#22d3ee]">{formatPlRupee(amountReceivedDisplay)}</h2>
                <p className="text-[10px] text-slate-500 dark:text-[#c7c6cd]/60 mt-0.5">Reconciled payments</p>
              </div>
            </div>

            {/* Tile 6: Unsettled Received */}
            <div className="bg-white border border-slate-200 dark:bg-[#191D2E]/60 dark:border-[#283150] p-4 rounded-xl flex flex-col gap-2 shadow-sm dark:shadow-lg transition-all duration-200">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-xs tracking-wider text-slate-500 dark:text-[#c7c6cd] uppercase">Unsettled Received</span>
                <div className="p-1 bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 rounded">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-orange-600 dark:text-orange-400">{formatPlRupee(unsettledReceived)}</h2>
                <p className="text-[10px] text-slate-500 dark:text-[#c7c6cd]/60 mt-0.5">Payments on unverified cases</p>
              </div>
            </div>
          </div>

          {/* Payment Form Section — PL outstanding action, not for Finance */}
          {canRecordPayment && (
            <RecordPaymentForm
              title="Record Hospital Payment"
              subtitle={
                selectedLeads.length > 0
                  ? `Will split across ${selectedLeads.length} selected case(s)`
                  : 'No case selected — amount goes to Finance for verification (hospital-level)'
              }
              amountLabel="Amount Paid"
              onSubmit={async (amount, mode, txnId) => {
                const amt = parseFloat(amount)
                if (!amt || amt <= 0) {
                  toast.error('Please enter a valid payment amount')
                  return
                }

                const mappedMode =
                  mode === 'Bank Transfer' ? 'NEFT' :
                    mode === 'Cheque' ? 'CHEQUE' :
                      mode === 'UPI' ? 'UPI' : 'OTHER'

                recordPaymentMutation.mutate({
                  amount: amt,
                  leadIds: selectedLeads,
                  mode: mappedMode,
                  reference: txnId || null,
                })
              }}
            />
          )}

          <Card className="min-w-0 w-full overflow-hidden border-slate-200 bg-white shadow-md dark:border-sky-800/40 dark:bg-slate-900">
            <CardHeader className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-slate-900 dark:text-sky-100">Cases</CardTitle>
                <CardDescription>
                  Click a case to open its outstanding record. Use Invoice to request PDF from Finance.
                </CardDescription>
              </div>
              {canRequestInvoice && (
                <Button
                  disabled={selectedLeads.length === 0}
                  onClick={handleBatchInvoiceRequest}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs h-9 px-4 rounded-lg flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all duration-150 dark:bg-[#22d3ee] dark:text-[#07112f]"
                >
                  <FileText className="h-4 w-4" />
                  Request Invoice {selectedLeads.length > 0 && `(${selectedLeads.length})`}
                </Button>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100 hover:bg-slate-100 border-b border-slate-200 dark:bg-[#191D2E]/90 dark:hover:bg-[#191D2E]/90 dark:border-[#283150]">
                    <TableHead className="w-[50px] pl-4">
                      <Checkbox
                        className="border-slate-300 data-[state=checked]:bg-cyan-600 data-[state=checked]:text-white dark:border-[#283150] dark:data-[state=checked]:bg-[#22d3ee] dark:data-[state=checked]:text-[#07112f]"
                        checked={
                          !!data?.cases && data.cases.length > 0 && selectedLeads.length === data.cases.length
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedLeads(data?.cases.map((c) => c.leadId) ?? [])
                          } else {
                            setSelectedLeads([])
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead className="w-[140px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 dark:text-[#c7c6cd]">Lead Ref</span>
                        <ColumnFilter
                          type="search"
                          value={leadRefFilter}
                          onChange={setLeadRefFilter}
                          placeholder="Search..."
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[180px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 dark:text-[#c7c6cd]">Patient</span>
                        <ColumnFilter
                          type="search"
                          value={patientNameFilter}
                          onChange={setPatientNameFilter}
                          placeholder="Search..."
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[180px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 dark:text-[#c7c6cd]">Doctor</span>
                        <ColumnFilter
                          type="multiSelect"
                          options={filterOptions.doctors}
                          value={doctorFilter}
                          onChange={setDoctorFilter}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[130px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 dark:text-[#c7c6cd]">Month</span>
                        <ColumnFilter
                          type="dateRange"
                          value={monthFilter}
                          onChange={monthFilter => setMonthFilter(monthFilter)}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[130px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 dark:text-[#c7c6cd]">Surgery</span>
                        <ColumnFilter
                          type="dateRange"
                          value={surgeryDateFilter}
                          onChange={setSurgeryDateFilter}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[140px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 dark:text-[#c7c6cd]">Status</span>
                        <ColumnFilter
                          type="multiSelect"
                          options={filterOptions.statuses}
                          value={statusFilter}
                          onChange={setStatusFilter}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[140px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap justify-end">
                        <span className="font-semibold text-slate-700 dark:text-[#c7c6cd]">Bill</span>
                        <ColumnFilter
                          type="numberRange"
                          value={billAmountFilter}
                          onChange={setBillAmountFilter}
                          min={filterOptions.billBounds.min}
                          max={filterOptions.billBounds.max}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[150px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap justify-end">
                        <span className="font-semibold text-slate-700 dark:text-[#c7c6cd]">MediEND share</span>
                        <ColumnFilter
                          type="numberRange"
                          value={mediendShareAmountFilter}
                          onChange={setMediendShareAmountFilter}
                          min={filterOptions.shareBounds.min}
                          max={filterOptions.shareBounds.max}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[140px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap justify-end">
                        <span className="font-semibold text-slate-700 dark:text-[#c7c6cd]">Received</span>
                        <ColumnFilter
                          type="numberRange"
                          value={mediendReceivedFilter}
                          onChange={setMediendReceivedFilter}
                          min={filterOptions.receivedBounds.min}
                          max={filterOptions.receivedBounds.max}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[140px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap justify-end">
                        <span className="font-semibold text-slate-700 dark:text-[#c7c6cd]">Outstanding</span>
                        <ColumnFilter
                          type="numberRange"
                          value={hospitalAmountPendingFilter}
                          onChange={setHospitalAmountPendingFilter}
                          min={filterOptions.pendingBounds.min}
                          max={filterOptions.pendingBounds.max}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[130px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 dark:text-[#c7c6cd]">Invoice</span>
                        <ColumnFilter
                          type="multiSelect"
                          options={filterOptions.mediendInvoiceStatuses}
                          value={mediendInvoiceStatusFilter}
                          onChange={setMediendInvoiceStatusFilter}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-[#c7c6cd] w-[180px] pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-200 dark:divide-[#283150]/30">
                  {isLoading ? (
                    <TableRow className="border-b border-slate-200 dark:border-[#283150]/20">
                      <TableCell colSpan={13} className="text-center py-8 text-slate-500 dark:text-[#c7c6cd]/50">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : !data?.cases?.length ? (
                    <TableRow className="border-b border-slate-200 dark:border-[#283150]/20">
                      <TableCell colSpan={13} className="text-center py-8 text-slate-500 dark:text-[#c7c6cd]/50">
                        No cases yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.cases.map((c) => {
                      const invoiceReq = invoiceByLeadId.get(c.leadId)
                      return (
                        <TableRow
                          key={c.leadId}
                          className="cursor-pointer hover:bg-slate-50 dark:hover:bg-sky-950/15 border-b border-slate-200 dark:border-[#283150]/20"
                          onClick={() => (window.location.href = `/pl/outstanding/${c.leadId}`)}
                        >
                          {/* Checkbox col */}
                          <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              className="border-[#283150] data-[state=checked]:bg-[#22d3ee] data-[state=checked]:text-[#07112f]"
                              checked={selectedLeads.includes(c.leadId)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedLeads((prev) => [...prev, c.leadId])
                                } else {
                                  setSelectedLeads((prev) => prev.filter((id) => id !== c.leadId))
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{c.leadRef ?? '—'}</TableCell>
                          <TableCell>{c.patientName ?? '—'}</TableCell>
                          <TableCell>{c.doctorName ?? '—'}</TableCell>
                          <TableCell>{formatPlMonth(c.month ? new Date(c.month) : null)}</TableCell>
                          <TableCell>
                            {formatPlDate(c.surgeryDate ? new Date(c.surgeryDate) : null)}
                          </TableCell>
                          <TableCell>{c.status ?? '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPlRupee(c.billAmount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPlRupee(c.mediendShareAmount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPlRupee(c.mediendReceived || null)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPlRupee(c.hospitalAmountPending)}
                          </TableCell>
                          {/* Invoice status col */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <InvoiceStatusCell
                              invoiceReq={invoiceReq}
                              invoicesLoading={invoicesLoading}
                            />
                          </TableCell>
                          {/* Action col */}
                          <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                            <InvoiceActionCell
                              caseRow={c}
                              invoiceReq={invoiceReq}
                              invoicesLoading={invoicesLoading}
                              canRequest={canRequestInvoice}
                              requesting={
                                createInvoice.isPending && requestCase?.leadId === c.leadId
                              }
                              uploading={attachInvoice.isPending || plInvoiceUploading}
                              onRequest={(e) => openRequestDialog(c, e)}
                              onUpload={
                                invoiceReq ? (e) => openUploadDialog(c, invoiceReq, e) : undefined
                              }
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Activity Log & Health Score Section */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <RecentActivityLog
              className="lg:col-span-2"
              title="Invoice Request Activity Log"
              items={invoiceActivityData?.items ?? []}
              isLoading={invoiceActivityLoading}
              emptyMessage="No invoice request activity for this hospital yet"
              viewAllHref="/finance/invoice-requests"
            />

            {/* Right Side Widget: P&L Health */}
            {(() => {
              const received = data?.kpis.amountReceived ?? 0
              const unsettled = data?.kpis.pendingOutstanding ?? 0
              const total = received + unsettled
              const receivedPercentage = total > 0 ? Math.round((received / total) * 100) : 0
              const strokeDashoffset = 213.6 * (1 - Math.min(100, Math.max(0, receivedPercentage)) / 100)
              return (
                <div className="bg-white border border-slate-200 dark:bg-[#191D2E]/60 dark:border-[#283150] rounded-xl p-3 flex flex-col items-center justify-center text-center gap-2 relative overflow-hidden shadow-sm dark:shadow-lg">
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle className="text-slate-200 dark:text-[#283150]" cx="40" cy="40" fill="transparent" r="34" stroke="currentColor" strokeWidth="4"></circle>
                      <circle className="text-cyan-500 dark:text-[#22d3ee] transition-all duration-1000" cx="40" cy="40" fill="transparent" r="34" stroke="currentColor" strokeDasharray="213.6" strokeDashoffset={strokeDashoffset} strokeWidth="4"></circle>
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-base font-bold text-slate-900 dark:text-white">{receivedPercentage}%</span>
                      <span className="text-[7px] font-bold text-slate-500 dark:text-[#c7c6cd] uppercase tracking-wider">RECEIVED</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-[#dce1ff]">Collection & Health Score</h4>
                    <p className="text-[11px] text-slate-500 dark:text-[#c7c6cd]/80 px-2 mt-0.5 leading-tight">
                      ₹{received.toLocaleString('en-IN')} received of ₹{total.toLocaleString('en-IN')} expected total.
                    </p>
                  </div>
                </div>
              )
            })()}
          </section>
        </div>
      </div>

      <Dialog open={!!requestCase || isBatchInvoice} onOpenChange={(open) => !open && closeRequestDialog()}>
        <DialogContent className="max-w-md bg-[#191D2E] border-[#283150] text-[#dce1ff]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#22d3ee]" />
              {isBatchInvoice ? `Request Batch Invoice (${selectedLeads.length} Cases)` : 'Request Invoice'}
            </DialogTitle>
            <DialogDescription className="text-[#c7c6cd]">
              {isBatchInvoice
                ? 'Submit invoice requests for all selected patient cases in this hospital.'
                : `${requestCase?.leadRef ?? 'Case'} · ${requestCase?.patientName ?? 'Patient'}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="invoice-number" className="text-xs text-[#c7c6cd]">Invoice number (optional)</Label>
              <Input
                id="invoice-number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-001"
                className="bg-[#07112f] border-[#283150] text-white focus:ring-[#22d3ee] focus:border-[#22d3ee]"
              />
            </div>
            {!isBatchInvoice && (
              <div className="space-y-1.5">
                <Label htmlFor="invoice-amount" className="text-xs text-[#c7c6cd]">Invoice amount (optional)</Label>
                <Input
                  id="invoice-amount"
                  type="number"
                  min={0}
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  placeholder="0"
                  className="bg-[#07112f] border-[#283150] text-white focus:ring-[#22d3ee] focus:border-[#22d3ee]"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="request-remarks" className="text-xs text-[#c7c6cd]">Remarks (optional)</Label>
              <Textarea
                id="request-remarks"
                value={requestRemarks}
                onChange={(e) => setRequestRemarks(e.target.value)}
                placeholder="Notes for Finance"
                rows={3}
                className="bg-[#07112f] border-[#283150] text-white focus:ring-[#22d3ee] focus:border-[#22d3ee]"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-[#283150]/30 mt-4">
            <Button
              variant="outline"
              onClick={closeRequestDialog}
              disabled={createInvoice.isPending}
              className="border-[#283150] bg-transparent text-[#c7c6cd] hover:bg-[#283150] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitRequest}
              disabled={createInvoice.isPending}
              className="bg-[#22d3ee] hover:bg-[#22d3ee]/90 text-[#07112f] font-bold"
            >
              {createInvoice.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                'Submit request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!uploadTarget} onOpenChange={(open) => !open && closeUploadDialog()}>
        <DialogContent className="max-w-md bg-[#191D2E] border-[#283150] text-[#dce1ff]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Upload className="h-5 w-5 text-[#22d3ee]" />
              Upload Invoice
            </DialogTitle>
            <DialogDescription className="text-[#c7c6cd]">
              {uploadTarget?.caseRow.leadRef ?? 'Case'} · {uploadTarget?.caseRow.patientName ?? 'Patient'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="upload-invoice-file" className="text-xs text-[#c7c6cd]">
                Invoice file (PDF or image)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="upload-invoice-file"
                  type="file"
                  accept={INVOICE_ATTACHMENT_ACCEPT}
                  onChange={(e) => handleUploadFileSelect(e.target.files?.[0])}
                  disabled={plInvoiceUploading || attachInvoice.isPending}
                  className="bg-[#07112f] border-[#283150] text-white focus:ring-[#22d3ee] focus:border-[#22d3ee]"
                />
                {plInvoiceUploading && <Loader2 className="h-4 w-4 animate-spin text-[#22d3ee]" />}
              </div>
              {uploadFileMeta && (
                <p className="text-xs text-[#22d3ee] flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  Ready: {uploadFileMeta.name}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="upload-invoice-number" className="text-xs text-[#c7c6cd]">
                Invoice number (optional)
              </Label>
              <Input
                id="upload-invoice-number"
                value={uploadInvoiceNumber}
                onChange={(e) => setUploadInvoiceNumber(e.target.value)}
                placeholder="INV-001"
                className="bg-[#07112f] border-[#283150] text-white focus:ring-[#22d3ee] focus:border-[#22d3ee]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="upload-invoice-amount" className="text-xs text-[#c7c6cd]">
                Invoice amount (optional)
              </Label>
              <Input
                id="upload-invoice-amount"
                type="number"
                min={0}
                value={uploadInvoiceAmount}
                onChange={(e) => setUploadInvoiceAmount(e.target.value)}
                placeholder="0"
                className="bg-[#07112f] border-[#283150] text-white focus:ring-[#22d3ee] focus:border-[#22d3ee]"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-[#283150]/30 mt-4">
            <Button
              variant="outline"
              onClick={closeUploadDialog}
              disabled={attachInvoice.isPending || plInvoiceUploading}
              className="border-[#283150] bg-transparent text-[#c7c6cd] hover:bg-[#283150] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitUpload}
              disabled={attachInvoice.isPending || plInvoiceUploading || !uploadFileMeta?.url}
              className="bg-[#22d3ee] hover:bg-[#22d3ee]/90 text-[#07112f] font-bold"
            >
              {attachInvoice.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Upload for Finance'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  )
}

/** Invoice column — shows only the status badge */
function InvoiceStatusCell({
  invoiceReq,
  invoicesLoading,
}: {
  invoiceReq?: InvoiceRequestRecord
  invoicesLoading: boolean
}) {
  if (invoicesLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  }

  if (!invoiceReq) {
    return (
      <Badge variant="outline" className="text-[#c7c6cd]/60 border-[#283150]">
        Pending
      </Badge>
    )
  }

  if (invoiceReq.status === 'PENDING') {
    const label = invoiceReq.invoicePdfUrl ? 'Uploaded' : INVOICE_REQUEST_STATUS_LABEL.PENDING
    return (
      <Badge variant={invoiceReq.invoicePdfUrl ? 'default' : 'secondary'}>
        {label}
      </Badge>
    )
  }

  const variant =
    invoiceReq.status === 'VERIFIED'
      ? 'default'
      : invoiceReq.status === 'REJECTED'
        ? 'destructive'
        : 'secondary'

  return (
    <Badge variant={variant}>
      {INVOICE_REQUEST_STATUS_LABEL[invoiceReq.status]}
    </Badge>
  )
}

/** Action column — shows request / upload / view invoice button */
function InvoiceActionCell({
  invoiceReq,
  invoicesLoading,
  canRequest,
  requesting,
  uploading,
  onRequest,
  onUpload,
}: {
  caseRow: HospitalCase
  invoiceReq?: InvoiceRequestRecord
  invoicesLoading: boolean
  canRequest: boolean
  requesting: boolean
  uploading: boolean
  onRequest: (e: React.MouseEvent) => void
  onUpload?: (e: React.MouseEvent) => void
}) {
  if (invoicesLoading) return null

  // VERIFIED with PDF → View Invoice link
  if (invoiceReq?.status === 'VERIFIED' && invoiceReq.invoicePdfUrl) {
    return (
      <a
        href={invoiceReq.invoicePdfUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 text-xs font-medium text-[#22d3ee] hover:underline"
      >
        <FileText className="h-3.5 w-3.5" />
        View Invoice
        <ExternalLink className="h-3 w-3" />
      </a>
    )
  }

  // VERIFIED without PDF yet → show label
  if (invoiceReq?.status === 'VERIFIED') {
    return (
      <span className="text-xs text-emerald-400 font-medium">Invoice Ready</span>
    )
  }

  // REJECTED → re-request button
  if (invoiceReq?.status === 'REJECTED' && canRequest) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button
          size="sm"
          variant="secondary"
          className="h-7 px-2 text-xs"
          onClick={onRequest}
          disabled={requesting}
        >
          {requesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Re-request'}
        </Button>
        {invoiceReq.rejectionRemarks && (
          <p className="max-w-[160px] text-[10px] text-muted-foreground line-clamp-2">
            {invoiceReq.rejectionRemarks}
          </p>
        )}
      </div>
    )
  }

  // PENDING → upload or view uploaded invoice
  if (invoiceReq?.status === 'PENDING' && canRequest && onUpload) {
    return (
      <div className="flex flex-col items-end gap-1">
        {invoiceReq.invoicePdfUrl && (
          <a
            href={invoiceReq.invoicePdfUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#22d3ee] hover:underline"
          >
            <FileText className="h-3.5 w-3.5" />
            View
          </a>
        )}
        <Button
          size="sm"
          variant={invoiceReq.invoicePdfUrl ? 'secondary' : 'default'}
          className="h-7 px-2 text-xs"
          onClick={onUpload}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : invoiceReq.invoicePdfUrl ? (
            'Replace'
          ) : (
            'Upload Invoice'
          )}
        </Button>
      </div>
    )
  }

  if (invoiceReq?.status === 'PENDING') {
    return <span className="text-xs text-[#c7c6cd]/50">Awaiting review</span>
  }

  // No invoice request yet → Request Invoice button
  if (canRequest) {
    return (
      <Button
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={onRequest}
        disabled={requesting}
      >
        {requesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Request Invoice'}
      </Button>
    )
  }

  return null
}

function KpiTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="border-sky-200/40 dark:border-sky-800/30">
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold tabular-nums">{value ?? '—'}</div>
      </CardContent>
    </Card>
  )
}
