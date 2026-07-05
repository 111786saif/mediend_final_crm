'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Activity,
  ReceiptText,
  UserCheck,
  TrendingUp,
  AlertCircle,
  Calendar,
  ArrowRight,
  Paperclip,
  X,
  FileText,
  ChevronRight,
} from 'lucide-react'
import { ProtectedRoute } from '@/components/protected-route'
import { ColumnFilter } from '@/components/ui/column-filter'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { apiGet, apiPost } from '@/lib/api-client'
import { formatPlDate, formatPlMonth, formatPlRupee } from '@/lib/pl/resolve-pl-row'
import { toast } from 'sonner'

type Attachment = {
  name: string
  url: string
  type: string
}

type HospitalDetail = {
  name: string
  kpis: {
    totalCases: number
    amountReceived: number
    pendingOutstanding: number
    mediendShare: number
  }
  cases: Array<{
    leadId: string
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
  }>
}

export default function HospitalDetailPage() {
  const params = useParams()
  const search = useSearchParams()
  const rawName = params.name as string
  const name = decodeURIComponent(rawName)
  const startDate = search.get('startDate')
  const endDate = search.get('endDate')

  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)

  // Filter states
  const [leadRefFilter, setLeadRefFilter] = useState<string>('')
  const [patientNameFilter, setPatientNameFilter] = useState<string>('')
  const [doctorFilter, setDoctorFilter] = useState<string[]>([])
  const [monthFilter, setMonthFilter] = useState<string[]>([])
  const [surgeryDateFilter, setSurgeryDateFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [billAmountFilter, setBillAmountFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [mediendShareAmountFilter, setMediendShareAmountFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [mediendReceivedFilter, setMediendReceivedFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [hospitalAmountPendingFilter, setHospitalAmountPendingFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [mediendInvoiceStatusFilter, setMediendInvoiceStatusFilter] = useState<string[]>([])

  const { data: filterConfig } = useQuery<{
    filters: Array<{
      field: string
      label: string
      filterType: string
      filterable: boolean
      options?: Array<{ label: string; value: string }>
      min?: number
      max?: number
    }>
  }>({
    queryKey: ['hospitals', name, 'filter-config'],
    queryFn: () => apiGet(`/api/hospitals/${encodeURIComponent(name)}/filter-config`),
    enabled: !!name,
    staleTime: 5 * 60 * 1000,
  })

  const filterOptions = useMemo(() => {
    const filters = filterConfig?.filters || []
    const find = (field: string) => filters.find((f) => f.field === field)
    return {
      doctors: find('doctor')?.options || [],
      statuses: find('status')?.options || [],
      mediendInvoiceStatuses: find('mediendInvoiceStatus')?.options || [],
      billBounds: { min: find('billAmount')?.min ?? 0, max: find('billAmount')?.max ?? 0 },
      shareBounds: { min: find('mediendShareAmount')?.min ?? 0, max: find('mediendShareAmount')?.max ?? 0 },
      receivedBounds: { min: find('mediendReceived')?.min ?? 0, max: find('mediendReceived')?.max ?? 0 },
      pendingBounds: { min: find('hospitalAmountPending')?.min ?? 0, max: find('hospitalAmountPending')?.max ?? 0 },
    }
  }, [filterConfig])

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
        `/api/hospitals/${encodeURIComponent(name)}${tail ? `?${tail}` : ''}`
      )
    },
    enabled: !!name,
  })

  const activeFilterCount =
    (leadRefFilter.trim() ? 1 : 0) +
    (patientNameFilter.trim() ? 1 : 0) +
    doctorFilter.length +
    monthFilter.length +
    surgeryDateFilter.length +
    statusFilter.length +
    (billAmountFilter ? 1 : 0) +
    (mediendShareAmountFilter ? 1 : 0) +
    (mediendReceivedFilter ? 1 : 0) +
    (hospitalAmountPendingFilter ? 1 : 0) +
    mediendInvoiceStatusFilter.length

  const clearFilters = () => {
    setLeadRefFilter('')
    setPatientNameFilter('')
    setDoctorFilter([])
    setMonthFilter([])
    setSurgeryDateFilter([])
    setStatusFilter([])
    setBillAmountFilter(null)
    setMediendShareAmountFilter(null)
    setMediendReceivedFilter(null)
    setHospitalAmountPendingFilter(null)
    setMediendInvoiceStatusFilter([])
  }

  // Pre-fill request fields on dialog open or cases select change
  useEffect(() => {
    if (!requestDialogOpen || !data?.cases) return
    const selectedCases = data.cases.filter((c) => selectedLeads.includes(c.leadId))
    if (selectedCases.length === 0) return

    if (selectedCases.length === 1) {
      const c = selectedCases[0]
      setTitle(`Invoice Request: ${name} - ${c.patientName ?? 'Patient'} (${c.leadRef ?? ''})`)
      setAmount(c.mediendShareAmount ? String(c.mediendShareAmount) : '')
      setDescription(
        `Requesting invoice for Hospital: ${name}\n` +
        `Patient Name: ${c.patientName ?? '—'}\n` +
        `Doctor: ${c.doctorName ?? '—'}\n` +
        `: ${c.leadRef ?? '—'}\n` +
        `Surgery Date: ${c.surgeryDate ? new Date(c.surgeryDate).toLocaleDateString('en-IN') : '—'}\n` +
        `Bill Amount: ${formatPlRupee(c.billAmount)}\n` +
        `MediEND Share: ${formatPlRupee(c.mediendShareAmount)}\n` +
        `Pending Amount: ${formatPlRupee(c.hospitalAmountPending)}`
      )
    } else {
      const totalMediendShare = selectedCases.reduce((sum, c) => sum + (c.mediendShareAmount ?? 0), 0)
      setTitle(`Invoice Request: ${name} - ${selectedCases.length} Cases`)
      setAmount(String(totalMediendShare))
      const casesDetails = selectedCases
        .map(
          (c) =>
            `- Lead Ref: ${c.leadRef ?? '—'}, Patient: ${c.patientName ?? '—'}, MediEND Share: ${formatPlRupee(
              c.mediendShareAmount
            )}`
        )
        .join('\n')
      setDescription(
        `Requesting batch invoice for Hospital: ${name} (${selectedCases.length} cases).\n\n` +
        `Cases Summary:\n${casesDetails}\n\n` +
        `Total MediEND Share: ${formatPlRupee(totalMediendShare)}`
      )
    }
  }, [requestDialogOpen, selectedLeads, data, name])

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

  const queryClient = useQueryClient()
  const createMutation = useMutation({
    mutationFn: (payload: { title: string; description?: string; amount?: number; attachments?: Attachment[] }) =>
      apiPost('/api/md-approvals', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['md-approvals'] })
      queryClient.invalidateQueries({ queryKey: ['badge-counts'] })
      setRequestDialogOpen(false)
      setTitle('')
      setDescription('')
      setAmount('')
      setAttachments([])
      setSelectedLeads([])
      toast.success('Invoice request submitted successfully to MD')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreateRequest = () => {
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

  const renderCellAmount = (value: number | null, colorClass?: string) => {
    if (value == null || value === 0) {
      return <span className="text-slate-300 dark:text-slate-700">—</span>
    }
    return <span className={colorClass}>{formatPlRupee(value)}</span>
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/35 to-indigo-50/35 p-6 dark:from-slate-950 dark:via-sky-950/20 dark:to-slate-900">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              asChild
              className="h-9 w-9 rounded-full border-cyan-100 bg-white/80 shadow-sm transition-all duration-200 hover:bg-cyan-50 dark:border-cyan-900/40 dark:bg-slate-900 dark:hover:bg-slate-800/80 shrink-0"
            >
              <Link href="/hospitals" aria-label="Back to hospital list">
                <ArrowLeft className="h-4 w-4 text-cyan-700 dark:text-cyan-300" />
              </Link>
            </Button>
            <div>
              <nav className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/80 mb-1 leading-none">
                <Link href="/hospitals" className="hover:text-cyan-600 transition-colors">
                  Hospital List
                </Link>
                <ChevronRight className="h-3 w-3 opacity-60 shrink-0" />
                <span className="text-slate-800 dark:text-slate-200 font-semibold">{name}</span>
              </nav>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-none">
                  {name}
                </h1>
                {startDate && endDate && (
                  <div className="inline-flex items-center gap-1 rounded-full bg-cyan-50/80 px-2 py-0.5 text-[10px] font-medium text-cyan-800 border border-cyan-200/50 dark:bg-cyan-950/20 dark:text-cyan-300 dark:border-cyan-800/40 shrink-0 ml-1">
                    <span className="h-1 w-1 rounded-full bg-cyan-500 animate-pulse" />
                    Filtered: {startDate} → {endDate}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <KpiTile label="Cases" value={data?.kpis.totalCases ?? 0} icon={Activity} />
            <KpiTile label="Amount received" value={formatPlRupee(data?.kpis.amountReceived ?? null)} icon={TrendingUp} />
            <KpiTile label="Pending outstanding" value={formatPlRupee(data?.kpis.pendingOutstanding ?? null)} icon={AlertCircle} className={data?.kpis.pendingOutstanding ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''} />
            <KpiTile label="Total MediEND share" value={formatPlRupee(data?.kpis.mediendShare ?? null)} icon={ReceiptText} />
          </div>

          <Card className="overflow-hidden border-sky-200/50 shadow-md dark:border-sky-800/40">
            <CardHeader className="border-b bg-gradient-to-r from-sky-500/10 to-indigo-500/8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/10 to-teal-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shadow-sm shrink-0">
                    <Activity className="h-5 w-5 animate-pulse" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-none">
                        Cases
                      </h2>
                      {activeFilterCount > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-rose-600 dark:text-rose-400 hover:text-rose-700 font-medium px-2 py-0"
                          onClick={clearFilters}
                        >
                          Clear Filters ({activeFilterCount})
                        </Button>
                      )}
                    </div>
                    <span className="text-xs font-normal text-muted-foreground flex items-center gap-1.5 leading-none">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                      </span>
                      Click a case to open its outstanding record
                    </span>
                  </div>
                </div>
                <div>
                  <Button
                    disabled={selectedLeads.length === 0}
                    onClick={() => setRequestDialogOpen(true)}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white font-medium text-xs h-9 px-4 rounded-lg flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all duration-150"
                  >
                    <FileText className="h-4 w-4" />
                    Request Invoice {selectedLeads.length > 0 && `(${selectedLeads.length})`}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100/85 hover:bg-slate-100/85 dark:bg-slate-900/60 border-b border-cyan-100 dark:border-cyan-950/40">
                    <TableHead className="w-[50px] pl-4">
                      <Checkbox
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
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Lead Ref</span>
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
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Patient</span>
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
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Doctor</span>
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
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Month</span>
                        <ColumnFilter
                          type="dateRange"
                          value={monthFilter}
                          onChange={monthFilter => setMonthFilter(monthFilter)}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[130px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Surgery</span>
                        <ColumnFilter
                          type="dateRange"
                          value={surgeryDateFilter}
                          onChange={setSurgeryDateFilter}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[140px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Status</span>
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
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Bill</span>
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
                        <span className="font-semibold text-slate-700 dark:text-slate-300">MediEND share</span>
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
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Received</span>
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
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Pending</span>
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
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Invoice</span>
                        <ColumnFilter
                          type="multiSelect"
                          options={filterOptions.mediendInvoiceStatuses}
                          value={mediendInvoiceStatusFilter}
                          onChange={setMediendInvoiceStatusFilter}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 w-[180px] pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : !data?.cases?.length ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                        No cases yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.cases.map((c) => (
                      <TableRow
                        key={c.leadId}
                        className="cursor-pointer transition-colors duration-150 hover:bg-cyan-50/20 dark:hover:bg-cyan-950/10 border-b border-cyan-100/40 dark:border-cyan-950/30"
                        onClick={() => (window.location.href = `/pl/outstanding/${c.leadId}`)}
                      >
                        <TableCell className="w-[50px] pl-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedLeads.includes(c.leadId)}
                            onCheckedChange={(checked) => {
                              setSelectedLeads((prev) =>
                                checked
                                  ? [...prev, c.leadId]
                                  : prev.filter((id) => id !== c.leadId)
                              )
                            }}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium text-slate-900 dark:text-slate-100">{c.leadRef ?? '—'}</TableCell>
                        <TableCell className="text-slate-700 dark:text-slate-300">{c.patientName ?? '—'}</TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">{c.doctorName ?? '—'}</TableCell>
                        <TableCell className="tabular-nums text-slate-600 dark:text-slate-400">{formatPlMonth(c.month ? new Date(c.month) : null)}</TableCell>
                        <TableCell className="tabular-nums text-slate-600 dark:text-slate-400">{formatPlDate(c.surgeryDate ? new Date(c.surgeryDate) : null)}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                            {c.status ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-slate-600 dark:text-slate-400">{renderCellAmount(c.billAmount)}</TableCell>
                        <TableCell className="text-right tabular-nums text-slate-900 dark:text-slate-100 font-semibold">{renderCellAmount(c.mediendShareAmount)}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">{renderCellAmount(c.mediendReceived)}</TableCell>
                        <TableCell className="text-right tabular-nums text-rose-600 dark:text-rose-400 font-medium">{renderCellAmount(c.hospitalAmountPending)}</TableCell>
                        <TableCell>
                          <Badge
                            className={`border ${
                              c.mediendInvoiceStatus === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/30'
                                : c.mediendInvoiceStatus === 'SENT'
                                  ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-50 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800/30'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/30'
                            }`}
                          >
                            {c.mediendInvoiceStatus ?? 'PENDING'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs border-cyan-200/60 bg-cyan-50/20 text-cyan-700 hover:bg-cyan-50/50 hover:text-cyan-800 dark:border-cyan-800/40 dark:bg-cyan-950/10 dark:text-cyan-400 dark:hover:bg-cyan-950/30"
                              onClick={() => {
                                setSelectedLeads([c.leadId])
                                setRequestDialogOpen(true)
                              }}
                            >
                              Request Invoice
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-cyan-600 dark:hover:text-cyan-400"
                              asChild
                            >
                              <Link href={`/pl/outstanding/${c.leadId}`}>
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              Request MD Approval for Invoice
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Request Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter request title"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description / Case Summary</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Case details..."
                rows={6}
                className="mt-1 text-xs font-mono"
              />
            </div>
            <div>
              <Label>Amount (INR)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Attachments (optional)</Label>
              <Input
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
                disabled={uploadingFiles}
                className="mt-1 cursor-pointer text-xs"
              />
              {uploadingFiles && <p className="text-[11px] text-muted-foreground mt-1">Uploading files...</p>}
              {attachments.length > 0 && (
                <div className="mt-2 space-y-1 bg-slate-50 dark:bg-slate-900 p-2 rounded-md border text-xs">
                  {attachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{a.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                        onClick={() => removeAttachment(i)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRequestDialogOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreateRequest}
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  )
}

function KpiTile({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string
  value: React.ReactNode
  icon: any
  className?: string
}) {
  return (
    <Card className={`overflow-hidden shadow-sm bg-white dark:bg-slate-900 border-cyan-200/45 dark:border-cyan-800/30 ${className}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          <div className="rounded bg-slate-50 dark:bg-slate-950 p-1 text-cyan-600 dark:text-cyan-400 shrink-0">
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className="text-base font-bold tabular-nums mt-1.5 text-slate-900 dark:text-slate-50">{value ?? '—'}</div>
      </CardContent>
    </Card>
  )
}
