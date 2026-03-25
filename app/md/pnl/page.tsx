'use client'

import { useAuth } from '@/hooks/use-auth'
import { ProtectedRoute } from '@/components/protected-route'
import { PnlDashboard } from '@/components/pnl/pnl-dashboard'

export default function MDPnLPage() {
  const { user } = useAuth()
  const isMd = user?.role === 'MD' || user?.role === 'ADMIN'

  return (
    <ProtectedRoute>
      <div className="w-full min-w-0 max-w-[min(100%,1920px)]">
        {!isMd ? (
          <p className="text-muted-foreground">MD or Admin only</p>
        ) : (
          <PnlDashboard canWritePnl={false} canWriteLoanDemat={false} queryKeyPrefix="md-pnl-overview" />
        )}
      </div>
    </ProtectedRoute>
  )
}
