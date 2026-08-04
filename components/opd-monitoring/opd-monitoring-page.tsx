'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, ShieldAlert } from 'lucide-react'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { formatDate, StatusBadge } from '@/components/doctor-admin/shared'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { apiGet } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { canAccessSalesOpdMonitoring } from '@/lib/opd-monitoring'

type AppointmentTab = 'daily' | 'doctor' | 'overdue'

type OpdDoctorOption = {
  id: string
  name: string
}

type OpdMonitoringItem = {
  id: string
  leadRef: string
  patientName: string
  doctorName: string
  hospitalName: string
  appointmentDate?: string | Date | null
  statusKey: string
  statusLabel: string
  bdName?: string | null
}

function todayDateValue() {
  return new Date().toISOString().slice(0, 10)
}

export function OpdMonitoringPage() {
  const { user, isLoading } = useAuth()
  const [tab, setTab] = useState<AppointmentTab>('daily')
  const [summaryRange, setSummaryRange] = useState<'all' | 'day'>('all')
  const [summaryDate, setSummaryDate] = useState(todayDateValue())
  const [dailyDate, setDailyDate] = useState(todayDateValue())
  const [activeDailyDate, setActiveDailyDate] = useState(todayDateValue())
  const [doctorName, setDoctorName] = useState('all')
  const [startDate, setStartDate] = useState(todayDateValue())
  const [endDate, setEndDate] = useState(todayDateValue())
  const [status, setStatus] = useState('all')
  const [submittedDoctorFilters, setSubmittedDoctorFilters] = useState({
    doctorName: 'all',
    startDate: todayDateValue(),
    endDate: todayDateValue(),
    status: 'all',
  })
  const [overdueDoctorName, setOverdueDoctorName] = useState('all')
  const [daysOverdue, setDaysOverdue] = useState('1')
  const [submittedOverdueFilters, setSubmittedOverdueFilters] = useState({
    doctorName: 'all',
    daysOverdue: '1',
  })

  const doctorQuery = useQuery({
    queryKey: ['sales-opd-monitoring', 'doctors'],
    queryFn: () => apiGet<{ items: OpdDoctorOption[] }>('/api/opd-monitoring?mode=doctors'),
    enabled: !!user && canAccessSalesOpdMonitoring(user.role),
  })

  const summaryQuery = useQuery({
    queryKey: ['sales-opd-monitoring', 'summary', summaryRange, summaryDate],
    queryFn: () =>
      apiGet<{ scheduled: number; done: number; noShow: number; cancelled: number }>(
        `/api/opd-monitoring?mode=summary&range=${summaryRange}&date=${encodeURIComponent(summaryDate)}`
      ),
    enabled: !!user && canAccessSalesOpdMonitoring(user.role),
  })

  const dailyQuery = useQuery({
    queryKey: ['sales-opd-monitoring', 'daily', activeDailyDate],
    queryFn: () =>
      apiGet<{ items: OpdMonitoringItem[] }>(
        `/api/opd-monitoring?mode=daily&date=${encodeURIComponent(activeDailyDate)}`
      ),
    enabled: !!user && canAccessSalesOpdMonitoring(user.role) && tab === 'daily',
  })

  const doctorViewQuery = useQuery({
    queryKey: ['sales-opd-monitoring', 'doctor', submittedDoctorFilters],
    queryFn: () =>
      apiGet<{ items: OpdMonitoringItem[] }>(
        `/api/opd-monitoring?mode=doctor&doctorName=${
          submittedDoctorFilters.doctorName === 'all'
            ? ''
            : encodeURIComponent(submittedDoctorFilters.doctorName)
        }&startDate=${encodeURIComponent(submittedDoctorFilters.startDate)}&endDate=${encodeURIComponent(submittedDoctorFilters.endDate)}&status=${encodeURIComponent(submittedDoctorFilters.status)}`
      ),
    enabled: !!user && canAccessSalesOpdMonitoring(user.role) && tab === 'doctor',
  })

  const overdueQuery = useQuery({
    queryKey: ['sales-opd-monitoring', 'overdue', submittedOverdueFilters],
    queryFn: () =>
      apiGet<{ items: OpdMonitoringItem[] }>(
        `/api/opd-monitoring?mode=overdue&doctorName=${
          submittedOverdueFilters.doctorName === 'all'
            ? ''
            : encodeURIComponent(submittedOverdueFilters.doctorName)
        }&daysOverdue=${submittedOverdueFilters.daysOverdue}`
      ),
    enabled: !!user && canAccessSalesOpdMonitoring(user.role) && tab === 'overdue',
  })

  const activeQuery =
    tab === 'doctor' ? doctorViewQuery : tab === 'overdue' ? overdueQuery : dailyQuery
  const items = useMemo(() => activeQuery.data?.items ?? [], [activeQuery.data?.items])
  const doctors = doctorQuery.data?.items ?? []

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className='flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground'>
          Loading OPD monitoring...
        </div>
      </AuthenticatedLayout>
    )
  }

  if (!user || !canAccessSalesOpdMonitoring(user.role)) {
    return (
      <AuthenticatedLayout>
        <div className='mx-auto max-w-3xl p-6'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <ShieldAlert className='h-5 w-5' />
                Access Restricted
              </CardTitle>
            </CardHeader>
            <CardContent className='text-sm text-muted-foreground'>
              This area is available only to the sales hierarchy and admin-level monitoring roles.
            </CardContent>
          </Card>
        </div>
      </AuthenticatedLayout>
    )
  }

  return (
    <ProtectedRoute>
      <AuthenticatedLayout>
        <div className='space-y-6 p-4 md:p-6'>
          <div className='flex items-start gap-3'>
            <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700'>
              <CalendarClock className='h-6 w-6' />
            </div>
            <div>
              <h1 className='text-3xl font-semibold tracking-tight'>OPD Monitoring</h1>
              <p className='text-sm text-muted-foreground'>
                Hierarchy-scoped OPD appointment monitoring for BDs and sales managers.
              </p>
              <p className='mt-1 text-xs text-muted-foreground'>
                BDs see only their own OPDs. Managers see OPDs owned by BDs in their reporting hierarchy.
              </p>
            </div>
          </div>

          <Card>
            <CardContent className='space-y-4 p-4'>
              <div className='flex flex-wrap items-end gap-3'>
                <div className='space-y-2'>
                  <Label>Status Range</Label>
                  <Select
                    value={summaryRange}
                    onValueChange={(value) => setSummaryRange(value as 'all' | 'day')}
                  >
                    <SelectTrigger className='w-44'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>All Days</SelectItem>
                      <SelectItem value='day'>Selected Day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label>Status Date</Label>
                  <Input
                    type='date'
                    value={summaryDate}
                    onChange={(event) => setSummaryDate(event.target.value)}
                    disabled={summaryRange === 'all'}
                    className='w-44'
                  />
                </div>
              </div>

              <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <Card className='border-blue-200 bg-blue-50'>
                  <CardContent className='p-4'>
                    <div className='text-sm uppercase tracking-wide text-blue-700'>Scheduled</div>
                    <div className='mt-2 text-3xl font-semibold text-blue-700'>
                      {summaryQuery.isLoading ? '...' : summaryQuery.data?.scheduled ?? 0}
                    </div>
                  </CardContent>
                </Card>
                <Card className='border-emerald-200 bg-emerald-50'>
                  <CardContent className='p-4'>
                    <div className='text-sm uppercase tracking-wide text-emerald-700'>Done</div>
                    <div className='mt-2 text-3xl font-semibold text-emerald-700'>
                      {summaryQuery.isLoading ? '...' : summaryQuery.data?.done ?? 0}
                    </div>
                  </CardContent>
                </Card>
                <Card className='border-amber-200 bg-amber-50'>
                  <CardContent className='p-4'>
                    <div className='text-sm uppercase tracking-wide text-amber-700'>No Show</div>
                    <div className='mt-2 text-3xl font-semibold text-amber-700'>
                      {summaryQuery.isLoading ? '...' : summaryQuery.data?.noShow ?? 0}
                    </div>
                  </CardContent>
                </Card>
                <Card className='border-rose-200 bg-rose-50'>
                  <CardContent className='p-4'>
                    <div className='text-sm uppercase tracking-wide text-rose-700'>Cancelled</div>
                    <div className='mt-2 text-3xl font-semibold text-rose-700'>
                      {summaryQuery.isLoading ? '...' : summaryQuery.data?.cancelled ?? 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Tabs value={tab} onValueChange={(value) => setTab(value as AppointmentTab)}>
                <TabsList>
                  <TabsTrigger value='daily'>Daily View</TabsTrigger>
                  <TabsTrigger value='doctor'>Doctor-wise View</TabsTrigger>
                  <TabsTrigger value='overdue'>Pending / Overdue</TabsTrigger>
                </TabsList>
              </Tabs>

              {tab === 'daily' ? (
                <div className='flex flex-wrap items-end gap-3'>
                  <div className='space-y-2'>
                    <Label>Date</Label>
                    <Input
                      type='date'
                      value={dailyDate}
                      onChange={(event) => setDailyDate(event.target.value)}
                      className='w-44'
                    />
                  </div>
                  <Button onClick={() => setActiveDailyDate(dailyDate)}>Load Daily View</Button>
                </div>
              ) : null}

              {tab === 'doctor' ? (
                <div className='grid gap-3 md:grid-cols-4'>
                  <div className='space-y-2'>
                    <Label>Doctor</Label>
                    <Select value={doctorName} onValueChange={setDoctorName}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='all'>All Doctors</SelectItem>
                        {doctors.map((doctor) => (
                          <SelectItem key={doctor.id} value={doctor.name}>
                            {doctor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-2'>
                    <Label>Start Date</Label>
                    <Input
                      type='date'
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label>End Date</Label>
                    <Input
                      type='date'
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='all'>All</SelectItem>
                        <SelectItem value='scheduled'>Scheduled</SelectItem>
                        <SelectItem value='done'>Done</SelectItem>
                        <SelectItem value='no_show'>No Show</SelectItem>
                        <SelectItem value='cancelled'>Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='md:col-span-4'>
                    <Button
                      onClick={() =>
                        setSubmittedDoctorFilters({
                          doctorName,
                          startDate,
                          endDate,
                          status,
                        })
                      }
                    >
                      Load Doctor View
                    </Button>
                  </div>
                </div>
              ) : null}

              {tab === 'overdue' ? (
                <div className='grid gap-3 md:grid-cols-3'>
                  <div className='space-y-2'>
                    <Label>Doctor</Label>
                    <Select value={overdueDoctorName} onValueChange={setOverdueDoctorName}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='all'>All Doctors</SelectItem>
                        {doctors.map((doctor) => (
                          <SelectItem key={doctor.id} value={doctor.name}>
                            {doctor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-2'>
                    <Label>Days Overdue</Label>
                    <Input
                      value={daysOverdue}
                      onChange={(event) => setDaysOverdue(event.target.value)}
                    />
                  </div>
                  <div className='flex items-end'>
                    <Button
                      onClick={() =>
                        setSubmittedOverdueFilters({
                          doctorName: overdueDoctorName,
                          daysOverdue,
                        })
                      }
                    >
                      Load Overdue Queue
                    </Button>
                  </div>
                </div>
              ) : null}

              <Card>
                <CardContent className='p-0'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Lead Ref</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Hospital</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>BD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeQuery.isLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>
                            Loading...
                          </TableCell>
                        </TableRow>
                      ) : items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>
                            No OPD appointments found
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className='font-medium'>{item.patientName}</TableCell>
                            <TableCell>{item.leadRef}</TableCell>
                            <TableCell>{item.doctorName}</TableCell>
                            <TableCell>{item.hospitalName}</TableCell>
                            <TableCell>{formatDate(item.appointmentDate)}</TableCell>
                            <TableCell>
                              <StatusBadge status={item.statusLabel} />
                            </TableCell>
                            <TableCell>{item.bdName || '-'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      </AuthenticatedLayout>
    </ProtectedRoute>
  )
}
