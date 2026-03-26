'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { MDFinancePage } from '@/components/md/finance/md-finance-page'

export default function MDFinanceDashboardPage() {
  return (
    <AuthenticatedLayout>
      <MDFinancePage />
    </AuthenticatedLayout>
  )
}
