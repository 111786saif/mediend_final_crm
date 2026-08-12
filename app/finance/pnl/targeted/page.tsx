'use client'

import { useAuth } from '@/hooks/use-auth'
import { usePermissions, PermissionLevel } from '@/hooks/use-permissions'
import { hasPermission } from '@/lib/rbac'
import { ProtectedRoute } from '@/components/protected-route'
import { TargetedPnlDashboard } from '@/components/pnl/targeted-pnl-dashboard'

export default function TargetedPnLPage() {
  const { user } = useAuth()
  const { hasAccess } = usePermissions()
  const canWrite = user && (hasAccess('main.targeted_pnl', PermissionLevel.READ_WRITE) || hasAccess('main.company_pnl', PermissionLevel.READ_WRITE) || hasPermission(user, 'pnl:write'))

  return (
    <ProtectedRoute>
      <div className="w-full min-w-0 max-w-[min(100%,1920px)]">
        {!canWrite ? (
          <p className="text-muted-foreground">No access — requires P&amp;L write permission</p>
        ) : (
          <TargetedPnlDashboard />
        )}
      </div>
    </ProtectedRoute>
  )
}
