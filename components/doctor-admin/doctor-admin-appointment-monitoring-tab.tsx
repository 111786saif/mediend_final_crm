'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { DoctorAdminDoctor, DoctorAdminMonitoringItem } from '@/components/doctor-admin/types'
import { formatDate, StatusBadge } from '@/components/doctor-admin/shared'

type AppointmentTab = 'daily' | 'doctor' | 'overdue'

function todayDateValue() {
  return new Date().toISOString().slice(0, 10)
}

export function DoctorAdminAppointmentMonitoringTab() {
  const [tab, setTab] = useState<AppointmentTab>('daily')
  const [summaryRange, setSummaryRange] = useState<'all' | 'day'>('all')
  const [summaryDate, setSummaryDate] = useState(todayDateValue())
  const [dailyDate, setDailyDate] = useState(todayDateValue())
  const [activeDailyDate, setActiveDailyDate] = useState(todayDateValue())
  const [doctorId, setDoctorId] = useState('all')
  const [startDate, setStartDate] = useState(todayDateValue())
  const [endDate, setEndDate] = useState(todayDateValue())
  const [status, setStatus] = useState('all')
  const [type, setType] = useState<'all' | 'opd' | 'ipd'>('all')
  const [submittedDoctorFilters, setSubmittedDoctorFilters] = useState({
    doctorId: 'all',
    startDate: todayDateValue(),
    endDate: todayDateValue(),
    status: 'all',
    type: 'all' as 'all' | 'opd' | 'ipd',
  })
  const [overdueDoctorId, setOverdueDoctorId] = useState('all')
  const [daysOverdue, setDaysOverdue] = useState('1')
  const [submittedOverdueFilters, setSubmittedOverdueFilters] = useState({
    doctorId: 'all',
    daysOverdue: '1',
  })

  const doctorQuery = useQuery({
    queryKey: ['doctor-admin', 'doctors'],
    queryFn: () => apiGet<{ items: DoctorAdminDoctor[] }>('/api/doctor-admin/doctors'),
  })

  const summaryQuery = useQuery({
    queryKey: ['doctor-admin', 'appointment-summary', summaryRange, summaryDate],
    queryFn: () =>
      apiGet<{ scheduled: number; done: number; noShow: number; cancelled: number }>(
        `/api/doctor-admin/appointment-monitoring?mode=summary&range=${summaryRange}&date=${encodeURIComponent(summaryDate)}`
      ),
  })

  const dailyQuery = useQuery({
    queryKey: ['doctor-admin', 'appointment-daily', activeDailyDate],
    queryFn: () =>
      apiGet<{ items: DoctorAdminMonitoringItem[] }>(
        `/api/doctor-admin/appointment-monitoring?mode=daily&date=${encodeURIComponent(activeDailyDate)}`
      ),
    enabled: tab === 'daily',
  })

  const doctorViewQuery = useQuery({
    queryKey: ['doctor-admin', 'appointment-doctor', submittedDoctorFilters],
    queryFn: () =>
      apiGet<{ items: DoctorAdminMonitoringItem[] }>(
        `/api/doctor-admin/appointment-monitoring?mode=doctor&doctorId=${
          submittedDoctorFilters.doctorId === 'all' ? '' : encodeURIComponent(submittedDoctorFilters.doctorId)
        }&startDate=${encodeURIComponent(submittedDoctorFilters.startDate)}&endDate=${encodeURIComponent(submittedDoctorFilters.endDate)}&status=${encodeURIComponent(submittedDoctorFilters.status)}&type=${submittedDoctorFilters.type}`
      ),
    enabled: tab === 'doctor',
  })

  const overdueQuery = useQuery({
    queryKey: ['doctor-admin', 'appointment-overdue', submittedOverdueFilters],
    queryFn: () =>
      apiGet<{ items: DoctorAdminMonitoringItem[] }>(
        `/api/doctor-admin/appointment-monitoring?mode=overdue&doctorId=${
          submittedOverdueFilters.doctorId === 'all' ? '' : encodeURIComponent(submittedOverdueFilters.doctorId)
        }&daysOverdue=${submittedOverdueFilters.daysOverdue}`
      ),
    enabled: tab === 'overdue',
  })

  const doctors = doctorQuery.data?.items ?? []
  const activeQuery =
    tab === 'doctor' ? doctorViewQuery : tab === 'overdue' ? overdueQuery : dailyQuery

  const items = useMemo(() => activeQuery.data?.items ?? [], [activeQuery.data?.items])

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-2xl font-semibold tracking-tight'>Appointment Monitoring</h2>
        <p className='text-sm text-muted-foreground'>
          Daily/doctor-wise tracking, real-time status, overdue queue, and prescription lookup
        </p>
      </div>

      <Card>
        <CardContent className='space-y-4 p-4'>
          <div className='flex flex-wrap items-end gap-3'>
            <div className='space-y-2'>
              <Label>Status Range</Label>
              <Select value={summaryRange} onValueChange={value => setSummaryRange(value as 'all' | 'day')}>
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
                onChange={event => setSummaryDate(event.target.value)}
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

          <Tabs value={tab} onValueChange={value => setTab(value as AppointmentTab)}>
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
                <Input type='date' value={dailyDate} onChange={event => setDailyDate(event.target.value)} className='w-44' />
              </div>
              <Button onClick={() => setActiveDailyDate(dailyDate)}>Load Daily View</Button>
            </div>
          ) : null}

          {tab === 'doctor' ? (
            <div className='grid gap-3 md:grid-cols-5'>
              <div className='space-y-2'>
                <Label>Doctor</Label>
                <Select value={doctorId} onValueChange={setDoctorId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All Doctors</SelectItem>
                    {doctors.map(doctor => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label>Start Date</Label>
                <Input type='date' value={startDate} onChange={event => setStartDate(event.target.value)} />
              </div>
              <div className='space-y-2'>
                <Label>End Date</Label>
                <Input type='date' value={endDate} onChange={event => setEndDate(event.target.value)} />
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
              <div className='space-y-2'>
                <Label>Type</Label>
                <Select value={type} onValueChange={value => setType(value as 'all' | 'opd' | 'ipd')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All</SelectItem>
                    <SelectItem value='opd'>OPD</SelectItem>
                    <SelectItem value='ipd'>IPD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='md:col-span-5'>
                <Button
                  onClick={() =>
                    setSubmittedDoctorFilters({
                      doctorId,
                      startDate,
                      endDate,
                      status,
                      type,
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
                <Select value={overdueDoctorId} onValueChange={setOverdueDoctorId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All Doctors</SelectItem>
                    {doctors.map(doctor => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2'>
                <Label>Days Overdue</Label>
                <Input value={daysOverdue} onChange={event => setDaysOverdue(event.target.value)} />
              </div>
              <div className='flex items-end'>
                <Button
                  onClick={() =>
                    setSubmittedOverdueFilters({
                      doctorId: overdueDoctorId,
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
                    <TableHead>Type</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Hospital</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className='py-10 text-center text-muted-foreground'>
                        No appointments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className='font-medium'>{item.patientName}</TableCell>
                        <TableCell className='uppercase'>{item.appointmentType}</TableCell>
                        <TableCell>{item.doctorName}</TableCell>
                        <TableCell>{item.hospitalName}</TableCell>
                        <TableCell>{formatDate(item.appointmentDate)}</TableCell>
                        <TableCell>
                          <StatusBadge status={item.statusLabel} />
                        </TableCell>
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
  )
}
