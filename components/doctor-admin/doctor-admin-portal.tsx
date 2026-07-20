'use client'

import { useState } from 'react'
import { ShieldAlert, Stethoscope } from 'lucide-react'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { DoctorAdminAppointmentMonitoringTab } from '@/components/doctor-admin/doctor-admin-appointment-monitoring-tab'
import { DoctorAdminCabRequestsTab } from '@/components/doctor-admin/doctor-admin-cab-requests-tab'
import { DoctorAdminIpdMonitoringTab } from '@/components/doctor-admin/doctor-admin-ipd-monitoring-tab'
import { DoctorAdminLeaveManagementTab } from '@/components/doctor-admin/doctor-admin-leave-management-tab'
import { DoctorAdminMastersTab } from '@/components/doctor-admin/doctor-admin-masters-tab'
import { DoctorAdminSurgeryPipelineTab } from '@/components/doctor-admin/doctor-admin-surgery-pipeline-tab'

type PortalTab =
  | 'appointment-monitoring'
  | 'surgery-pipeline'
  | 'ipd-monitoring'
  | 'leave-management'
  | 'cab-requests'
  | 'masters'

const ALLOWED_ROLES = new Set(['EXECUTIVE_ASSISTANT', 'ADMIN', 'MD', 'TESTER'])

export function DoctorAdminPortal() {
  const { user, isLoading } = useAuth()
  const [tab, setTab] = useState<PortalTab>('appointment-monitoring')

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className='flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground'>
          Loading doctor admin portal...
        </div>
      </AuthenticatedLayout>
    )
  }

  if (!user || !ALLOWED_ROLES.has(user.role)) {
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
              This area is available only to Executive Assistant, MD, Admin, or Tester roles.
            </CardContent>
          </Card>
        </div>
      </AuthenticatedLayout>
    )
  }

  return (
    <AuthenticatedLayout>
      <div className='space-y-6 p-4 md:p-6'>
        <div className='flex items-start gap-3'>
          <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700'>
            <Stethoscope className='h-6 w-6' />
          </div>
          <div>
            <h1 className='text-3xl font-semibold tracking-tight'>Doctor Admin Portal</h1>
            <p className='text-sm text-muted-foreground'>
              Executive Assistant workspace for doctor operations, masters, approvals, and monitoring.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={value => setTab(value as PortalTab)}>
          <TabsList className='flex h-auto flex-wrap gap-2 bg-transparent p-0'>
            <TabsTrigger value='appointment-monitoring'>Appointment Monitoring</TabsTrigger>
            <TabsTrigger value='surgery-pipeline'>Surgery Pipeline</TabsTrigger>
            <TabsTrigger value='ipd-monitoring'>IPD Monitoring</TabsTrigger>
            <TabsTrigger value='leave-management'>Leave Management</TabsTrigger>
            <TabsTrigger value='cab-requests'>Cab Requests</TabsTrigger>
            <TabsTrigger value='masters'>Masters</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === 'appointment-monitoring' ? <DoctorAdminAppointmentMonitoringTab /> : null}
        {tab === 'surgery-pipeline' ? <DoctorAdminSurgeryPipelineTab /> : null}
        {tab === 'ipd-monitoring' ? <DoctorAdminIpdMonitoringTab /> : null}
        {tab === 'leave-management' ? <DoctorAdminLeaveManagementTab /> : null}
        {tab === 'cab-requests' ? <DoctorAdminCabRequestsTab /> : null}
        {tab === 'masters' ? <DoctorAdminMastersTab /> : null}
      </div>
    </AuthenticatedLayout>
  )
}
