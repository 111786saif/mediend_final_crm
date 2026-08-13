'use client'

import { useAuth } from '@/hooks/use-auth'
import { usePermissions, PermissionLevel } from '@/hooks/use-permissions'
import { hasPermission } from '@/lib/rbac'
import { ProtectedRoute } from '@/components/protected-route'
import { PnlDashboard } from '@/components/pnl/pnl-dashboard'

export default function FinancePnLPage() {
  const { user } = useAuth()
  const { hasAccess } = usePermissions()
  const canRead = user && (hasAccess('main.company_pnl') || hasPermission(user, 'pnl:read'))
  const canWritePnl = user && (hasAccess('main.company_pnl', PermissionLevel.READ_WRITE) || hasPermission(user, 'pnl:write'))
  const canWriteLoanDemat = user && (hasAccess('main.loan_demat_revenue', PermissionLevel.READ_WRITE) || hasPermission(user, 'loan-demat:write'))

  return (
    <ProtectedRoute>
      <div className="w-full min-w-0 max-w-[min(100%,1920px)]">
        {!canRead ? (
          <p className="text-muted-foreground">No access</p>
        ) : (
          <PnlDashboard canWritePnl={!!canWritePnl} canWriteLoanDemat={!!canWriteLoanDemat} />
        )}
      </div>
    </ProtectedRoute>
  )
}
