'use client'

import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'
import { ProtectedRoute } from '@/components/protected-route'
import { SalesPnlView } from '@/components/pnl/sales-pnl-view'

export default function SalesPnlPage() {
  const { user } = useAuth()
  const canRead =
    user &&
    (hasPermission(user, 'sales:pnl:read') || hasPermission(user, 'pnl:read'))

  return (
    <ProtectedRoute>
      <div className="w-full min-w-0 max-w-[min(100%,1920px)]">
        {!canRead ? (
          <p className="text-muted-foreground">No access</p>
        ) : (
          <SalesPnlView />
        )}
      </div>
    </ProtectedRoute>
  )
}
