'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { HRDashboard } from '@/components/hr/hr-dashboard'

export default function HRDashboardPage() {
  return (
    <AuthenticatedLayout>
      <HRDashboard title="HR Dashboard" audience="hr" />
    </AuthenticatedLayout>
  )
}
