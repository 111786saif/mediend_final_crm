'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { SalesTeamCostView } from '@/components/finance/sales-team-cost/sales-team-cost-view'

export default function SalesTeamCostPage() {
  return (
    <AuthenticatedLayout>
      <SalesTeamCostView />
    </AuthenticatedLayout>
  )
}
