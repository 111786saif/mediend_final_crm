'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Stethoscope,
  Activity,
  ReceiptText,
  UserCheck,
  TrendingUp,
  AlertCircle,
  Calendar,
  Paperclip,
  X,
  FileText,
  ChevronRight,
} from 'lucide-react'
import { ProtectedRoute } from '@/components/protected-route'
import { RecentActivityLog } from '@/components/recent-activity-log'
import { RecordPaymentForm } from '@/components/record-payment-form'
import { ColumnFilter } from '@/components/ui/column-filter'
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

type DoctorDetail = {
  name: string
  kpis: {
    totalCases: number
    totalBill: number
    totalPayable: number
    amountPaid: number
    amountPending: number
    doctorShare: number
    mediendShare: number
  }
  cases: Array<{
    leadId: string
    leadRef: string | null
    patientName: string | null
    hospitalName: string | null
    surgeryDate: string | null
    month: string | null
    status: string | null
    billAmount: number | null
    doctorCharges: number | null
    doctorAmountPending: number | null
    doctorPayoutStatus: string | null
    doctorPaid: number
    mediendShareAmount: number | null
  }>
}

export default function DoctorDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const rawName = Array.isArray(params.name) ? params.name[0] : params.name
  const name = decodeURIComponent(rawName || '')
  const startDate = searchParams.get('startDate') || ''
  const endDate = searchParams.get('endDate') || ''

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
  const [hospitalFilter, setHospitalFilter] = useState<string[]>([])
  const [monthFilter, setMonthFilter] = useState<string[]>([])
  const [surgeryDateFilter, setSurgeryDateFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [billAmountFilter, setBillAmountFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [doctorChargesFilter, setDoctorChargesFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [doctorPaidFilter, setDoctorPaidFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [doctorAmountPendingFilter, setDoctorAmountPendingFilter] = useState<{ min: number | null; max: number | null } | null>(null)
  const [doctorPayoutStatusFilter, setDoctorPayoutStatusFilter] = useState<string[]>([])

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
    queryKey: ['doctors', name, 'filter-config'],
    queryFn: () => apiGet(`/api/doctors/${encodeURIComponent(name)}/filter-config`),
    enabled: !!name,
    staleTime: 5 * 60 * 1000,
  })

  const filterOptions = useMemo(() => {
    const filters = filterConfig?.filters || []
    const find = (field: string) => filters.find((f) => f.field === field)
    return {
      hospitals: find('hospital')?.options || [],
      statuses: find('status')?.options || [],
      doctorPayoutStatuses: find('doctorPayoutStatus')?.options || [],
      billBounds: { min: find('billAmount')?.min ?? 0, max: find('billAmount')?.max ?? 0 },
      chargesBounds: { min: find('doctorCharges')?.min ?? 0, max: find('doctorCharges')?.max ?? 0 },
      paidBounds: { min: find('doctorPaid')?.min ?? 0, max: find('doctorPaid')?.max ?? 0 },
      pendingBounds: { min: find('doctorAmountPending')?.min ?? 0, max: find('doctorAmountPending')?.max ?? 0 },
    }
  }, [filterConfig])

  const { data, isLoading } = useQuery<DoctorDetail>({
    queryKey: [
      'doctors', name, startDate, endDate,
      leadRefFilter, patientNameFilter, hospitalFilter, monthFilter,
      surgeryDateFilter, statusFilter, billAmountFilter, doctorChargesFilter,
      doctorPaidFilter, doctorAmountPendingFilter, doctorPayoutStatusFilter,
    ],
    queryFn: () => {
      const filters = []
      if (leadRefFilter.trim()) filters.push({ field: 'leadRef', operator: 'contains', value: leadRefFilter })
      if (patientNameFilter.trim()) filters.push({ field: 'patientName', operator: 'contains', value: patientNameFilter })
      if (hospitalFilter.length > 0) filters.push({ field: 'hospital', operator: 'in', value: hospitalFilter })
      if (statusFilter.length > 0) filters.push({ field: 'status', operator: 'in', value: statusFilter })
      if (doctorPayoutStatusFilter.length > 0) filters.push({ field: 'doctorPayoutStatus', operator: 'in', value: doctorPayoutStatusFilter })

      if (monthFilter.length === 2 && monthFilter[0]) {
        filters.push({ field: 'month', operator: 'between', value: monthFilter })
      }
      if (surgeryDateFilter.length === 2 && surgeryDateFilter[0]) {
        filters.push({ field: 'surgeryDate', operator: 'between', value: surgeryDateFilter })
      }

      if (billAmountFilter && (billAmountFilter.min != null || billAmountFilter.max != null)) {
        filters.push({ field: 'billAmount', operator: 'between', value: billAmountFilter })
      }
      if (doctorChargesFilter && (doctorChargesFilter.min != null || doctorChargesFilter.max != null)) {
        filters.push({ field: 'doctorCharges', operator: 'between', value: doctorChargesFilter })
      }
      if (doctorPaidFilter && (doctorPaidFilter.min != null || doctorPaidFilter.max != null)) {
        filters.push({ field: 'doctorPaid', operator: 'between', value: doctorPaidFilter })
      }
      if (doctorAmountPendingFilter && (doctorAmountPendingFilter.min != null || doctorAmountPendingFilter.max != null)) {
        filters.push({ field: 'doctorAmountPending', operator: 'between', value: doctorAmountPendingFilter })
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
      return apiGet<DoctorDetail>(
        `/api/doctors/${encodeURIComponent(name)}${tail ? `?${tail}` : ''}`
      )
    },
    enabled: !!name,
  })

  const activeFilterCount =
    (leadRefFilter.trim() ? 1 : 0) +
    (patientNameFilter.trim() ? 1 : 0) +
    hospitalFilter.length +
    monthFilter.length +
    surgeryDateFilter.length +
    statusFilter.length +
    (billAmountFilter ? 1 : 0) +
    (doctorChargesFilter ? 1 : 0) +
    (doctorPaidFilter ? 1 : 0) +
    (doctorAmountPendingFilter ? 1 : 0) +
    doctorPayoutStatusFilter.length

  const clearFilters = () => {
    setLeadRefFilter('')
    setPatientNameFilter('')
    setHospitalFilter([])
    setMonthFilter([])
    setSurgeryDateFilter([])
    setStatusFilter([])
    setBillAmountFilter(null)
    setDoctorChargesFilter(null)
    setDoctorPaidFilter(null)
    setDoctorAmountPendingFilter(null)
    setDoctorPayoutStatusFilter([])
  }

  // Pre-fill request fields on dialog open or cases select change
  useEffect(() => {
    if (!requestDialogOpen || !data?.cases) return
    const selectedCases = data.cases.filter((c) => selectedLeads.includes(c.leadId))
    if (selectedCases.length === 0) return

    if (selectedCases.length === 1) {
      const c = selectedCases[0]
      setTitle(`Invoice Request: ${name} - ${c.patientName ?? 'Patient'} (${c.leadRef ?? ''})`)
      setAmount(c.doctorCharges ? String(c.doctorCharges) : '')
      setDescription(
        `Requesting invoice for Doctor: ${name}\n` +
        `Patient Name: ${c.patientName ?? '—'}\n` +
        `Hospital: ${c.hospitalName ?? '—'}\n` +
        `Lead Ref: ${c.leadRef ?? '—'}\n` +
        `Surgery Date: ${c.surgeryDate ? new Date(c.surgeryDate).toLocaleDateString('en-IN') : '—'}\n` +
        `Bill Amount: ${formatPlRupee(c.billAmount)}\n` +
        `Doctor Charges: ${formatPlRupee(c.doctorCharges)}\n` +
        `Pending Amount: ${formatPlRupee(c.doctorAmountPending)}`
      )
    } else {
      const totalDoctorCharges = selectedCases.reduce((sum, c) => sum + (c.doctorCharges ?? 0), 0)
      setTitle(`Invoice Request: ${name} - ${selectedCases.length} Cases`)
      setAmount(String(totalDoctorCharges))
      const casesDetails = selectedCases
        .map(
          (c) =>
            `- Lead Ref: ${c.leadRef ?? '—'}, Patient: ${c.patientName ?? '—'}, Charges: ${formatPlRupee(
              c.doctorCharges
            )}`
        )
        .join('\n')
      setDescription(
        `Requesting batch invoice for Doctor: ${name} (${selectedCases.length} cases).\n\n` +
        `Cases Summary:\n${casesDetails}\n\n` +
        `Total Doctor Charges: ${formatPlRupee(totalDoctorCharges)}`
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
      <div className="min-h-screen w-full min-w-0 bg-[#07112f] text-[#dce1ff] p-6 font-sans selection:bg-[#22d3ee]/30 selection:text-white">
        <div className="w-full min-w-0 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                asChild
                className="h-9 w-9 rounded-full border-[#283150] bg-[#191D2E]/80 text-[#22d3ee] shadow-sm transition-all duration-200 hover:bg-[#283150] hover:text-[#22d3ee] shrink-0"
              >
                <Link href="/doctors" aria-label="Back to doctor list">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <nav className="flex items-center gap-1.5 text-[11px] font-medium text-[#c7c6cd]/60 mb-1 leading-none">
                  <Link href="/doctors" className="hover:text-[#22d3ee] transition-colors">
                    Doctor List
                  </Link>
                  <ChevronRight className="h-3 w-3 opacity-60 shrink-0" />
                  <span className="text-[#dce1ff] font-semibold">{name}</span>
                </nav>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-[#dce1ff] leading-none">
                    {name}
                  </h1>
                  {startDate && endDate && (
                    <div className="inline-flex items-center gap-1 rounded-full bg-[#22d3ee]/10 px-2 py-0.5 text-[10px] font-medium text-[#22d3ee] border border-[#22d3ee]/20 shrink-0 ml-1">
                      <span className="h-1 w-1 rounded-full bg-[#22d3ee] animate-pulse" />
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
                  const urlParams = new URLSearchParams(searchParams.toString())
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
                  <Button variant="outline" className="bg-[#191D2E]/80 border-[#283150] text-[#dce1ff] hover:bg-[#283150] h-9 text-xs">
                    <Calendar className="mr-2 h-3.5 w-3.5" />
                    Date Range
                  </Button>
                }
              />
              <Button className="bg-[#25E8FF] text-[#07112f] hover:brightness-110 font-bold h-9 text-xs shadow-md shadow-[#25E8FF]/20">
                Add Document
              </Button>
            </div>
          </div>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            <KpiTile label="Cases" value={data?.kpis.totalCases ?? 0} icon={Activity} />
            <KpiTile label="Total bill" value={formatPlRupee(data?.kpis.totalBill ?? null)} icon={ReceiptText} />
            <KpiTile label="Total payable" value={formatPlRupee(data?.kpis.totalPayable ?? null)} icon={UserCheck} />
            <KpiTile label="Paid" value={formatPlRupee(data?.kpis.amountPaid ?? null)} icon={TrendingUp} />
            <KpiTile label="Pending" value={formatPlRupee(data?.kpis.amountPending ?? null)} icon={AlertCircle} className={data?.kpis.amountPending ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''} />
            <KpiTile label="Doctor share" value={formatPlRupee(data?.kpis.doctorShare ?? null)} icon={UserCheck} />
            <KpiTile label="MediEND share" value={formatPlRupee(data?.kpis.mediendShare ?? null)} icon={TrendingUp} />
          </div>

          {/* Payout UI Section */}
          <RecordPaymentForm
            title="Record Doctor Payout"
            amountLabel="Amount Paid"
            onSubmit={(amount, mode, txnId) => {
              toast.success(`Payout of ₹${amount || '0'} recorded successfully!`)
            }}
          />

          {/* Cases Table Component Container (UI preserved as requested, wrapper styled) */}
          <div className="min-w-0 w-full bg-[#191D2E]/60 backdrop-blur-md border border-[#283150] rounded-xl overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-[#283150] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#191D2E]/80">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#22d3ee]/10 text-[#22d3ee] border border-[#22d3ee]/20 shadow-sm shrink-0">
                  <Activity className="h-5 w-5 animate-pulse" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-white tracking-tight leading-none">
                      Cases
                    </h2>
                    {activeFilterCount > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-rose-400 hover:text-rose-300 font-medium px-2 py-0"
                        onClick={clearFilters}
                      >
                        Clear Filters ({activeFilterCount})
                      </Button>
                    )}
                  </div>
                  <span className="text-xs font-normal text-[#c7c6cd]/70 flex items-center gap-1.5 leading-none">
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
                  className="bg-[#22d3ee] hover:bg-[#22d3ee]/90 text-[#07112f] font-bold text-xs h-9 px-4 rounded-lg flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all duration-150"
                >
                  <FileText className="h-4 w-4" />
                  Request Invoice {selectedLeads.length > 0 && `(${selectedLeads.length})`}
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#191D2E]/90 hover:bg-[#191D2E]/90 border-b border-[#283150]">
                    <TableHead className="w-[50px] pl-4">
                      <Checkbox
                        className="border-[#283150] data-[state=checked]:bg-[#22d3ee] data-[state=checked]:text-[#07112f]"
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
                        <span className="font-semibold text-[#c7c6cd]">Lead Ref</span>
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
                        <span className="font-semibold text-[#c7c6cd]">Patient</span>
                        <ColumnFilter
                          type="search"
                          value={patientNameFilter}
                          onChange={setPatientNameFilter}
                          placeholder="Search..."
                        />
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[180px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="font-semibold text-[#c7c6cd]">Hospital</span>
                        <ColumnFilter
                          type="multiSelect"
                          options={filterOptions.hospitals}
                          value={hospitalFilter}
                          onChange={setHospitalFilter}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[130px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="font-semibold text-[#c7c6cd]">Month</span>
                        <ColumnFilter
                          type="dateRange"
                          value={monthFilter}
                          onChange={monthFilter => setMonthFilter(monthFilter)}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[130px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="font-semibold text-[#c7c6cd]">Surgery</span>
                        <ColumnFilter
                          type="dateRange"
                          value={surgeryDateFilter}
                          onChange={setSurgeryDateFilter}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[140px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="font-semibold text-[#c7c6cd]">Status</span>
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
                        <span className="font-semibold text-[#c7c6cd]">Bill</span>
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
                        <span className="font-semibold text-[#c7c6cd]">Doctor Charges</span>
                        <ColumnFilter
                          type="numberRange"
                          value={doctorChargesFilter}
                          onChange={setDoctorChargesFilter}
                          min={filterOptions.chargesBounds.min}
                          max={filterOptions.chargesBounds.max}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[140px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap justify-end">
                        <span className="font-semibold text-[#c7c6cd]">Paid</span>
                        <ColumnFilter
                          type="numberRange"
                          value={doctorPaidFilter}
                          onChange={setDoctorPaidFilter}
                          min={filterOptions.paidBounds.min}
                          max={filterOptions.paidBounds.max}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[140px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap justify-end">
                        <span className="font-semibold text-[#c7c6cd]">Pending</span>
                        <ColumnFilter
                          type="numberRange"
                          value={doctorAmountPendingFilter}
                          onChange={setDoctorAmountPendingFilter}
                          min={filterOptions.pendingBounds.min}
                          max={filterOptions.pendingBounds.max}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[130px]">
                      <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                        <span className="font-semibold text-[#c7c6cd]">Payout</span>
                        <ColumnFilter
                          type="multiSelect"
                          options={filterOptions.doctorPayoutStatuses}
                          value={doctorPayoutStatusFilter}
                          onChange={setDoctorPayoutStatusFilter}
                        />
                      </div>
                    </TableHead>
                    <TableHead className="text-right font-semibold text-[#c7c6cd] w-[180px] pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-[#283150]/30">
                  {isLoading ? (
                    <TableRow className="border-b border-[#283150]/20">
                      <TableCell colSpan={13} className="text-center py-8 text-[#c7c6cd]/55">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : !data?.cases?.length ? (
                    <TableRow className="border-b border-[#283150]/20">
                      <TableCell colSpan={13} className="text-center py-8 text-[#c7c6cd]/55">
                        No cases yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.cases.map((c) => (
                      <TableRow
                        key={c.leadId}
                        className="cursor-pointer transition-colors duration-150 hover:bg-[#22d3ee]/5 border-b border-[#283150]/20"
                        onClick={() => (window.location.href = `/pl/outstanding/${c.leadId}`)}
                      >
                        <TableCell className="w-[50px] pl-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            className="border-[#283150] data-[state=checked]:bg-[#22d3ee] data-[state=checked]:text-[#07112f]"
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
                        <TableCell className="whitespace-nowrap font-medium text-white">{c.leadRef ?? '—'}</TableCell>
                        <TableCell className="text-[#dce1ff]">{c.patientName ?? '—'}</TableCell>
                        <TableCell className="text-[#c7c6cd]">{c.hospitalName ?? '—'}</TableCell>
                        <TableCell className="tabular-nums text-[#c7c6cd]/80">{formatPlMonth(c.month ? new Date(c.month) : null)}</TableCell>
                        <TableCell className="tabular-nums text-[#c7c6cd]/80">{formatPlDate(c.surgeryDate ? new Date(c.surgeryDate) : null)}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-md bg-[#07112f] px-2 py-0.5 text-xs font-semibold text-[#c7c6cd] border border-[#283150]">
                            {c.status ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-[#c7c6cd]">{renderCellAmount(c.billAmount)}</TableCell>
                        <TableCell className="text-right tabular-nums text-white font-bold">{renderCellAmount(c.doctorCharges)}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-400 font-semibold">{renderCellAmount(c.doctorPaid, 'text-emerald-400')}</TableCell>
                        <TableCell className="text-right tabular-nums text-rose-400 font-semibold">{renderCellAmount(c.doctorAmountPending, 'text-rose-400')}</TableCell>
                        <TableCell>
                          <Badge
                            className={`border ${c.doctorPayoutStatus === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/10'
                              : c.doctorPayoutStatus === 'PARTIAL'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/25 hover:bg-amber-500/10'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/25 hover:bg-rose-500/10'
                              }`}
                          >
                            {c.doctorPayoutStatus ?? 'PENDING'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs bg-[#22d3ee]/10 text-[#22d3ee] border border-[#22d3ee]/30 hover:bg-[#22d3ee]/20"
                            variant="outline"
                            onClick={() => {
                              setSelectedLeads([c.leadId])
                              setRequestDialogOpen(true)
                            }}
                          >
                            <FileText className="mr-1 h-3.5 w-3.5" />
                            Request Invoice
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Activity Log & Health Score Section */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <RecentActivityLog className="lg:col-span-2" />

            {/* Right Side Widget: P&L Health */}
            <div className="bg-[#191D2E]/60 backdrop-blur-md border border-[#283150] rounded-xl p-3 flex flex-col items-center justify-center text-center gap-2 relative overflow-hidden shadow-lg">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle className="text-[#283150]" cx="40" cy="40" fill="transparent" r="34" stroke="currentColor" strokeWidth="4"></circle>
                  <circle className="text-[#22d3ee] transition-all duration-1000" cx="40" cy="40" fill="transparent" r="34" stroke="currentColor" strokeDasharray="213.6" strokeDashoffset="42.7" strokeWidth="4"></circle>
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-base font-bold text-white">80%</span>
                  <span className="text-[7px] font-bold text-[#c7c6cd] uppercase tracking-wider">COLLECTION</span>
                </div>
              </div>
              <div>
                <h4 className="font-bold text-xs text-[#dce1ff]">Collection & Health Score</h4>
                <p className="text-[11px] text-[#c7c6cd]/80 px-2 mt-0.5 leading-tight">Your doctor portfolio is performing above average for this cluster.</p>
                <button className="mt-1.5 border border-[#22d3ee]/40 text-[#22d3ee] px-3 py-0.5 rounded-full text-[10px] hover:bg-[#22d3ee]/10 transition-all font-semibold">
                  Full Analysis
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-md bg-[#191D2E] border-[#283150] text-[#dce1ff]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <FileText className="h-5 w-5 text-[#22d3ee]" />
              Request MD Approval for Invoice
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-[#c7c6cd]">Request Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter request title"
                className="mt-1 bg-[#07112f] border-[#283150] text-white focus:ring-[#22d3ee] focus:border-[#22d3ee]"
              />
            </div>
            <div>
              <Label className="text-xs text-[#c7c6cd]">Description / Case Summary</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Case details..."
                rows={6}
                className="mt-1 text-xs font-mono bg-[#07112f] border-[#283150] text-white focus:ring-[#22d3ee] focus:border-[#22d3ee]"
              />
            </div>
            <div>
              <Label className="text-xs text-[#c7c6cd]">Amount (INR)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="mt-1 bg-[#07112f] border-[#283150] text-white focus:ring-[#22d3ee] focus:border-[#22d3ee]"
              />
            </div>
            <div>
              <Label className="text-xs text-[#c7c6cd]">Attachments (optional)</Label>
              <Input
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
                disabled={uploadingFiles}
                className="mt-1 cursor-pointer text-xs bg-[#07112f] border-[#283150] text-white focus:ring-[#22d3ee] focus:border-[#22d3ee]"
              />
              {uploadingFiles && <p className="text-[11px] text-[#c7c6cd]/70 mt-1">Uploading files...</p>}
              {attachments.length > 0 && (
                <div className="mt-2 space-y-1 bg-[#07112f] p-2 rounded-md border border-[#283150] text-xs text-[#c7c6cd]">
                  {attachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Paperclip className="h-3 w-3 text-[#c7c6cd]/75 shrink-0" />
                      <span className="truncate flex-1">{a.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-rose-400 hover:text-rose-300 hover:bg-[#283150]"
                        onClick={() => removeAttachment(i)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#283150] mt-4">
              <Button
                variant="outline"
                size="sm"
                className="border-[#283150] bg-transparent text-[#c7c6cd] hover:bg-[#283150] hover:text-white"
                onClick={() => setRequestDialogOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreateRequest}
                className="bg-[#22d3ee] hover:bg-[#22d3ee]/90 text-[#07112f] font-bold"
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
  className = '',
}: {
  label: string
  value: React.ReactNode
  icon: any
  className?: string
}) {
  const isPending = label.toLowerCase() === 'pending'
  const isPaid = label.toLowerCase() === 'paid'

  return (
    <div
      className={`bg-[#191D2E]/60 backdrop-blur-md border ${isPending
        ? 'border-rose-500/30 shadow-lg shadow-rose-950/5'
        : 'border-[#283150]'
        } p-3.5 rounded-xl flex flex-col gap-2 shadow-lg hover:shadow-[#22d3ee]/5 transition-all duration-200 ${className}`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#c7c6cd]/75">{label}</span>
        <div className={`p-1 rounded shrink-0 ${isPending
          ? 'bg-rose-500/10 text-rose-400'
          : isPaid
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-[#22d3ee]/10 text-[#22d3ee]'
          }`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className={`text-base font-bold tabular-nums leading-none ${isPending
        ? 'text-rose-400'
        : isPaid
          ? 'text-emerald-400'
          : 'text-white'
        }`}>
        {value ?? '—'}
      </div>
    </div>
  )
}
