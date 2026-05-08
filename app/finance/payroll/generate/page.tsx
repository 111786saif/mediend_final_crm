'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch } from '@/lib/api-client'
import {
  calculateProRatedSalary,
  calculateEPF,
  calculateESIC,
  calculateTDSAmount,
  calculateNetPay,
  isESICApplicableByRule,
} from '@/lib/hrms/salary-calculation'
import {
  type Employee,
  type SalaryStructure,
  type MonthlyPayroll,
  type AttendanceSummary,
  MONTHS,
  formatCurrency,
} from '@/lib/finance/payroll-types'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { ArrowLeft, Calendar, CreditCard, Building2, Landmark, Shield, IndianRupee } from 'lucide-react'

const CREATE_MORE_STORAGE_KEY = 'payroll-generate-create-more'

export default function GeneratePayrollPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const contentRef = useRef<HTMLDivElement>(null)

  const employeeId = searchParams.get('employeeId')
  const now = new Date()
  const defaultPrevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const defaultPrevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const month = Math.min(12, Math.max(1, parseInt(searchParams.get('month') || String(defaultPrevMonth), 10)))
  const year = parseInt(searchParams.get('year') || String(defaultPrevYear), 10)
  const queueParam = searchParams.get('queue')
  const queue = useMemo(
    () => (queueParam ? queueParam.split(',').map((id) => id.trim()).filter(Boolean) : []),
    [queueParam]
  )

  const [createMore, setCreateMore] = useState(false)
  useEffect(() => {
    const stored = sessionStorage.getItem(CREATE_MORE_STORAGE_KEY)
    if (stored !== null) setCreateMore(stored === 'true')
  }, [])
  useEffect(() => {
    sessionStorage.setItem(CREATE_MORE_STORAGE_KEY, String(createMore))
  }, [createMore])

  const { data: employee, isLoading: employeeLoading } = useQuery<Employee>({
    queryKey: ['employee', employeeId],
    queryFn: () => apiGet<Employee>(`/api/employees/${employeeId}`),
    enabled: !!employeeId,
  })

  const { data: attendanceSummary, isLoading: attendanceLoading } = useQuery<AttendanceSummary>({
    queryKey: ['attendance-summary', employeeId, month, year],
    queryFn: () =>
      apiGet<AttendanceSummary>(
        `/api/finance/payroll/attendance-summary?employeeId=${employeeId}&month=${month}&year=${year}`
      ),
    enabled: !!employeeId,
  })

  const { data: structure } = useQuery<SalaryStructure | null>({
    queryKey: ['salary-structure', employeeId],
    queryFn: async () => {
      const list = await apiGet<SalaryStructure[]>(`/api/finance/salary-structure?employeeId=${employeeId}`)
      if (!list?.length) return null
      const latest = list.sort((a, b) => {
        const byEff = new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
        if (byEff !== 0) return byEff
        return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      })[0]
      return latest ?? null
    },
    enabled: !!employeeId,
    staleTime: 0,
  })

  const { data: existingPayroll } = useQuery<MonthlyPayroll | null>({
    queryKey: ['payroll-record', employeeId, month, year],
    queryFn: async () => {
      const res = await apiGet<{ data: MonthlyPayroll[] }>(
        `/api/finance/payroll?employeeId=${employeeId}&month=${month}&year=${year}`
      )
      return res.data?.[0] ?? null
    },
    enabled: !!employeeId,
    staleTime: 0,
  })

  const buildNavigateNext = () => {
    if (!queue.length || !employeeId) return null
    const idx = queue.indexOf(employeeId)
    const nextId = queue[idx + 1]
    return nextId ?? null
  }
  const nextId = buildNavigateNext()
  const currentIndex = queue.length && employeeId ? queue.indexOf(employeeId) + 1 : 0

  const generateMutation = useMutation({
    mutationFn: async () => {
      const created = await apiPost<MonthlyPayroll>('/api/finance/payroll/generate', {
        employeeId: employee!.id,
        month,
        year,
      })
      const overrideDays = formData.payableDays
      const calculatedDays = attendanceSummary?.payableDays ?? created.payableDays ?? 0
      if (
        overrideDays > 0 &&
        Math.abs(overrideDays - (created.payableDays ?? calculatedDays)) > 0.001
      ) {
        return await apiPatch<MonthlyPayroll>(`/api/finance/payroll/${created.id}`, {
          payableDays: formData.payableDays,
          adjustedBasic: formData.adjustedBasic,
          adjustedHra: formData.adjustedHra,
          adjustedMedical: formData.adjustedMedical,
          adjustedConveyance: formData.adjustedConveyance,
          adjustedOther: formData.adjustedOther,
          adjustedSpecial: formData.adjustedSpecial,
          adjustedGross: formData.adjustedGross,
          epfEmployee: formData.epfEmployee,
          applyEsic: formData.applyEsic,
          esicAmount: formData.esicAmount,
          applyTds: formData.applyTds,
          tdsAmount: formData.tdsAmount,
          insurance: formData.insurance,
          lateFines: formData.lateFines,
        })
      }
      return created
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-payroll'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-record', employeeId, month, year] })
      toast.success('Payroll generated')
      if (createMore && nextId) {
        router.push(`/finance/payroll/generate?employeeId=${nextId}&month=${month}&year=${year}${queue.length ? `&queue=${queue.join(',')}` : ''}`)
      } else {
        router.push('/finance/payroll')
      }
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to generate'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPatch<MonthlyPayroll>(`/api/finance/payroll/${existingPayroll!.id}`, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['finance-payroll'] })
      queryClient.setQueryData(['payroll-record', employeeId, month, year], updated)
      toast.success('Payroll updated')
      if (createMore && nextId) {
        router.push(`/finance/payroll/generate?employeeId=${nextId}&month=${month}&year=${year}${queue.length ? `&queue=${queue.join(',')}` : ''}`)
      } else {
        router.push('/finance/payroll')
      }
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update'),
  })

  const [employeeDetails, setEmployeeDetails] = useState({
    designation: '',
    panNumber: '',
    bankAccountNumber: '',
    ifscCode: '',
    uanNumber: '',
    joinDate: '',
  })

  useEffect(() => {
    if (employee) {
      setEmployeeDetails({
        designation: employee.designation ?? '',
        panNumber: employee.panNumber ?? '',
        bankAccountNumber: employee.bankAccountNumber ?? '',
        ifscCode: employee.ifscCode ?? '',
        uanNumber: employee.uanNumber ?? '',
        joinDate: employee.joinDate ? format(new Date(employee.joinDate), 'yyyy-MM-dd') : '',
      })
    }
  }, [employee?.id])

  const updateEmployeeMutation = useMutation({
    mutationFn: (data: { designation?: string; panNumber?: string; bankAccountNumber?: string; ifscCode?: string; uanNumber?: string; joinDate?: string }) =>
      apiPatch<Employee>(`/api/employees/${employee!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['finance-payroll'] })
      toast.success('Employee details saved')
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to save details'),
  })

  const handleSaveEmployeeDetails = () => {
    if (!employee) return
    updateEmployeeMutation.mutate({
      designation: employeeDetails.designation.trim() || undefined,
      panNumber: employeeDetails.panNumber.trim() || undefined,
      bankAccountNumber: employeeDetails.bankAccountNumber.trim() || undefined,
      ifscCode: employeeDetails.ifscCode.trim() || undefined,
      uanNumber: employeeDetails.uanNumber.trim() || undefined,
      joinDate: employeeDetails.joinDate ? new Date(employeeDetails.joinDate).toISOString() : undefined,
    })
  }

  const [formData, setFormData] = useState({
    payableDays: 0,
    adjustedBasic: 0,
    adjustedHra: 0,
    adjustedMedical: 0,
    adjustedConveyance: 0,
    adjustedOther: 0,
    adjustedSpecial: 0,
    adjustedGross: 0,
    epfEmployee: 0,
    applyEsic: false,
    esicAmount: 0,
    applyTds: false,
    tdsAmount: 0,
    insurance: 0,
    lateFines: 0,
    netPayable: 0,
    status: 'DRAFT' as 'DRAFT' | 'APPROVED' | 'PAID',
  })

  const totalDaysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month])

  const previewData = useMemo(() => {
    if (existingPayroll || !structure) return null
    const totalDays = attendanceSummary?.totalDaysInMonth ?? totalDaysInMonth
    const payableDays = attendanceSummary?.payableDays ?? totalDaysInMonth
    const lateFines = attendanceSummary?.lateFines ?? 0
    const breakup = {
      basicSalary: structure.basicSalary,
      hraAllowance: structure.hraAllowance ?? structure.basicSalary * 0.5,
      medicalAllowance: structure.medicalAllowance,
      conveyanceAllowance: structure.conveyanceAllowance,
      otherAllowance: structure.otherAllowance,
      specialAllowance: structure.specialAllowance,
      monthlyGross: structure.monthlyGross,
    }
    const proRated = calculateProRatedSalary(breakup, payableDays, totalDays)
    const applyPf = structure.applyPf ?? true
    const epfEmployee = applyPf ? calculateEPF(proRated.adjustedBasic) : 0
    const applyEsic = isESICApplicableByRule(structure.monthlyGross)
    const esicAmount = applyEsic ? calculateESIC(proRated.adjustedGross, structure.monthlyGross) : 0
    const tdsAmount = structure.applyTds
      ? calculateTDSAmount(proRated.adjustedGross, structure.tdsMonthly, structure.tdsRatePercent ?? null)
      : 0
    const insurance = structure.insuranceDeduction ?? 0
    const netBeforeLate = calculateNetPay(
      proRated.adjustedGross,
      epfEmployee,
      esicAmount,
      insurance,
      tdsAmount
    )
    const netPayable = Math.max(0, Math.round(netBeforeLate - lateFines))
    return {
      ...proRated,
      epfEmployee,
      applyEsic,
      esicAmount,
      applyTds: structure.applyTds,
      tdsAmount,
      insurance,
      lateFines,
      netPayable,
    }
  }, [existingPayroll, structure, attendanceSummary, totalDaysInMonth])

  useEffect(() => {
    if (existingPayroll) {
      setFormData({
        payableDays: existingPayroll.payableDays ?? 0,
        adjustedBasic: existingPayroll.adjustedBasic ?? 0,
        adjustedHra: existingPayroll.adjustedHra ?? 0,
        adjustedMedical: existingPayroll.adjustedMedical ?? 0,
        adjustedConveyance: existingPayroll.adjustedConveyance ?? 0,
        adjustedOther: existingPayroll.adjustedOther ?? 0,
        adjustedSpecial: existingPayroll.adjustedSpecial ?? 0,
        adjustedGross: existingPayroll.adjustedGross ?? 0,
        epfEmployee: existingPayroll.epfEmployee ?? 0,
        applyEsic: existingPayroll.applyEsic ?? false,
        esicAmount: existingPayroll.esicAmount ?? 0,
        applyTds: existingPayroll.applyTds ?? false,
        tdsAmount: existingPayroll.tdsAmount ?? 0,
        insurance: existingPayroll.insurance ?? 0,
        lateFines: existingPayroll.lateFines ?? 0,
        netPayable: existingPayroll.netPayable ?? 0,
        status: (existingPayroll.status as 'DRAFT' | 'APPROVED' | 'PAID') || 'DRAFT',
      })
    }
  }, [existingPayroll?.id])

  useEffect(() => {
    if (previewData && !existingPayroll) {
      setFormData({
        payableDays: attendanceSummary?.payableDays ?? totalDaysInMonth,
        adjustedBasic: previewData.adjustedBasic ?? 0,
        adjustedHra: previewData.adjustedHra ?? 0,
        adjustedMedical: previewData.adjustedMedical ?? 0,
        adjustedConveyance: previewData.adjustedConveyance ?? 0,
        adjustedOther: previewData.adjustedOther ?? 0,
        adjustedSpecial: previewData.adjustedSpecial ?? 0,
        adjustedGross: previewData.adjustedGross ?? 0,
        epfEmployee: previewData.epfEmployee ?? 0,
        applyEsic: previewData.applyEsic ?? false,
        esicAmount: previewData.esicAmount ?? 0,
        applyTds: previewData.applyTds ?? false,
        tdsAmount: previewData.tdsAmount ?? 0,
        insurance: previewData.insurance ?? 0,
        lateFines: previewData.lateFines ?? 0,
        netPayable: previewData.netPayable ?? 0,
        status: 'DRAFT',
      })
    }
  }, [previewData?.adjustedGross, previewData?.netPayable, existingPayroll?.id])

  useEffect(() => {
    const sumGross =
      formData.adjustedBasic +
      formData.adjustedHra +
      formData.adjustedMedical +
      formData.adjustedConveyance +
      formData.adjustedOther +
      formData.adjustedSpecial
    const grossRounded = Math.round(sumGross)
    setFormData((f) => (f.adjustedGross === grossRounded ? f : { ...f, adjustedGross: grossRounded }))
  }, [
    formData.adjustedBasic,
    formData.adjustedHra,
    formData.adjustedMedical,
    formData.adjustedConveyance,
    formData.adjustedOther,
    formData.adjustedSpecial,
  ])

  useEffect(() => {
    const gross = formData.adjustedGross
    const deductions =
      formData.epfEmployee +
      (formData.applyEsic ? formData.esicAmount : 0) +
      formData.insurance +
      (formData.applyTds ? formData.tdsAmount : 0) +
      formData.lateFines
    const net = Math.max(0, Math.round(gross - deductions))
    setFormData((f) => (f.netPayable === net ? f : { ...f, netPayable: net }))
  }, [
    formData.adjustedGross,
    formData.epfEmployee,
    formData.applyEsic,
    formData.esicAmount,
    formData.applyTds,
    formData.tdsAmount,
    formData.insurance,
    formData.lateFines,
  ])

  useEffect(() => {
    if (!employeeId) return
    const scrollEl = contentRef.current
    if (scrollEl) scrollEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [employeeId])

  const recomputeFromPayableDays = (rawDays: number) => {
    if (!structure) {
      setFormData((f) => ({ ...f, payableDays: Math.max(0, rawDays) }))
      return
    }
    const totalDays = attendanceSummary?.totalDaysInMonth ?? totalDaysInMonth
    const newDays = Math.max(0, Math.min(totalDays, rawDays))
    const breakup = {
      basicSalary: structure.basicSalary,
      hraAllowance: structure.hraAllowance ?? structure.basicSalary * 0.5,
      medicalAllowance: structure.medicalAllowance,
      conveyanceAllowance: structure.conveyanceAllowance,
      otherAllowance: structure.otherAllowance,
      specialAllowance: structure.specialAllowance,
      monthlyGross: structure.monthlyGross,
    }
    const proRated = calculateProRatedSalary(breakup, newDays, totalDays)
    const applyPf = structure.applyPf ?? true
    const epfEmployee = applyPf ? calculateEPF(proRated.adjustedBasic) : 0
    setFormData((f) => {
      const applyEsic = f.applyEsic
      const esicAmount = applyEsic
        ? calculateESIC(proRated.adjustedGross, structure.monthlyGross)
        : 0
      const applyTds = f.applyTds
      const tdsAmount = applyTds
        ? calculateTDSAmount(proRated.adjustedGross, structure.tdsMonthly, structure.tdsRatePercent ?? null)
        : 0
      return {
        ...f,
        payableDays: newDays,
        adjustedBasic: proRated.adjustedBasic,
        adjustedHra: proRated.adjustedHra,
        adjustedMedical: proRated.adjustedMedical,
        adjustedConveyance: proRated.adjustedConveyance,
        adjustedOther: proRated.adjustedOther,
        adjustedSpecial: proRated.adjustedSpecial,
        adjustedGross: proRated.adjustedGross,
        epfEmployee,
        esicAmount,
        tdsAmount,
      }
    })
  }

  if (!employeeId) {
    return (
      <div className="space-y-6 p-6">
        <Link href="/finance/payroll" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to payroll
        </Link>
        <p className="text-muted-foreground">Missing employee. <Link href="/finance/payroll" className="underline">Return to payroll</Link>.</p>
      </div>
    )
  }

  if (employeeLoading || !employee) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const hasStructure = !!structure
  const hasPayroll = !!existingPayroll
  const payroll = existingPayroll
  const canEdit = true
  const displayData = hasPayroll
    ? {
        payableDays: formData.payableDays || payroll!.payableDays || 0,
        adjustedBasic: formData.adjustedBasic || payroll!.adjustedBasic,
        adjustedHra: formData.adjustedHra ?? payroll!.adjustedHra ?? 0,
        adjustedMedical: formData.adjustedMedical ?? payroll!.adjustedMedical,
        adjustedConveyance: formData.adjustedConveyance ?? payroll!.adjustedConveyance,
        adjustedOther: formData.adjustedOther ?? payroll!.adjustedOther,
        adjustedSpecial: formData.adjustedSpecial ?? payroll!.adjustedSpecial,
        adjustedGross: formData.adjustedGross || payroll!.adjustedGross,
        epfEmployee: formData.epfEmployee ?? payroll!.epfEmployee,
        applyEsic: formData.applyEsic !== undefined ? formData.applyEsic : payroll!.applyEsic,
        esicAmount: formData.esicAmount ?? payroll!.esicAmount,
        applyTds: formData.applyTds !== undefined ? formData.applyTds : payroll!.applyTds,
        tdsAmount: formData.tdsAmount ?? payroll!.tdsAmount,
        insurance: formData.insurance ?? payroll!.insurance,
        lateFines: formData.lateFines ?? payroll!.lateFines,
        netPayable: formData.netPayable || payroll!.netPayable,
        status: formData.status,
      }
    : formData

  const handleGenerate = () => {
    if (!hasStructure) {
      toast.error('Set salary structure first')
      return
    }
    const bankTrim = employeeDetails.bankAccountNumber?.trim()
    const panTrim = employeeDetails.panNumber?.trim()
    if (!bankTrim || !panTrim) {
      toast.error('Bank account number and PAN are required to generate payroll')
      return
    }
    generateMutation.mutate()
  }

  const handleSave = () => {
    if (!payroll) return
    updateMutation.mutate({
      payableDays: displayData.payableDays,
      adjustedBasic: displayData.adjustedBasic,
      adjustedHra: displayData.adjustedHra,
      adjustedMedical: displayData.adjustedMedical,
      adjustedConveyance: displayData.adjustedConveyance,
      adjustedOther: displayData.adjustedOther,
      adjustedSpecial: displayData.adjustedSpecial,
      adjustedGross: displayData.adjustedGross,
      epfEmployee: displayData.epfEmployee,
      applyEsic: displayData.applyEsic,
      esicAmount: displayData.esicAmount,
      applyTds: displayData.applyTds,
      tdsAmount: displayData.tdsAmount,
      insurance: displayData.insurance,
      lateFines: displayData.lateFines ?? 0,
      netPayable: displayData.netPayable ?? 0,
      status: formData.status,
    })
  }

  const handleSkipToNext = () => {
    if (nextId) {
      router.push(`/finance/payroll/generate?employeeId=${nextId}&month=${month}&year=${year}${queue.length ? `&queue=${queue.join(',')}` : ''}`)
    } else {
      router.push('/finance/payroll')
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto" ref={contentRef}>
      <Link href="/finance/payroll" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to payroll
      </Link>

      <div>
        <h1 className="text-2xl font-bold">
          {hasPayroll ? 'View / Edit Payroll' : 'Generate Payroll'} — {employee.user.name}
        </h1>
        <p className="text-muted-foreground">
          {MONTHS[month - 1]} {year}
          {queue.length > 0 && ` · Employee ${currentIndex} of ${queue.length}`}
        </p>
      </div>

      {createMore && queue.length > 1 && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Employee {currentIndex} of {queue.length}</span>
              <div className="flex items-center gap-3">
                <Label className="text-sm text-muted-foreground">Create more</Label>
                <Switch checked={createMore} onCheckedChange={setCreateMore} />
              </div>
            </div>
            <Progress value={(currentIndex / queue.length) * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Employee details */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{employee.user.name}</h2>
            <p className="text-sm text-muted-foreground">{employee.employeeCode}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{employee.department?.name ?? '—'}</Badge>
              {employeeDetails.designation && <Badge variant="outline">{employeeDetails.designation}</Badge>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground">Date of joining</Label>
                <Input
                  type="date"
                  value={employeeDetails.joinDate}
                  onChange={(e) => setEmployeeDetails((d) => ({ ...d, joinDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <CreditCard className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground">PAN number (required for payroll)</Label>
                <Input
                  value={employeeDetails.panNumber}
                  onChange={(e) => setEmployeeDetails((d) => ({ ...d, panNumber: e.target.value.toUpperCase() }))}
                  placeholder="e.g. AAAAA9999A"
                  maxLength={10}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground">Bank account number (required for payroll)</Label>
                <Input
                  value={employeeDetails.bankAccountNumber}
                  onChange={(e) => setEmployeeDetails((d) => ({ ...d, bankAccountNumber: e.target.value }))}
                  placeholder="Account number"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Landmark className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground">IFSC code</Label>
                <Input
                  value={employeeDetails.ifscCode}
                  onChange={(e) => setEmployeeDetails((d) => ({ ...d, ifscCode: e.target.value.toUpperCase() }))}
                  placeholder="e.g. UTIB0001394"
                  maxLength={11}
                  className="mt-1 uppercase"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Shield className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground">UAN number</Label>
                <Input
                  value={employeeDetails.uanNumber}
                  onChange={(e) => setEmployeeDetails((d) => ({ ...d, uanNumber: e.target.value }))}
                  placeholder="EPF UAN"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3 sm:col-span-2">
              <IndianRupee className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex flex-1 gap-6 flex-wrap">
                <div>
                  <Label className="text-xs text-muted-foreground">Monthly gross</Label>
                  <p className="font-medium">{structure ? formatCurrency(Math.round(structure.monthlyGross)) : '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Annual CTC</Label>
                  <p className="font-medium">{structure ? formatCurrency(structure.annualCtc) : '—'}</p>
                </div>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label>Designation</Label>
              <Input
                value={employeeDetails.designation}
                onChange={(e) => setEmployeeDetails((d) => ({ ...d, designation: e.target.value }))}
                placeholder="e.g. Software Developer"
                className="mt-1"
              />
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleSaveEmployeeDetails}
            disabled={updateEmployeeMutation.isPending}
          >
            {updateEmployeeMutation.isPending ? 'Saving...' : 'Save employee details'}
          </Button>
        </CardContent>
      </Card>

      {/* Attendance */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Attendance</h2>
          {attendanceLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : attendanceSummary ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold">{attendanceSummary.totalDaysInMonth}</p>
                  <p className="text-xs text-muted-foreground">Total days (month)</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold">{attendanceSummary.fullDays}</p>
                  <p className="text-xs text-muted-foreground">Full days worked</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold">{attendanceSummary.halfDays}</p>
                  <p className="text-xs text-muted-foreground">Half days</p>
                </CardContent>
              </Card>
              <Card className="bg-green-50 dark:bg-green-950/20">
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{attendanceSummary.payableDays}</p>
                  <p className="text-xs text-muted-foreground">Payable days</p>
                </CardContent>
              </Card>
              <Card className="bg-rose-50 dark:bg-rose-950/20">
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">{attendanceSummary.unpaidLeaves}</p>
                  <p className="text-xs text-muted-foreground">Unpaid leaves</p>
                </CardContent>
              </Card>
              <Card className="bg-amber-50 dark:bg-amber-950/20">
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{attendanceSummary.lateFines ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Late fines (Rs.)</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 sm:col-span-2 sm:col-start-1">
                <CardContent className="pt-4">
                  <p className="text-2xl font-bold">{attendanceSummary.paidLeaves ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Paid leaves</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No attendance data for this month.</p>
          )}

          <div className="mt-4 rounded-lg border border-dashed p-4 space-y-3">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <Label>Payable days</Label>
                <Input
                  type="number"
                  step="0.5"
                  min={0}
                  max={attendanceSummary?.totalDaysInMonth ?? totalDaysInMonth}
                  value={formData.payableDays}
                  onChange={(e) => recomputeFromPayableDays(Number(e.target.value))}
                  disabled={!canEdit || !hasStructure}
                  className="mt-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Calculated from attendance: {attendanceSummary?.payableDays ?? '—'}
                {' · '}Total days: {attendanceSummary?.totalDaysInMonth ?? totalDaysInMonth}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => recomputeFromPayableDays(attendanceSummary?.totalDaysInMonth ?? totalDaysInMonth)}
                disabled={!canEdit || !hasStructure}
              >
                Pay full month
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  recomputeFromPayableDays(
                    (attendanceSummary?.totalDaysInMonth ?? totalDaysInMonth) -
                      (attendanceSummary?.unpaidLeaves ?? 0)
                  )
                }
                disabled={!canEdit || !hasStructure}
              >
                Pay all days except unpaid leaves
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  recomputeFromPayableDays(attendanceSummary?.payableDays ?? totalDaysInMonth)
                }
                disabled={!canEdit || !hasStructure || !attendanceSummary}
              >
                Reset to calculated
              </Button>
            </div>
            {attendanceSummary != null &&
              Math.abs(formData.payableDays - attendanceSummary.payableDays) > 0.001 && (
                <Badge variant="outline" className="text-amber-700 border-amber-300">
                  Overridden — earnings re-pro-rated
                </Badge>
              )}
            <p className="text-xs text-muted-foreground">
              Late fines are not affected by these presets.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Payroll earnings & deductions - always show so user can create drafts for any month */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {!hasStructure && (
            <p className="text-amber-600 text-sm">Configure salary structure first to generate payroll.</p>
          )}
          {hasStructure && !hasPayroll && (!employeeDetails.bankAccountNumber?.trim() || !employeeDetails.panNumber?.trim()) && (
            <p className="text-amber-600 text-sm">Bank account number and PAN are required to generate payroll. Update them in the employee details above.</p>
          )}
            <div className="rounded-lg border border-border border-l-4 border-l-green-500 bg-card p-4 space-y-4">
              <h3 className="font-semibold text-green-800 dark:text-green-300">Earnings</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>Payable Basic (₹)</Label>
                  <Input type="number" value={displayData.adjustedBasic ?? 0} onChange={(e) => setFormData((f) => ({ ...f, adjustedBasic: Number(e.target.value) }))} disabled={!canEdit} className="mt-1" />
                </div>
                <div>
                  <Label>Payable HRA (₹)</Label>
                  <Input type="number" value={displayData.adjustedHra ?? 0} onChange={(e) => setFormData((f) => ({ ...f, adjustedHra: Number(e.target.value) }))} disabled={!canEdit} className="mt-1" />
                </div>
                <div>
                  <Label>Payable Medical (₹)</Label>
                  <Input type="number" value={displayData.adjustedMedical ?? 0} onChange={(e) => setFormData((f) => ({ ...f, adjustedMedical: Number(e.target.value) }))} disabled={!canEdit} className="mt-1" />
                </div>
                <div>
                  <Label>Payable Conveyance (₹)</Label>
                  <Input type="number" value={displayData.adjustedConveyance ?? 0} onChange={(e) => setFormData((f) => ({ ...f, adjustedConveyance: Number(e.target.value) }))} disabled={!canEdit} className="mt-1" />
                </div>
                <div>
                  <Label>Payable Other (₹)</Label>
                  <Input type="number" value={displayData.adjustedOther ?? 0} onChange={(e) => setFormData((f) => ({ ...f, adjustedOther: Number(e.target.value) }))} disabled={!canEdit} className="mt-1" />
                </div>
                <div>
                  <Label>Payable Special (₹)</Label>
                  <Input type="number" value={displayData.adjustedSpecial ?? 0} onChange={(e) => setFormData((f) => ({ ...f, adjustedSpecial: Number(e.target.value) }))} disabled={!canEdit} className="mt-1" />
                </div>
                <div>
                  <Label>Payable Gross (₹)</Label>
                  <Input type="number" value={displayData.adjustedGross ?? 0} onChange={(e) => setFormData((f) => ({ ...f, adjustedGross: Math.round(Number(e.target.value) || 0) }))} disabled={!canEdit} className="mt-1 font-bold text-emerald-600" step={1} />
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border border-l-4 border-l-red-500 bg-card p-4 space-y-4">
              <h3 className="font-semibold text-red-800 dark:text-red-300">Deductions</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>EPF Employee (₹)</Label>
                  <Input
                    type="number"
                    value={displayData.epfEmployee ?? 0}
                    onChange={(e) => setFormData((f) => ({ ...f, epfEmployee: Number(e.target.value) }))}
                    disabled={!canEdit}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-red-200 dark:border-red-900/50 p-3">
                <div>
                  <Label>Apply ESIC</Label>
                  <p className="text-xs text-muted-foreground">Override rule (gross ≤ 21,100).</p>
                </div>
                <Switch
                  checked={displayData.applyEsic}
                  onCheckedChange={(v) => setFormData((f) => ({ ...f, applyEsic: v }))}
                  disabled={!canEdit}
                />
              </div>
              {displayData.applyEsic && (
                <div>
                  <Label>ESIC Amount (₹)</Label>
                  <Input
                    type="number"
                    value={displayData.esicAmount ?? 0}
                    onChange={(e) => setFormData((f) => ({ ...f, esicAmount: Number(e.target.value) }))}
                    disabled={!canEdit}
                    className="mt-1"
                  />
                </div>
              )}
              <div className="flex items-center justify-between rounded-lg border border-red-200 dark:border-red-900/50 p-3">
                <div><Label>Apply TDS</Label></div>
                <Switch
                  checked={displayData.applyTds}
                  onCheckedChange={(v) => setFormData((f) => ({ ...f, applyTds: v }))}
                  disabled={!canEdit}
                />
              </div>
              {displayData.applyTds && (
                <div>
                  <Label>TDS Amount (₹)</Label>
                  <Input
                    type="number"
                    value={displayData.tdsAmount ?? 0}
                    onChange={(e) => setFormData((f) => ({ ...f, tdsAmount: Number(e.target.value) }))}
                    disabled={!canEdit}
                    className="mt-1"
                  />
                </div>
              )}
              <div>
                <Label>Miscellaneous (Rs.)</Label>
                <Input
                  type="number"
                  value={displayData.insurance ?? 0}
                  onChange={(e) => setFormData((f) => ({ ...f, insurance: Number(e.target.value) }))}
                  disabled={!canEdit}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Late fines (Rs.)</Label>
                <Input
                  type="number"
                  value={displayData.lateFines ?? 0}
                  onChange={(e) => setFormData((f) => ({ ...f, lateFines: Number(e.target.value) }))}
                  disabled={!canEdit}
                  className="mt-1 font-bold text-red-600"
                />
              </div>
            </div>
            <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50">
              <CardContent className="pt-6">
                <Label className="text-muted-foreground">Net Payable</Label>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-1">
                  {formatCurrency(displayData.netPayable ?? (payroll?.netPayable ?? 0))}
                </p>
              </CardContent>
            </Card>
            {hasPayroll && (
              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v: 'DRAFT' | 'APPROVED' | 'PAID') =>
                    setFormData((f) => ({ ...f, status: v }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

      {(!createMore || queue.length <= 1) && (
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <Label>Create more</Label>
              <p className="text-xs text-muted-foreground">After save, load next employee in queue.</p>
            </div>
            <Switch checked={createMore} onCheckedChange={setCreateMore} />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {!hasPayroll && hasStructure && (
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || !employeeDetails.bankAccountNumber?.trim() || !employeeDetails.panNumber?.trim()}
          >
            {generateMutation.isPending ? 'Generating...' : 'Generate Payroll'}
          </Button>
        )}
        {hasPayroll && (
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
        {hasPayroll && existingPayroll && (
          <Button variant="outline" asChild>
            <Link href={`/employee/payroll/${existingPayroll.id}/slip`} target="_blank">
              View Payslip
            </Link>
          </Button>
        )}
        {queue.length > 1 && (
          <Button variant="outline" onClick={handleSkipToNext}>
            Skip to next
          </Button>
        )}
        <Button variant="ghost" asChild>
          <Link href="/finance/payroll">Back to payroll</Link>
        </Button>
      </div>
    </div>
  )
}
