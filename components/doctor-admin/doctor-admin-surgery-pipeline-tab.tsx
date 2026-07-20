'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DoctorAdminPipelineCard } from '@/components/doctor-admin/types'
import { formatDate, getInitials, StatusBadge } from '@/components/doctor-admin/shared'

function PipelineColumn({
  title,
  items,
  accentClass,
}: {
  title: string
  items: DoctorAdminPipelineCard[]
  accentClass: string
}) {
  return (
    <div className='space-y-3'>
      <div className={`rounded-lg border border-t-4 ${accentClass} bg-card p-3`}>
        <div className='flex items-center justify-between'>
          <h3 className='text-sm font-semibold'>{title}</h3>
          <Badge variant='secondary'>{items.length}</Badge>
        </div>
      </div>
      <div className='max-h-[60vh] space-y-3 overflow-y-auto'>
        {items.length === 0 ? (
          <div className='rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground'>
            No patients
          </div>
        ) : (
          items.map(item => (
            <Card key={item.id}>
              <CardContent className='space-y-3 p-4'>
                <div className='flex items-start gap-3'>
                  <div className='flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700'>
                    {getInitials(item.patientName)}
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className='font-medium'>{item.patientName}</div>
                    <div className='text-sm text-muted-foreground'>{item.doctorName}</div>
                    <div className='text-sm text-muted-foreground'>{item.hospitalName}</div>
                    <div className='text-sm text-muted-foreground'>{formatDate(item.date)}</div>
                    {item.followUpDate ? (
                      <div className='text-sm text-muted-foreground'>
                        Follow-up: {formatDate(item.followUpDate)}
                      </div>
                    ) : null}
                    {item.paymentType ? (
                      <div className='text-sm text-muted-foreground'>Payment: {item.paymentType}</div>
                    ) : null}
                    {item.daysSinceAdvised != null ? (
                      <div className='text-sm text-muted-foreground'>{item.daysSinceAdvised} days since advised</div>
                    ) : null}
                  </div>
                </div>
                {item.tag ? <StatusBadge status={item.tag} /> : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

export function DoctorAdminSurgeryPipelineTab() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [appliedStartDate, setAppliedStartDate] = useState('')
  const [appliedEndDate, setAppliedEndDate] = useState('')

  const query = useQuery({
    queryKey: ['doctor-admin', 'surgery-pipeline', appliedStartDate, appliedEndDate],
    queryFn: () =>
      apiGet<{
        advised: DoctorAdminPipelineCard[]
        followUps: DoctorAdminPipelineCard[]
        ipdScheduled: DoctorAdminPipelineCard[]
        conversions: DoctorAdminPipelineCard[]
        lostPatients: DoctorAdminPipelineCard[]
        summary: {
          conversionRate: number
          avgDaysToConvert: number
          totalLost: number
        }
      }>(
        `/api/doctor-admin/surgery-pipeline?startDate=${encodeURIComponent(appliedStartDate)}&endDate=${encodeURIComponent(appliedEndDate)}`
      ),
  })

  const data = query.data

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='text-2xl font-semibold tracking-tight'>Surgery Pipeline</h2>
        <p className='text-sm text-muted-foreground'>Track patients from surgery advised to conversion</p>
      </div>

      <Card>
        <CardContent className='flex flex-wrap items-end gap-3 p-4'>
          <div className='space-y-2'>
            <div className='text-xs text-muted-foreground'>Start Date</div>
            <Input type='date' value={startDate} onChange={event => setStartDate(event.target.value)} className='w-44' />
          </div>
          <div className='space-y-2'>
            <div className='text-xs text-muted-foreground'>End Date</div>
            <Input type='date' value={endDate} onChange={event => setEndDate(event.target.value)} className='w-44' />
          </div>
          <Button
            onClick={() => {
              setAppliedStartDate(startDate)
              setAppliedEndDate(endDate)
            }}
          >
            Apply
          </Button>
          <Button
            variant='outline'
            onClick={() => {
              setStartDate('')
              setEndDate('')
              setAppliedStartDate('')
              setAppliedEndDate('')
            }}
          >
            Clear
          </Button>
        </CardContent>
      </Card>

      {query.isLoading ? (
        <Card>
          <CardContent className='py-12 text-center text-muted-foreground'>Loading pipeline...</CardContent>
        </Card>
      ) : (
        <>
          <div className='grid gap-4 xl:grid-cols-5'>
            <PipelineColumn title='Surgery Advised List' items={data?.advised ?? []} accentClass='border-t-amber-500' />
            <PipelineColumn title='Follow-up Pipeline' items={data?.followUps ?? []} accentClass='border-t-blue-500' />
            <PipelineColumn title='IPD Scheduled' items={data?.ipdScheduled ?? []} accentClass='border-t-violet-500' />
            <PipelineColumn title='Conversion Tracker' items={data?.conversions ?? []} accentClass='border-t-emerald-500' />
            <PipelineColumn title='Lost Patients' items={data?.lostPatients ?? []} accentClass='border-t-rose-500' />
          </div>

          <div className='grid gap-4 md:grid-cols-3'>
            <Card>
              <CardContent className='p-4'>
                <div className='text-sm text-muted-foreground'>Conversion Rate</div>
                <div className='mt-2 text-2xl font-semibold'>{data?.summary.conversionRate ?? 0}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className='p-4'>
                <div className='text-sm text-muted-foreground'>Avg Days to Convert</div>
                <div className='mt-2 text-2xl font-semibold'>{data?.summary.avgDaysToConvert ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className='p-4'>
                <div className='text-sm text-muted-foreground'>Lost Patients</div>
                <div className='mt-2 text-2xl font-semibold'>{data?.summary.totalLost ?? 0}</div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
