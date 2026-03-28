'use client'

import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { MDLeaveBalanceRequestsPage } from '@/components/md/leave-balances/md-leave-balance-requests-page'

export default function MDLeaveBalancesPage() {
  return (
    <AuthenticatedLayout>
      <div className="min-h-full min-w-0 overflow-x-hidden bg-gradient-to-b from-sky-50/80 via-background to-background dark:from-sky-950/20 dark:via-background">
        <MDLeaveBalanceRequestsPage />
      </div>
    </AuthenticatedLayout>
  )
}
