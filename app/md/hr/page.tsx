'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { HRDashboard } from '@/components/hr/hr-dashboard'

export default function MDHRDashboardPage() {
  return (
    <AuthenticatedLayout>
      <HRDashboard title="HR Dashboard" audience="md" />
    </AuthenticatedLayout>
  )
}
